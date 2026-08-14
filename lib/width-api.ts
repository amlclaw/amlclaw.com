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
import { getWidthApiKey, getWidthBaseUrl, getSettings } from "./settings";
import type { FundScore, ScoreComponent, Verdict } from "./risk-score";

/** Address volume + balance snapshot the engine used as score denominators. */
export interface ScoreOverview {
  address: string;
  token: string;
  inTotal: number;
  outTotal: number;
  inCount: number;
  outCount: number;
  balance: number;
  firstTs: number;
  lastTs: number;
  truncated?: boolean;
}

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
  /** Fund-attribution score computed server-side by the width engine. */
  score: FundScore | null;
  scoreOverview: ScoreOverview | null;
  subjectTags: WidthTag[];
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
  /** Overall fund score (server-side). in/out sub-scores for direction split. */
  score: FundScore | null;
  inScore: FundScore | null;
  outScore: FundScore | null;
  scoreOverview: ScoreOverview | null;
  inScoreOverview: ScoreOverview | null;
  outScoreOverview: ScoreOverview | null;
  fromTags: WidthTag[];
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
  scoringRulesetId?: number; // 0 = builtin scoring matrix (server-side)
  /** Enforce chronological order along each path (each hop no earlier than the previous). */
  forceTimeSequence?: boolean;
  /** If the subject is a known exchange, treat it as immune (score 0 / no risk). */
  cexImmune?: boolean;
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
  scoringRulesetId?: number; // 0 = builtin scoring matrix (server-side)
  forceTimeSequence?: boolean;
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
/** Transient poll failures tolerated before giving up (network blips are common). */
const MAX_POLL_FAILURES = 8;

/** Optional hook to observe upstream job status (PENDING | PROCESSING | COMPLETE). */
export interface ScreenProgress {
  onStatus?: (status: string) => void;
}

