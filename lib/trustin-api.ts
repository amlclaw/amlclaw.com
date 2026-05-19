/**
 * TrustIn KYA API client — Antares Compat (Infinity).
 *
 * Public endpoint, no authentication required. The legacy v2 API key is kept
 * in the signature/settings for backwards compatibility but is unused.
 *
 * 4-call investigation flow:
 *   1. POST /investigatev2/submit_query_task_v2     → request_id
 *   2. POST /investigatev2/get_query_status         (poll until finished)
 *   3. POST /investigatev2/get_opponents            (paginated, both directions)
 *   4. POST /investigatev2/get_opponent_paths_with_amount_and_timestamp_range
 *                                                   (seqs batched 100 at a time)
 *   5. POST /query/get_tag_items_v2                 (target self-tags)
 *
 * Result is re-packaged into the legacy `{ code, msg, data: { tags, paths } }`
 * shape so downstream code (extract-risk-paths.ts, FlowGraph, etc.) is unchanged.
 */
import fs from "fs";
import path from "path";
import { getTrustInBaseUrl, getTrustInToken, isDemoMode } from "./settings";

function getBaseUrl(): string {
  try {
    return getTrustInBaseUrl();
  } catch {
    return "https://platform.trustin.bond/api/infinity/api";
  }
}

// Static token required by the shaula reverse-proxy to forward /api/* to infinity.
const SHAULA_TOKEN_HEADER = "x-shaula-token";
const SHAULA_TOKEN_VALUE = "trustin-platform";

function getToken(): string {
  try {
    return getTrustInToken();
  } catch {
    return "USDT";
  }
}

// NOTE: The compat API doc claims chain_name is case-insensitive, but in
// practice only lowercase values return data. Capitalized values short-circuit
// to 0 connections within ~200ms. Always lowercase here.
const CHAIN_MAPPING: Record<string, string> = {
  Tron: "tron",
  Ethereum: "ethereum",
  Bitcoin: "bitcoin",
  Solana: "solana",
};

export interface KYAResult {
  riskScore: number;
  riskLevel: string;
  recommendation: string;
  details: Record<string, unknown>;
  rawResponse: Record<string, unknown> | null;
  error: string | null;
}

export interface DetectOptions {
  inflowHops?: number;
  outflowHops?: number;
  maxNodesPerHop?: number;
  minTimestamp?: number;
  maxTimestamp?: number;
}

interface CompatTag {
  primary_category?: string;
  secondary_category?: string;
  tertiary_category?: string;
  quaternary_category?: string;
  risk_level?: string;
  priority?: number;
}

interface CompatPathNode {
  address: string;
  deep: number;
  pre_address?: string;
  amount?: number;
  last_closed_timestamp?: number;
  tags?: CompatTag[];
}

interface CompatPathRecord {
  direction: number; // 1 = out, -1 = in
  request_id?: number;
  query_address: string;
  chain_name?: string;
  token?: string;
  opponent_address?: string;
  hops?: number;
  path: CompatPathNode[];
  tags?: CompatTag[];
}

interface CompatOpponent {
  seq: number;
  direction: number;
  opponent_address?: string;
  tags?: CompatTag[];
}

