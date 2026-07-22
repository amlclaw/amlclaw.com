/**
 * Width.info / TrustIn V3 Screening API client.
 *
 * Docs UI:  https://width.info/api-reference
 * API base: https://api.trustin.bond  (width.info is the docs frontend;
 *           actual requests go to api.trustin.bond)
 * Auth:     ?apikey=<key> query parameter.
 *
 * Two sync endpoints (Chainalysis-aligned responses + TrustIn extensions):
 *   POST /api/v3/screen/kya  — address screening, server-side ruleset engine
 *   POST /api/v3/screen/kyt  — transaction screening, per-direction rulesets
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

async function postV3(
  endpoint: string,
  body: Record<string, unknown>,
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
    // Sync screening can take a while on deep traces.
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    throw new Error(`Width API HTTP error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  if (json.code !== 0) {
    throw new Error(`Width API error: ${String(json.msg ?? "unknown error")}`);
  }
  return json.data as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function kyaScreen(params: KyaScreenParams): Promise<KyaScreenResult> {
  assertChain(params.chain);
  const data = await postV3("/api/v3/screen/kya", {
    chain_name: params.chain,
    address: params.address,
    token: params.token ?? "usdt",
    inflow_hops: params.inflowHops ?? 3,
    outflow_hops: params.outflowHops ?? 3,
    min_timestamp: params.minTimestamp ?? 0,
    max_timestamp: params.maxTimestamp ?? Date.now(),
    min_amount: params.minAmount ?? 1,
    max_nodes_per_hop: params.maxNodesPerHop ?? 200,
    max_opponent_paths: params.maxOpponentPaths ?? 50,
    is_penetrate_contract: params.isPenetrateContract ?? false,
    ruleset_id: params.rulesetId ?? 0,
    scenario: params.scenario ?? "all",
    mode: "sync",
  });
  return normalizeKya(data);
}

export async function kytScreen(params: KytScreenParams): Promise<KytScreenResult> {
  assertChain(params.chain);
  const data = await postV3("/api/v3/screen/kyt", {
    chain_name: params.chain,
    token: params.token ?? "usdt",
    tx_id: params.txId,
    screen_direction: params.screenDirection ?? "both",
    inflow_hops: params.inflowHops ?? 3,
    outflow_hops: params.outflowHops ?? 3,
    min_timestamp: params.minTimestamp ?? 0,
    max_timestamp: params.maxTimestamp ?? Date.now(),
    min_amount: params.minAmount ?? 1,
    max_nodes_per_hop: params.maxNodesPerHop ?? 200,
    max_opponent_paths: params.maxOpponentPaths ?? 50,
    is_penetrate_contract: params.isPenetrateContract ?? false,
    in_ruleset_id: params.inRulesetId ?? 0,
    out_ruleset_id: params.outRulesetId ?? 0,
    ruleset_id: 0,
    scenario: params.scenario ?? "all",
    mode: "sync",
  });
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
    pathNodes: asArray<Record<string, unknown>>(raw.pathNodes).map((n) => ({
      address: String(n.address ?? ""),
      amount: Number(n.amount ?? 0),
      deep: Number(n.deep ?? 0),
      tags: asArray<WidthTag>(n.tags),
    })),
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
