/**
 * Per-monitor transaction ledger for Address Monitoring.
 *
 * Every new transfer captured by the tx feed is recorded here (tronscan-style
 * table in the UI). KYT screening state is tracked per tx — failed screens
 * stay in the ledger and are retried on later runs instead of being lost
 * (the feed cursor advances on capture, not on screening success).
 */
import fs from "fs";
import path from "path";

const MONITORS_DIR = path.join(process.cwd(), "data", "monitors");

/** Max ledger entries kept per monitor. Unscreened rows are never evicted
 *  (see saveMonitorTxs) — the cap only bounds completed history. */
const LEDGER_CAP = 5000;
/** Screening attempts before a tx is marked failed permanently. */
export const MAX_KYT_RETRIES = 3;

export interface MonitorTx {
  tx_id: string;
  /** Ethereum block number (0 for Tron). */
  block_number: number;
  /** Unix ms */
  timestamp: number;
  from: string;
  to: string;
  token: string;
  amount: number;
  /** "in" = monitored address received, "out" = sent. */
  direction: "in" | "out";
  /** pending → screened | error (will retry) | failed (gave up) */
  kyt_status: "pending" | "screened" | "error" | "failed";
  retry_count: number;
  risk_level?: string;
  /** Fund-attribution score of the screened tx (score-first UI). */
  score?: number | null;
  verdict?: string | null;
  /** Risk categories (Sanctions / Cybercrime / …) hit by the screen. */
  categories?: string[];
  /** Screening history job id — links to the full KYT report. */
  job_id?: string;
  error?: string;
  screened_at?: string;
  captured_at: string;
}

function ledgerPath(monitorId: string) {
  return path.join(MONITORS_DIR, monitorId, "txs.json");
}

export function loadMonitorTxs(monitorId: string): MonitorTx[] {
  try {
    const raw = fs.readFileSync(ledgerPath(monitorId), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMonitorTxs(monitorId: string, txs: MonitorTx[]) {
  // Newest first. When over cap, NEVER evict unscreened work (pending / error)
  // — only completed rows (screened / failed) may be dropped. Otherwise a busy
  // monitor silently loses txs before they are ever screened, and even already-
  // screened evidence can vanish, breaking the "every tx checked" guarantee.
  const sorted = [...txs].sort((a, b) => b.timestamp - a.timestamp);
  let final = sorted;
  if (sorted.length > LEDGER_CAP) {
    const unscreened = sorted.filter(
      (t) => t.kyt_status === "pending" || t.kyt_status === "error",
    );
    const done = sorted.filter(
      (t) => t.kyt_status === "screened" || t.kyt_status === "failed",
    );
    const keepDone = Math.max(0, LEDGER_CAP - unscreened.length);
    final = [...unscreened, ...done.slice(0, keepDone)].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }
  const dir = path.dirname(ledgerPath(monitorId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ledgerPath(monitorId), JSON.stringify(final, null, 2));
}

/** Append newly captured txs (dedupe by tx_id). Returns count actually added. */
export function appendMonitorTxs(monitorId: string, txs: Omit<MonitorTx, "kyt_status" | "retry_count" | "captured_at">[]): number {
  const ledger = loadMonitorTxs(monitorId);
  const seen = new Set(ledger.map((t) => t.tx_id));
  const now = new Date().toISOString();
  let added = 0;
  for (const tx of txs) {
    if (seen.has(tx.tx_id)) continue;
    seen.add(tx.tx_id);
    ledger.push({ ...tx, kyt_status: "pending", retry_count: 0, captured_at: now });
    added++;
  }
  if (added) saveMonitorTxs(monitorId, ledger);
  return added;
}

/** Update one ledger entry by tx_id (merge patch). */
export function updateMonitorTx(monitorId: string, txId: string, patch: Partial<MonitorTx>) {
  const ledger = loadMonitorTxs(monitorId);
  const idx = ledger.findIndex((t) => t.tx_id === txId);
  if (idx === -1) return;
  ledger[idx] = { ...ledger[idx], ...patch };
  saveMonitorTxs(monitorId, ledger);
}

/**
 * Txs due for screening this run: pending first, then errored ones with
 * retries left — oldest first so the backlog drains in order.
 */
export function txsDueForScreening(monitorId: string, limit: number): MonitorTx[] {
  const ledger = loadMonitorTxs(monitorId);
  return ledger
    .filter(
      (t) =>
        t.kyt_status === "pending" ||
        (t.kyt_status === "error" && t.retry_count < MAX_KYT_RETRIES),
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, limit);
}

/** Quick counts for run summaries / UI badges. */
export function ledgerStats(monitorId: string) {
  const ledger = loadMonitorTxs(monitorId);
  return {
    total: ledger.length,
    pending: ledger.filter((t) => t.kyt_status === "pending" || t.kyt_status === "error").length,
    screened: ledger.filter((t) => t.kyt_status === "screened").length,
    failed: ledger.filter((t) => t.kyt_status === "failed").length,
  };
}