async function postJson(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `${getBaseUrl()}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "amlclaw-web/1.0.0",
      [SHAULA_TOKEN_HEADER]: SHAULA_TOKEN_VALUE,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`TrustIn API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function checkBusiness(resp: Record<string, unknown>): void {
  if (resp.code !== 0) {
    throw new Error(`TrustIn API error: ${String(resp.msg ?? "unknown")}`);
  }
}

async function pollStatus(requestId: number, token: string, maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await postJson("/investigatev2/get_query_status", { request_id: requestId });
    const data = (res.data as Record<string, string>) || {};
    const statField = token.toUpperCase() === "USDC" ? "token_usdc_stat" : "token_usdt_stat";
    const stat = data[statField] ?? "";

    if (stat === "finished") return;
    if (stat === "failed") throw new Error(`Investigation task ${requestId} failed`);
    if (stat === "") {
      // Empty status with code:0 means request_id not found.
      throw new Error(`Investigation task ${requestId} not found`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Investigation task ${requestId} timed out while processing.`);
}

async function fetchAllOpponents(
  requestId: number,
  token: string,
): Promise<CompatOpponent[]> {
  const pageSize = 200;
  const all: CompatOpponent[] = [];
  let page = 1;
  for (;;) {
    const res = await postJson("/investigatev2/get_opponents", {
      request_id: requestId,
      direction: 0,
      token,
      page,
      page_size: pageSize,
    });
    checkBusiness(res);
    const batch = (res.data as CompatOpponent[]) || [];
    all.push(...batch);
    const total = typeof res.total === "number" ? res.total : all.length;
    if (all.length >= total || batch.length < pageSize) break;
    page++;
    if (page > 100) break; // hard cap to avoid runaway pagination
  }
  return all;
}

async function fetchPathsForSeqs(
  requestId: number,
  seqs: number[],
  minTimestamp: number,
  maxTimestamp: number,
): Promise<Record<string, CompatPathRecord>> {
  const result: Record<string, CompatPathRecord> = {};
  const chunkSize = 100;
  for (let i = 0; i < seqs.length; i += chunkSize) {
    const chunk = seqs.slice(i, i + chunkSize);
    const res = await postJson(
      "/investigatev2/get_opponent_paths_with_amount_and_timestamp_range",
      {
        request_id: requestId,
        seqs: chunk,
        min_timestamp: minTimestamp,
        max_timestamp: maxTimestamp,
        // Antares gotcha: 0/negative is coerced to 1. Use a tiny positive value
        // to effectively disable the filter.
        min_amount: 0.000001,
        temporal_mode: "backward_max",
      },
    );
    checkBusiness(res);
    Object.assign(result, (res.data as Record<string, CompatPathRecord>) || {});
  }
  return result;
}

async function fetchTargetSelfTags(chainName: string, address: string): Promise<CompatTag[]> {
  try {
    const res = await postJson("/query/get_tag_items_v2", {
      chain_name: chainName,
      address,
    });
    if (res.code !== 0) return [];
    const data = res.data;
    if (Array.isArray(data)) return data as CompatTag[];
    // Some endpoints return zero-struct {} when no tags — normalize to [].
    return [];
  } catch {
    return [];
  }
}

/**
 * Repackage a single compat path record into the legacy `{ direction, path }`
 * shape. For `direction === -1` (inflow), the nodes are reversed so the target
 * lands at the end of the array, matching the legacy extractor's assumptions.
 */
function repackagePath(rec: CompatPathRecord): {
  direction: number;
  path: { address: string; tags: CompatTag[]; amount: number }[];
} {
  const nodes = (rec.path ?? []).map((n) => ({
    address: n.address,
    tags: n.tags ?? [],
    amount: typeof n.amount === "number" ? n.amount : 0,
  }));

  if (rec.direction === -1) {
    nodes.reverse();
  }
  return { direction: rec.direction, path: nodes };
}

function processTagsPriority(rawGraph: unknown): {
  riskScore: number;
  riskLevel: string;
  recommendation: string;
} {
  let maxPriority = 4;
  const riskTags = new Set<string>();

  function processTags(tagsList: unknown[]) {
    for (const tag of tagsList) {
      if (typeof tag === "object" && tag !== null) {
        const t = tag as Record<string, unknown>;
        const prio = typeof t.priority === "number" ? t.priority : 4;
        riskTags.add((t.primary_category as string) || "Unknown");
        if (prio < maxPriority) maxPriority = prio;
      }
    }
  }

  if (Array.isArray(rawGraph)) {
    for (const flow of rawGraph) {
      if (typeof flow === "object" && flow !== null) {
        const f = flow as Record<string, unknown>;
        processTags((f.tags as unknown[]) || []);
        for (const node of (f.path as unknown[]) || []) {
          if (typeof node === "object" && node !== null) {
            processTags(((node as Record<string, unknown>).tags as unknown[]) || []);
          }
        }
      }
    }
  } else if (typeof rawGraph === "object" && rawGraph !== null) {
    const g = rawGraph as Record<string, unknown>;
    processTags((g.tags as unknown[]) || []);
    const paths = (g.paths as unknown[]) || [];
    for (const flow of paths) {
      if (typeof flow === "object" && flow !== null) {
        const f = flow as Record<string, unknown>;
        processTags((f.tags as unknown[]) || []);
        for (const node of (f.path as unknown[]) || []) {
          if (typeof node === "object" && node !== null) {
            processTags(((node as Record<string, unknown>).tags as unknown[]) || []);
          }
        }
      }
    }
  }

  const riskScoreMap: Record<number, number> = { 1: 100, 2: 80, 3: 60, 4: 20 };
  const riskScore = riskScoreMap[maxPriority] ?? 20;

  let recommendation = "No specific risk tags identified";
  if (riskTags.size > 0) {
    recommendation = `Risk tags: ${[...riskTags].slice(0, 3).join(", ")}`;
  }

  let riskLevel = "LOW";
  if (riskScore > 80) riskLevel = "CRITICAL";
  else if (riskScore > 60) riskLevel = "HIGH";
  else if (riskScore > 40) riskLevel = "MEDIUM";
  else if (riskScore > 20) riskLevel = "MEDIUM_LOW";

  return { riskScore, riskLevel, recommendation };
}

export async function kyaProDetect(
  chainName: string,
  address: string,
  // Legacy parameter — kept for backwards compatibility with callers; the new
  // public compat API does not require authentication.
  _apiKey: string,
  opts: DetectOptions = {},
): Promise<KYAResult> {
  // Demo mode — return mock screening result
  if (isDemoMode()) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      const demoPath = path.join(process.cwd(), "data", "demo", "screening-result.json");
      const raw = JSON.parse(fs.readFileSync(demoPath, "utf-8"));
      if (raw.data) raw.data.address = address;
      if (raw.data) raw.data.chain_name = chainName;
      const rawGraph = raw.data?.graph ?? raw.data ?? {};
      const { riskScore, riskLevel, recommendation } = processTagsPriority(rawGraph);
      return {
        riskScore,
        riskLevel,
        recommendation: recommendation + " (demo)",
        details: raw,
        rawResponse: raw,
        error: null,
      };
    } catch {
      return {
        riskScore: 80,
        riskLevel: "HIGH",
        recommendation: "Demo mode — mock risk detected (Darknet Markets, Sanctions)",
        details: { demo: true, graph: [] },
        rawResponse: null,
        error: null,
      };
    }
  }

  if (!CHAIN_MAPPING[chainName]) {
    throw new Error(`Unsupported chain: ${chainName}`);
  }

  const token = getToken();
  const inflowHops = opts.inflowHops ?? 3;
  const outflowHops = opts.outflowHops ?? 3;
  const maxNodesPerHop = opts.maxNodesPerHop ?? 100;
  const minTimestamp = opts.minTimestamp ?? 0;
  const maxTimestamp = opts.maxTimestamp ?? 0;

  try {
    // 1. Submit task
    const submitRes = await postJson("/investigatev2/submit_query_task_v2", {
      chain_name: CHAIN_MAPPING[chainName],
      token,
      address,
      inflow_hops: inflowHops,
      outflow_hops: outflowHops,
      max_nodes_per_hop: maxNodesPerHop,
    });
    if (submitRes.code !== 0 || typeof submitRes.data !== "number") {
      throw new Error(`Failed to submit task: ${String(submitRes.msg ?? "no request_id")}`);
    }
    const requestId = submitRes.data;

    // 2. Poll until finished
    await pollStatus(requestId, token);

    // 3. Fetch all opponents (both directions, paginated)
    const opponents = await fetchAllOpponents(requestId, token);

    // 4. Batch-fetch enriched paths
    const seqs = opponents.map((o) => o.seq).filter((s) => typeof s === "number");
    const pathMap = seqs.length
      ? await fetchPathsForSeqs(requestId, seqs, minTimestamp, maxTimestamp)
      : {};

    // 5. Fetch target self-tags
    const targetTags = await fetchTargetSelfTags(CHAIN_MAPPING[chainName], address);

    // 6. Repackage into legacy shape
    const paths = Object.values(pathMap).map(repackagePath);

    const legacyData = {
      tags: targetTags,
      paths,
    };

    const wrappedResponse = {
      code: 0,
      msg: "success",
      data: {
        task_id: requestId,
        chain_name: chainName,
        address,
        status: "finished",
        tags: legacyData.tags,
        paths: legacyData.paths,
      },
    };

    const { riskScore, riskLevel, recommendation } = processTagsPriority(legacyData);

    return {
      riskScore,
      riskLevel,
      recommendation,
      details: wrappedResponse,
      rawResponse: wrappedResponse,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      riskScore: 50,
      riskLevel: "UNKNOWN",
      recommendation: `API Error/Fallback: ${msg}`,
      details: { api_error: msg, fallback: true },
      rawResponse: null,
      error: msg,
    };
  }
}
