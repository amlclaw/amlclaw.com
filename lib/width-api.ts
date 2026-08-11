/**
 * Width.info / TrustIn V3 Screening API client.
 *
 * Docs UI:  https://width.info/api-reference
 * API base: https://api.trustin.bond  (width.info is the docs frontend;
 *           actual requests go to api.trustin.bond)
 * Auth:     ?apikey=<key> query parameter.
 *
 * Screening endpoints (Chainalysis-aligned responses + TrustIn extensions):
 *   POST /api/v3/screen/kya            — address screening, server-side rulesets
 *   POST /api/v3/screen/kyt            — transaction screening, per-direction
 *   GET  /api/v3/screen/result/{jobId} — poll an async job (PENDING/PROCESSING/
 *                                        COMPLETE); result under `result`
 *
 * We submit with mode:"async" and poll the result endpoint — see submitAndPoll.
 *
 * Rulesets live server-side: ruleset_id 0 = builtin default (KYA builtin, or
 * KYT-IN / KYT-OUT builtins per direction).
 */
import { getWidthApiKey, getWidthBaseUrl } from "./settings";

// ---------------------------------------------------------------------------
// Types (verified against live API responses 2026-07-22)
// ---------------------------------------------------------------------------

export interface WidthTag {
  primary_category?: string;
  secondary_category?: string;
  tertiary_category?: string;
  quaternary_category?: string;
  risk_level?: string;
}

/** A node on an evidence path. deep=0 is the opponent (risk entity). */
export interface WidthPathNode {
  address: string;
  /** Edge amount flowing into this node from the previous node (token units). */
  amount: number;
  deep: number;
  tags: WidthTag[];
}

export interface WidthHit {
  ruleCode: string;
  ruleName: string;
  category: string;
  riskLevel: string; // low | medium | high | critical
  action: string; // block | review | alert | monitor
  direction: string; // inbound | outbound | ""
  pathFlow: string; // inflow | outflow
  hops: number;
  opponentAddress: string;
  maxAmount: number;
  pathNodes: WidthPathNode[];
}

export interface WidthAlert {
  alertLevel: string; // low | medium | high | critical
  category: string;
  service: string; // "KYT"
  exposureType: string; // DIRECT | INDIRECT
  alertAmount: number;
  categoryId: string; // rule code
  direction: string;
  hops: number;
  opponentAddress: string;
  action: string;
}

export interface WidthExposure {
  category: string;
  direction: string; // inflow | outflow
  value: number;
}

export interface WidthIdentification {
  category: string;
  name: string;
  description: string;
}

export interface KyaScreenResult {
  address: string;
  chain: string;
  risk: string; // low | medium | high | critical
  /**
   * Fixed mapping of the level (critical=90, high=80, medium=60, low=10) —
   * no independent meaning; the level from the user's ruleset is the core
   * signal. Only useful bit: 0 = NO rule triggered at all (clean), vs 10 =
   * a low-severity rule actually fired.
   */
  riskScore: number;
  riskReason: string;
  cluster: { name: string; category: string };
  addressType: string;
  addressIdentifications: WidthIdentification[];
  exposures: WidthExposure[];
  hits: WidthHit[];
  rulesTriggered: string[];
  rulesetId: number;
  totalPaths: number;
  hitPaths: number;
  inflowRiskAmount: number;
  inflowRiskRate: number;
  outflowRiskAmount: number;
  outflowRiskRate: number;
}

export interface KytScreenResult {
  transaction: string;
  chain: string;
  risk: string;
  riskScore: number;
  alerts: WidthAlert[];
  hits: WidthHit[];
  rulesTriggered: string[];
  rulesetId: number;
  totalPaths: number;
  hitPaths: number;
}

export interface KyaScreenParams {
  chain: string; // Ethereum | Tron
  address: string;
  token?: string; // usdt | usdc
  inflowHops?: number;
  outflowHops?: number;
  minTimestamp?: number;
  maxTimestamp?: number;
  minAmount?: number;
  maxNodesPerHop?: number;
  maxOpponentPaths?: number;
  isPenetrateContract?: boolean;
  rulesetId?: number; // 0 = builtin default
  scenario?: string; // all | deposit | withdrawal | cdd | monitoring | screening
}