/** Per-screen poll budget from the Settings `pollingTimeout` (seconds). */
export function screenTimeoutMs(): number {
  const t = getSettings().screening.pollingTimeout;
  return (Number.isFinite(t) && t > 0 ? Math.min(t, 600) : 300) * 1000;
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
  timeoutMs?: number,
): Promise<Record<string, unknown>> {
  const submit = await postV3(endpoint, { ...submitBody, mode: "async" });

  // Defensive: a server that ignored async and returned the full result inline.
  if (looksLikeResult(submit)) return submit;

  // Keep the raw job id as a string — the API may return numeric or string ids.
  const jobIdRaw = String(submit.job_id ?? submit.jobId ?? submit.id ?? "").trim();
  if (!jobIdRaw || jobIdRaw === "0") {
    throw new Error(`Async submit returned no job_id: ${JSON.stringify(submit)}`);
  }

  const deadline = Date.now() + (timeoutMs ?? POLL_TIMEOUT_MS);
  const startedAt = Date.now();
  let lastStatus = "";
  let consecutiveFailures = 0;
  for (;;) {
    // A single transient poll failure (dropped connection, 5xx, timeout) must
    // NOT kill the whole screen — the upstream job keeps running, so retry
    // until the deadline. Only terminal states or the deadline abort.
    let job: Record<string, unknown> | null = null;
    try {
      job = await getV3(`/api/v3/screen/result/${jobIdRaw}`);
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures++;
      if (consecutiveFailures > MAX_POLL_FAILURES) {
        throw new Error(
          `Screen job ${jobIdRaw} unreachable after ${consecutiveFailures} poll failures ` +
            `(last status=${lastStatus || "unknown"})`,
        );
      }
      if (Date.now() > deadline) break;
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const status = String(job.status ?? "").toUpperCase();
    if (status && status !== lastStatus) {
      lastStatus = status;
      progress?.onStatus?.(status);
    }
    if (status === "COMPLETE") {
      const result = job.result as Record<string, unknown> | undefined;
      if (!result) {
        throw new Error(`Screen job ${jobIdRaw} is COMPLETE but the result payload is missing`);
      }
      return result;
    }
    if (status === "FAILED" || status === "ERROR") {
      throw new Error(
        `Screen job ${jobIdRaw} failed (status=${status}${job.error ? `: ${String(job.error)}` : ""})`,
      );
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Screen job ${jobIdRaw} did not complete within ${Math.round((Date.now() - startedAt) / 1000)}s ` +
          `(last status=${lastStatus || "unknown"})`,
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
  // Only reachable via the catch-branch `break` when the deadline expired
  // during a transient poll failure.
  throw new Error(
    `Screen job ${jobIdRaw} did not complete within ${Math.round((Date.now() - startedAt) / 1000)}s ` +
      `(last status=${lastStatus || "unknown"})`,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function kyaScreen(
  params: KyaScreenParams,
  progress?: ScreenProgress,
  timeoutMs?: number,
): Promise<KyaScreenResult> {
  assertChain(params.chain);
  const data = await submitAndPoll(
    "/api/v3/screen/kya",
    {
      chain_name: params.chain,
      address: params.address,
      token: params.token ?? "usdt",
      inflow_hops: params.inflowHops ?? 3,
      outflow_hops: params.outflowHops ?? 1,
      min_timestamp: params.minTimestamp ?? 0,
      max_timestamp: params.maxTimestamp ?? Date.now(),
      min_amount: params.minAmount ?? 10,
      max_nodes_per_hop: params.maxNodesPerHop ?? 200,
      max_opponent_paths: params.maxOpponentPaths ?? 50,
      is_penetrate_contract: params.isPenetrateContract ?? false,
      force_time_sequence: params.forceTimeSequence ?? true,
      cex_immune: params.cexImmune ?? true,
      ruleset_id: params.rulesetId ?? 0,
      scoring_ruleset_id: params.scoringRulesetId ?? 0,
      scenario: params.scenario ?? "all",
    },
    progress,
    timeoutMs,
  );
  return normalizeKya(data);
}

export async function kytScreen(
  params: KytScreenParams,
  progress?: ScreenProgress,
  timeoutMs?: number,
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
      outflow_hops: params.outflowHops ?? 1,
      min_timestamp: params.minTimestamp ?? 0,
      max_timestamp: params.maxTimestamp ?? Date.now(),
      min_amount: params.minAmount ?? 10,
      max_nodes_per_hop: params.maxNodesPerHop ?? 200,
      max_opponent_paths: params.maxOpponentPaths ?? 50,
      is_penetrate_contract: params.isPenetrateContract ?? false,
      force_time_sequence: params.forceTimeSequence ?? true,
      in_ruleset_id: params.inRulesetId ?? 0,
      out_ruleset_id: params.outRulesetId ?? 0,
      ruleset_id: 0,
      scoring_ruleset_id: params.scoringRulesetId ?? 0,
      scenario: params.scenario ?? "all",
    },
    progress,
    timeoutMs,
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

/**
 * Normalize a tag object — the API returns camelCase for fromTags/subjectTags
 * ({primaryCategory, tertiaryCategory, riskLevel}) but snake_case inside
 * pathNodes[].tags — into the canonical snake_case WidthTag shape.
 */
function normalizeTag(t: unknown): WidthTag {
  if (typeof t === "string") return { primary_category: t };
  if (!t || typeof t !== "object") return {};
  const o = t as Record<string, unknown>;
  const pick = (camel: string, snake: string) => {
    const v = o[camel] ?? o[snake];
    return v == null ? undefined : String(v);
  };
  return {
    primary_category: pick("primaryCategory", "primary_category"),
    secondary_category: pick("secondaryCategory", "secondary_category"),
    tertiary_category: pick("tertiaryCategory", "tertiary_category"),
    quaternary_category: pick("quaternaryCategory", "quaternary_category"),
    risk_level: pick("riskLevel", "risk_level"),
  };
}

/** Pass through the server-side FundScore with defensive coercion, so a
 *  missing/renamed field degrades the card instead of crashing the report. */
function parseScore(s: unknown): FundScore | null {
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  const d = s as Record<string, unknown>;
  const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const numOrNull = (v: unknown): number | null => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const VERDICTS = new Set(["accept", "review", "edd", "block"]);
  const components: ScoreComponent[] = Array.isArray(d.components)
    ? d.components.filter((c): c is ScoreComponent => !!c && typeof c === "object")
    : [];
  return {
    score: numOrNull(d.score),
    verdict: VERDICTS.has(String(d.verdict ?? "")) ? String(d.verdict) as Verdict : null,
    selfHit: d.selfHit === true,
    selfHitLevel: d.selfHitLevel ? String(d.selfHitLevel).toLowerCase() : null,
    counterpartyFlagged: d.counterpartyFlagged === true,
    components,
    r1: num(d.r1),
    r2: num(d.r2),
    rOut: num(d.rOut),
    directAmount: num(d.directAmount),
    indirectAmount: num(d.indirectAmount),
    outflowAmount: num(d.outflowAmount),
    totalIn: numOrNull(d.totalIn),
    totalOut: numOrNull(d.totalOut),
    hitPaths: num(d.hitPaths),
    riskyEdges: num(d.riskyEdges),
  };
}

function parseOverview(o: unknown): ScoreOverview | null {
  if (!o || typeof o !== "object") return null;
  const d = o as Record<string, unknown>;
  return {
    address: String(d.address ?? ""),
    token: String(d.token ?? "usdt"),
    inTotal: Number(d.inTotal ?? 0),
    outTotal: Number(d.outTotal ?? 0),
    inCount: Number(d.inCount ?? 0),
    outCount: Number(d.outCount ?? 0),
    balance: Number(d.balance ?? 0),
    firstTs: Number(d.firstTs ?? 0),
    lastTs: Number(d.lastTs ?? 0),
    truncated: Boolean(d.truncated),
  };
}

function normalizeKya(data: Record<string, unknown>): KyaScreenResult {
  const cluster = (data.cluster as Record<string, unknown>) || {};
  return {
    score: parseScore(data.score),
    scoreOverview: parseOverview(data.scoreOverview),
    subjectTags: asArray<unknown>(data.subjectTags).map(normalizeTag),
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
    score: parseScore(data.score),
    inScore: parseScore(data.inScore),
    outScore: parseScore(data.outScore),
    scoreOverview: parseOverview(data.scoreOverview),
    inScoreOverview: parseOverview(data.inScoreOverview),
    outScoreOverview: parseOverview(data.outScoreOverview),
    fromTags: asArray<unknown>(data.fromTags).map(normalizeTag),
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
