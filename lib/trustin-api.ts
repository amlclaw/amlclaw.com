/**
 * TrustIn KYA API v2 wrapper (TypeScript port of trustin_api.py)
 */
import fs from "fs";
import path from "path";
import { getTrustInBaseUrl, isDemoMode } from "./settings";

function getBaseUrl(): string {
  try {
    return getTrustInBaseUrl();
  } catch {
    return "https://api.trustin.info/api/v2/investigate";
  }
}

const CHAIN_MAPPING: Record<string, string> = {
  Tron: "Tron",
  Ethereum: "Ethereum",
  Bitcoin: "Bitcoin",
  Solana: "Solana",
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

async function makeRequest(
  endpoint: string,
  data: Record<string, unknown>,
  apiKey: string
): Promise<Record<string, unknown>> {
  // API key is optional — without it, TrustIn returns desensitized (masked) data
  const url = apiKey
    ? `${getBaseUrl()}/${endpoint}?apikey=${apiKey}`
    : `${getBaseUrl()}/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "User-Agent": "amlclaw-web/1.0.0" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid authorization (Check API Key)");
    throw new Error(`TrustIn API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function waitForTask(
  taskId: number,
  apiKey: string,
  maxRetries = 30
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await makeRequest("get_status", { task_id: taskId }, apiKey);
    if (res.code === 0 && res.data === "finished") return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
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
    for (const node of (g.path as unknown[]) || []) {
      if (typeof node === "object" && node !== null) {
        processTags(((node as Record<string, unknown>).tags as unknown[]) || []);
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
  apiKey: string,
  opts: DetectOptions = {}
): Promise<KYAResult> {
  // Demo mode — return mock screening result
  if (isDemoMode()) {
    await new Promise((r) => setTimeout(r, 1500)); // Simulate API delay
    try {
      const demoPath = path.join(process.cwd(), "data", "demo", "screening-result.json");
      const raw = JSON.parse(fs.readFileSync(demoPath, "utf-8"));
      // Override address in response to match the requested one
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

  const submitPayload: Record<string, unknown> = {
    chain_name: CHAIN_MAPPING[chainName],
    address,
    inflow_hops: opts.inflowHops ?? 3,
    outflow_hops: opts.outflowHops ?? 3,
    max_nodes_per_hop: opts.maxNodesPerHop ?? 100,
  };

  if (opts.minTimestamp) submitPayload.min_timestamp = opts.minTimestamp;
  if (opts.maxTimestamp) submitPayload.max_timestamp = opts.maxTimestamp;

  try {
    const submitRes = await makeRequest("submit_task", submitPayload, apiKey);
    const taskId = submitRes.data as number;
    if (submitRes.code !== 0 || !taskId) {
      throw new Error(`Failed to submit task: ${submitRes.msg}`);
    }

    if (!(await waitForTask(taskId, apiKey))) {
      throw new Error(`Task ${taskId} timed out while processing.`);
    }

    const resultPayload = { task_id: taskId, token: "usdt" };
    const finalRes = await makeRequest("get_result", resultPayload, apiKey);

    if (finalRes.code === 0) {
      let rawData = finalRes.data;
      if (typeof rawData === "string") {
        try { rawData = JSON.parse(rawData); } catch { rawData = {}; }
      }

      let rawGraph: unknown;
      if (typeof rawData === "object" && rawData !== null) {
        const d = rawData as Record<string, unknown>;
        rawGraph = d.graph ?? d.paths ?? d;
      } else {
        rawGraph = rawData;
      }

      const { riskScore, riskLevel, recommendation } = processTagsPriority(rawGraph);

      return {
        riskScore,
        riskLevel,
        recommendation,
        details: finalRes as Record<string, unknown>,
        rawResponse: finalRes as Record<string, unknown>,
        error: null,
      };
    } else {
      throw new Error(`Failed to fetch result: ${finalRes.msg || "Unknown API error"}`);
    }
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