export type KytDirection = "in" | "out" | "both";

export interface KytScreenParams {
  chain: string;
  txId: string;
  token?: string;
  screenDirection?: KytDirection;
  inflowHops?: number;
  outflowHops?: number;
  minTimestamp?: number;
  maxTimestamp?: number;
  minAmount?: number;
  maxNodesPerHop?: number;
  maxOpponentPaths?: number;
  isPenetrateContract?: boolean;
  inRulesetId?: number; // 0 = KYT-IN builtin
  outRulesetId?: number; // 0 = KYT-OUT builtin
  scenario?: string;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const SUPPORTED_CHAINS = ["Ethereum", "Tron"];

function assertChain(chain: string) {
  if (!SUPPORTED_CHAINS.includes(chain)) {
    throw new Error(`Unsupported chain: ${chain}. Supported: ${SUPPORTED_CHAINS.join(", ")}`);
  }
}

/** Envelope check + unwrap of the standard {code,msg,data} response. */
function unwrap(json: Record<string, unknown>): Record<string, unknown> {
  if (json.code !== 0) {
    throw new Error(`Width API error: ${String(json.msg ?? "unknown error")}`);
  }
  return (json.data ?? {}) as Record<string, unknown>;
}

async function postV3(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs = 60_000,
): Promise<Record<string, unknown>> {
  const apiKey = getWidthApiKey();
  if (!apiKey) {
    throw new Error("Width.info API key not configured. Set it in Settings → API Keys.");
  }
  const url = `${getWidthBaseUrl()}${endpoint}?apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "amlclaw-web/2.0",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Width API HTTP error: ${res.status} ${res.statusText}`);
  }
  return unwrap((await res.json()) as Record<string, unknown>);
}

