/**
 * Shared TypeScript interfaces for AMLClaw Web (v3 — width.info API era).
 */

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

/**
 * Two monitor types, both watching FUTURE activity:
 *  - "address": watch an address's new stablecoin transfers; every new tx is
 *    KYT-screened (receiving = in, sending = out).
 *  - "kyt": watch the from/to counterparty of a transaction; each cycle runs
 *    a KYA screen of that address and tracks risk escalation.
 */
export type MonitorType = "address" | "kyt";

export interface MonitorTask {
  id: string;
  type: MonitorType;
  name: string;
  chain: string; // Ethereum | Tron
  /** The monitored address (for kyt monitors: the resolved from/to address). */
  address: string;

  // address monitors
  /** Tokens watched (ETH: USDT+USDC, Tron: USDT). */
  tokens?: string[];
  /** Minimum transfer amount (token units) for a tx to be screened. */
  min_amount?: number;
  /** Feed cursor — Ethereum lastBlock / Tron lastTimestamp. */
  cursor?: { lastBlock?: number; lastTimestamp?: number };
  in_ruleset_id?: number;
  out_ruleset_id?: number;

  // kyt monitors
  /** Origin transaction the monitor was created from. */
  origin_tx_id?: string;
  /** Which side of the origin tx is monitored. */
  watch_side?: "from" | "to";
  kya_ruleset_id?: number;
  /** Risk level of the last KYA run (for escalation detection). */
  last_risk_level?: string;
  /** TX monitors: latest fund-attribution score of the watched counterparty. */
  last_score?: number | null;
  last_verdict?: string | null;

  schedule: string; // cron expression "0 */4 * * *"
  schedule_preset: string; // "every_4h" | "custom" etc.
  enabled: boolean;
  created_at: string;
  updated_at: string;
  running: boolean;
  last_run_at?: string;
  next_run_at?: string;
  last_result_summary?: MonitorRunSummary;
}

export interface MonitorRunSummary {
  /** address monitors: new txs found this run; kyt monitors: always 1. */
  new_txs: number;
  screened: number;
  skipped: number;
  flagged: number;
  highest_risk: string; // low | medium | high | critical
}

export interface MonitorRun {
  run_id: string;
  task_id: string;
  started_at: string;
  completed_at?: string;
  status: "running" | "completed" | "error" | "partial";
  trigger: "scheduled" | "manual";
  results: MonitorRunResult[];
  summary?: MonitorRunSummary;
  error?: string;
}

export interface MonitorRunResult {
  status: "completed" | "error" | "skipped";
  /** Screening history job id (links to full result). */
  job_id?: string;
  risk_level?: string;
  error?: string;

  // address monitors — the screened tx
  tx_id?: string;
  direction?: "in" | "out";
  token?: string;
  amount?: number;
  counterparty?: string;

  // kyt monitors — the screened address
  address?: string;
  previous_risk_level?: string;
  escalated?: boolean;
  score?: number | null;
  verdict?: string | null;
}

// ---------------------------------------------------------------------------
// Screening history
// ---------------------------------------------------------------------------

export type ScreeningType = "kya" | "kyt";

export interface HistoryIndexEntry {
  job_id: string;
  type: ScreeningType;
  chain: string;
  /** KYA: screened address. KYT: transaction hash. */
  subject: string;
  scenario?: string;
  direction?: string; // KYT: in | out | both
  risk_level: string; // low | medium | high | critical
  /** Fund-attribution score (score-first UI); null = denominators unavailable. */
  score?: number | null;
  verdict?: string | null; // accept | review | edd | block
  hits_count: number;
  completed_at: string;
  source?: "manual" | "monitor";
}