async function getV3(
  endpoint: string,
  timeoutMs = 30_000,
): Promise<Record<string, unknown>> {
  const apiKey = getWidthApiKey();
  if (!apiKey) {
    throw new Error("Width.info API key not configured. Set it in Settings → API Keys.");
  }
  const url = `${getWidthBaseUrl()}${endpoint}?apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": "amlclaw-web/2.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Width API HTTP error: ${res.status} ${res.statusText}`);
  }
  return unwrap((await res.json()) as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Async submit + poll
//
// Screening runs asynchronously: POST /screen/{kya,kyt} with mode:"async"
// returns a job_id; poll GET /screen/result/{jobId} every few seconds until
// status is COMPLETE, then read `result` (same shape as the sync endpoints).
//
// Why async over a single long sync request: deep traces take 5–40s+ (longer
// for large addresses). One HTTP connection held that long is fragile — a
// proxy / load balancer / serverless function will drop or kill it and lose
// the whole screen. Short poll requests survive that, allow re-polling on a
// dropped connection, and surface PENDING/PROCESSING as live progress.
// Detection runs once per job+params, so polling costs nothing extra.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 300_000; // overall cap across all polls (large addresses)
const RESULT_MARKERS = ["risk", "address", "transaction"]; // sync-shaped result keys

/** Optional hook to observe upstream job status (PENDING | PROCESSING | COMPLETE). */
export interface ScreenProgress {
  onStatus?: (status: string) => void;
}

/** Human-readable progress label for an upstream job status. */
export function screenStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case "PENDING":
      return "Queued — upstream investigation starting (PENDING)…";
    case "PROCESSING":
      return "Tracing & detecting against ruleset (PROCESSING)…";
    case "COMPLETE":
      return "Complete — building result…";
    default:
      return `Screening… (${status})`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function looksLikeResult(data: Record<string, unknown>): boolean {
  return RESULT_MARKERS.some((k) => k in data);
}

/**
 * Submit a screen in async mode and poll until it completes. `submitBody` must
 * NOT include `mode` — it is forced to "async" here. Returns the raw result
 * object (sync-endpoint shape), ready for normalizeKya / normalizeKyt.
 */
async function submitAndPoll(
  endpoint: string,
  submitBody: Record<string, unknown>,
  progress?: ScreenProgress,
): Promise<Record<string, unknown>> {
  const submit = await postV3(endpoint, { ...submitBody, mode: "async" });

  // Defensive: a server that ignored async and returned the full result inline.
  if (looksLikeResult(submit)) return submit;

  const jobId = Number(submit.job_id ?? submit.jobId ?? submit.id);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    throw new Error(`Async submit returned no job_id: ${JSON.stringify(submit)}`);
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastStatus = "";
  for (;;) {
    const job = await getV3(`/api/v3/screen/result/${jobId}`);
    const status = String(job.status ?? "").toUpperCase();
    if (status && status !== lastStatus) {
      lastStatus = status;
      progress?.onStatus?.(status);
    }
    if (status === "COMPLETE") {
      const result = job.result as Record<string, unknown> | undefined;
      if (!result) {
        throw new Error(`Screen job ${jobId} is COMPLETE but the result payload is missing`);
      }
      return result;
    }
    if (status === "FAILED" || status === "ERROR") {
      throw new Error(`Screen job ${jobId} failed (status=${status})`);
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Screen job ${jobId} did not complete within ${POLL_TIMEOUT_MS / 1000}s ` +
          `(last status=${lastStatus || "unknown"})`,
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function kyaScreen(
  params: KyaScreenParams,
  progress?: ScreenProgress,
): Promise<KyaScreenResult> {
  assertChain(params.chain);
  const data = await submitAndPoll(
    "/api/v3/screen/kya",
    {
      chain_name: params.chain,
      address: params.address,
      token: params.token ?? "usdt",
      inflow_hops: params.inflowHops ?? 3,
      outflow_hops: params.outflowHops ?? 3,
      min_timestamp: params.minTimestamp ?? 0,
      max_timestamp: params.maxTimestamp ?? Date.now(),
      min_amount: params.minAmount ?? 10,
      max_nodes_per_hop: params.maxNodesPerHop ?? 200,
      max_opponent_paths: params.maxOpponentPaths ?? 50,
      is_penetrate_contract: params.isPenetrateContract ?? false,
      ruleset_id: params.rulesetId ?? 0,
      scenario: params.scenario ?? "all",
    },
    progress,
  );
  return normalizeKya(data);
}

export async function kytScreen(
  params: KytScreenParams,
  progress?: ScreenProgress,
): Promise<KytScreenResult> {
  assertChain(params.chain);
  const data = await submitAndPoll(
    "/api/v3/screen/kyt",
    {
      chain_name: params.chain,
      token: params.token ?? "usdt",
      tx_id: params.txId,
      screen_direction: params.screenDirection ?? "both",
      inflow_hops: params.inflowHops ?? 3,
      outflow_hops: params.outflowHops ?? 3,
      min_timestamp: params.minTimestamp ?? 0,
      max_timestamp: params.maxTimestamp ?? Date.now(),
      min_amount: params.minAmount ?? 10,
      max_nodes_per_hop: params.maxNodesPerHop ?? 200,
      max_opponent_paths: params.maxOpponentPaths ?? 50,
      is_penetrate_contract: params.isPenetrateContract ?? false,
      in_ruleset_id: params.inRulesetId ?? 0,
      out_ruleset_id: params.outRulesetId ?? 0,
      ruleset_id: 0,
      scenario: params.scenario ?? "all",
    },
    progress,
  );
  return normalizeKyt(data);
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const RISK_LEVELS = ["low", "medium", "high", "critical"];

/** Normalize a risk level string to the canonical lowercase vocabulary. */
export function normalizeRisk(risk: unknown): string {
  const r = String(risk ?? "low").toLowerCase();
  return RISK_LEVELS.includes(r) ? r : "low";
}

/** Rank for comparisons: higher = riskier. */
export function riskRank(risk: string): number {
  return RISK_LEVELS.indexOf(normalizeRisk(risk));
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/**
 * Normalize one path node. The docs declare pathNodes as string[] (ordered
 * addresses opponent → target) but the live API returns rich objects
 * {address, amount, deep, tags[]}. Accept both shapes.
 * (Exported for unit tests.)
 */
export function normalizePathNode(n: unknown, index: number): WidthPathNode {
  if (typeof n === "string") {
    return { address: n, amount: 0, deep: index, tags: [] };
  }
  const o = (n ?? {}) as Record<string, unknown>;
  return {
    address: String(o.address ?? ""),
    amount: Number(o.amount ?? 0),
    deep: Number(o.deep ?? index),
    tags: asArray<WidthTag>(o.tags),
  };
}

function normalizeHit(raw: Record<string, unknown>): WidthHit {
  return {
    ruleCode: String(raw.ruleCode ?? ""),
    ruleName: String(raw.ruleName ?? ""),
    category: String(raw.category ?? ""),
    riskLevel: normalizeRisk(raw.riskLevel),
    action: String(raw.action ?? ""),
    direction: String(raw.direction ?? ""),
    pathFlow: String(raw.pathFlow ?? ""),
    hops: Number(raw.hops ?? 0),
    opponentAddress: String(raw.opponentAddress ?? ""),
    maxAmount: Number(raw.maxAmount ?? 0),
    pathNodes: asArray<unknown>(raw.pathNodes).map(normalizePathNode),
  };
}

function normalizeKya(data: Record<string, unknown>): KyaScreenResult {
  const cluster = (data.cluster as Record<string, unknown>) || {};
  return {
    address: String(data.address ?? ""),
    chain: String(data.chain ?? ""),
    risk: normalizeRisk(data.risk),
    riskScore: Number(data.riskScore ?? 0),
    riskReason: String(data.riskReason ?? ""),
    cluster: { name: String(cluster.name ?? ""), category: String(cluster.category ?? "") },
    addressType: String(data.addressType ?? ""),
    addressIdentifications: asArray<WidthIdentification>(data.addressIdentifications),
    exposures: asArray<WidthExposure>(data.exposures),
    hits: asArray<Record<string, unknown>>(data.hits).map(normalizeHit),
    rulesTriggered: asArray<string>(data.rulesTriggered),
    rulesetId: Number(data.rulesetId ?? 0),
    totalPaths: Number(data.totalPaths ?? 0),
    hitPaths: Number(data.hitPaths ?? 0),
    inflowRiskAmount: Number(data.inflowRiskAmount ?? 0),
    inflowRiskRate: Number(data.inflowRiskRate ?? 0),
    outflowRiskAmount: Number(data.outflowRiskAmount ?? 0),
    outflowRiskRate: Number(data.outflowRiskRate ?? 0),
  };
}

function normalizeKyt(data: Record<string, unknown>): KytScreenResult {
  return {
    transaction: String(data.transaction ?? ""),
    chain: String(data.chain ?? ""),
    risk: normalizeRisk(data.risk),
    riskScore: Number(data.riskScore ?? 0),
    alerts: asArray<Record<string, unknown>>(data.alerts).map((a) => ({
      alertLevel: normalizeRisk(a.alertLevel),
      category: String(a.category ?? ""),
      service: String(a.service ?? "KYT"),
      exposureType: String(a.exposureType ?? ""),
      alertAmount: Number(a.alertAmount ?? 0),
      categoryId: String(a.categoryId ?? ""),
      direction: String(a.direction ?? ""),
      hops: Number(a.hops ?? 0),
      opponentAddress: String(a.opponentAddress ?? ""),
      action: String(a.action ?? ""),
    })),
    hits: asArray<Record<string, unknown>>(data.hits).map(normalizeHit),
    rulesTriggered: asArray<string>(data.rulesTriggered),
    rulesetId: Number(data.rulesetId ?? 0),
    totalPaths: Number(data.totalPaths ?? 0),
    hitPaths: Number(data.hitPaths ?? 0),
  };
}
