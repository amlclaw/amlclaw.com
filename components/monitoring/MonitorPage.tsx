"use client";

import { useState, useEffect, useCallback } from "react";
import PageGuide from "@/components/shared/PageGuide";
import { showToast, shortenAddr, formatTime } from "@/lib/utils";
import { detectChainFromAddress, detectChainFromTxId } from "@/lib/chain-detect";
import { explorerTxUrl, explorerAddressUrl } from "@/lib/explorers";
import { riskColorVar, riskLabel, riskSortRank } from "@/lib/risk-ui";
import type { MonitorTask, MonitorRun } from "@/lib/types";

const SCHEDULES = [
  { value: "every_1h", label: "Every 1 hour" },
  { value: "every_4h", label: "Every 4 hours" },
  { value: "every_8h", label: "Every 8 hours" },
  { value: "every_12h", label: "Every 12 hours" },
  { value: "every_24h", label: "Every 24 hours" },
];

interface MonitorPageProps {
  /** "address" — watch future txs (KYT per tx). "kyt" — periodic KYA of a tx counterparty. */
  type: "address" | "kyt";
}

export default function MonitorPage({ type }: MonitorPageProps) {
  const [monitors, setMonitors] = useState<MonitorTask[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<MonitorTask | null>(null);

  const load = useCallback(() => {
    fetch(`/api/monitors?type=${type}`)
      .then((r) => r.json())
      .then((data) => setMonitors(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [type]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const isAddress = type === "address";

  return (
    <div style={{ padding: "var(--sp-5) var(--sp-6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-2)" }}>
        <PageGuide
          pageKey={isAddress ? "monitoring-address" : "monitoring-kyt"}
          title={isAddress ? "Address Monitoring" : "KYT Monitoring"}
          description={
            isAddress
              ? "Watch an address's FUTURE transactions. Every new USDT/USDC transfer above the minimum amount is KYT-screened — receiving = in, sending = out."
              : "Watch the from/to counterparty of a transaction. Each cycle runs a KYA screen of that address and alerts when its risk level escalates."
          }
          tips={
            isAddress
              ? [
                  "Ethereum monitors USDT + USDC; Tron monitors USDT only",
                  "New transactions are pulled from Etherscan / TronGrid on your schedule",
                  "High/critical results trigger webhook alerts",
                ]
              : [
                  "Create from a KYT result ('Monitor from/to address') or by pasting a tx hash here",
                  "Each run re-screens the address with KYA and tracks risk trend",
                  "Escalation (risk level rises) always triggers an alert",
                ]
          }
        />
        <button className="btn btn-sm btn-primary" onClick={() => setCreateOpen(true)} style={{ flexShrink: 0 }}>
          + New Monitor
        </button>
      </div>

      {/* Monitor list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {monitors.length === 0 && (
          <div className="card" style={{ padding: "var(--sp-10)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            No {isAddress ? "address" : "KYT"} monitors yet. Click <strong>+ New Monitor</strong> to create one.
          </div>
        )}
        {monitors.map((m) => (
          <MonitorCard key={m.id} monitor={m} onChanged={load} onOpen={() => setSelected(m)} />
        ))}
      </div>

      {createOpen && (
        <CreateModal type={type} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />
      )}
      {selected && (
        selected.type === "address"
          ? <TxLedgerModal monitor={selected} onClose={() => setSelected(null)} />
          : <RunsModal monitor={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/* ── Monitor Card ── */

function MonitorCard({ monitor: m, onChanged, onOpen }: { monitor: MonitorTask; onChanged: () => void; onOpen: () => void }) {
  const [busy, setBusy] = useState(false);
  const summary = m.last_result_summary;

  const runNow = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/monitors/${m.id}/run`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Run failed");
      }
      showToast("Run started", "success");
      setTimeout(onChanged, 1500);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
    setBusy(false);
  };

  const toggle = async () => {
    setBusy(true);
    try {
      await fetch(`/api/monitors/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !m.enabled }),
      });
      onChanged();
    } catch { /* noop */ }
    setBusy(false);
  };

  const remove = async () => {
    if (!confirm(`Delete monitor "${m.name}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/monitors/${m.id}`, { method: "DELETE" });
      onChanged();
    } catch { /* noop */ }
    setBusy(false);
  };

  return (
    <div className="card" style={{ padding: "var(--sp-3) var(--sp-4)", opacity: m.enabled ? 1 : 0.6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-3)" }}>
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={onOpen}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{m.name}</span>
            {m.running && <span className="badge badge-warning">Running</span>}
            {!m.enabled && <span className="badge">Paused</span>}
            {m.type === "kyt" && m.last_risk_level && (
              <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: riskColorVar(m.last_risk_level) }}>
                {riskLabel(m.last_risk_level)}
              </span>
            )}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2, display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
            <span>{m.chain}</span>
            <span>&middot;</span>
            <span style={{ fontFamily: "var(--mono)" }}>
              <ChainLink kind="address" chain={m.chain} value={m.address} />
            </span>
            {m.type === "address" && m.tokens && (
              <>
                <span>&middot;</span>
                <span>{m.tokens.join("+")} ≥ {m.min_amount ?? 10}</span>
              </>
            )}
            {m.type === "kyt" && m.watch_side && m.origin_tx_id && (
              <>
                <span>&middot;</span>
                <span>watching {m.watch_side} of <ChainLink kind="tx" chain={m.chain} value={m.origin_tx_id} /></span>
              </>
            )}
            <span>&middot;</span>
            <span>{SCHEDULES.find((s) => s.value === m.schedule_preset)?.label || m.schedule}</span>
            {m.last_run_at && (
              <>
                <span>&middot;</span>
                <span>last {formatTime(m.last_run_at)}</span>
              </>
            )}
          </div>
          {summary && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 4, display: "flex", gap: "var(--sp-3)" }}>
              {m.type === "address" ? (
                <>
                  <span>{summary.new_txs} new tx{summary.new_txs !== 1 ? "s" : ""}</span>
                  <span>{summary.screened} screened</span>
                  {summary.skipped > 0 && <span>{summary.skipped} skipped</span>}
                </>
              ) : (
                <span>last KYA:</span>
              )}
              <span style={{ color: riskColorVar(summary.highest_risk), fontWeight: 700, textTransform: "uppercase" }}>
                {riskLabel(summary.highest_risk)}
              </span>
              {summary.flagged > 0 && <span style={{ color: "var(--danger)" }}>{summary.flagged} flagged</span>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "var(--sp-1)", flexShrink: 0 }}>
          <button className="btn btn-sm btn-secondary" onClick={runNow} disabled={busy || m.running}>
            Run now
          </button>
          <button className="btn btn-sm btn-secondary" onClick={toggle} disabled={busy}>
            {m.enabled ? "Pause" : "Resume"}
          </button>
          <button className="btn btn-sm btn-secondary" onClick={remove} disabled={busy} style={{ color: "var(--danger)" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Create Modal ── */

function CreateModal({ type, onClose, onCreated }: { type: "address" | "kyt"; onClose: () => void; onCreated: () => void }) {
  const [chain, setChain] = useState("Tron");
  const [address, setAddress] = useState("");
  const [txId, setTxId] = useState("");
  const [watchSide, setWatchSide] = useState<"from" | "to">("from");
  const [minAmount, setMinAmount] = useState("10");
  const [schedule, setSchedule] = useState("every_4h");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const isAddress = type === "address";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        type,
        chain,
        name: name.trim(),
        schedule_preset: schedule,
      };
      if (isAddress) {
        body.address = address.trim();
        body.min_amount = parseFloat(minAmount) || 1;
      } else {
        body.tx_id = txId.trim();
        body.watch_side = watchSide;
      }
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create monitor");
      }
      showToast("Monitor created", "success");
      onCreated();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>{isAddress ? "New Address Monitor" : "New KYT Monitor"}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{ padding: "var(--sp-4)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            <div>
              <label className="label">Chain</label>
              <select className="input" value={chain} onChange={(e) => setChain(e.target.value)}>
                <option value="Tron">Tron (USDT)</option>
                <option value="Ethereum">Ethereum (USDT + USDC)</option>
              </select>
            </div>

            {isAddress ? (
              <>
                <div>
                  <label className="label">Address to watch</label>
                  <input
                    className="input"
                    value={address}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAddress(v);
                      const detected = detectChainFromAddress(v);
                      if (detected) setChain(detected);
                    }}
                    placeholder="Blockchain address"
                    required
                  />
                </div>
                <div>
                  <label className="label">Minimum transfer amount (token units)</label>
                  <input className="input" type="number" min="0" step="any" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                  <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                    Only transfers ≥ this amount are screened. Screening starts from NOW — history is not scanned.
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Transaction hash</label>
                  <input
                    className="input"
                    value={txId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTxId(v);
                      const detected = detectChainFromTxId(v);
                      if (detected) setChain(detected);
                    }}
                    placeholder="Tx hash"
                    required
                  />
                </div>
                <div>
                  <label className="label">Watch side</label>
                  <select className="input" value={watchSide} onChange={(e) => setWatchSide(e.target.value as "from" | "to")}>
                    <option value="from">from — the sender address</option>
                    <option value="to">to — the recipient address</option>
                  </select>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                    The selected side is resolved from the tx and KYA-screened on every cycle.
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="label">Schedule</label>
              <select className="input" value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                {SCHEDULES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Name (optional)</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-generated if empty" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create Monitor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Time helper ── */

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

/* ── Tx Ledger Modal (address monitors) — tronscan-style table ── */

interface LedgerTx {
  tx_id: string;
  block_number: number;
  timestamp: number;
  from: string;
  to: string;
  token: string;
  amount: number;
  direction: "in" | "out";
  kyt_status: "pending" | "screened" | "error" | "failed";
  retry_count: number;
  risk_level?: string;
  job_id?: string;
  error?: string;
}

const TIME_PRESETS = [
  { value: "all", label: "All time" },
  { value: "1h", label: "Last 1h" },
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7 days" },
  { value: "custom", label: "Custom…" },
] as const;

const RISK_FILTERS = [
  { value: "all", label: "All" },
  { value: "flagged", label: "Flagged" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "clean", label: "Clean" },
  { value: "queued", label: "Queued" },
] as const;

function TxLedgerModal({ monitor, onClose }: { monitor: MonitorTask; onClose: () => void }) {
  const [tab, setTab] = useState<"txs" | "runs">("txs");
  const [txs, setTxs] = useState<LedgerTx[]>([]);
  const [stats, setStats] = useState<{ total: number; pending: number; screened: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<(typeof RISK_FILTERS)[number]["value"]>("all");
  const [timePreset, setTimePreset] = useState<(typeof TIME_PRESETS)[number]["value"]>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const load = useCallback(() => {
    fetch(`/api/monitors/${monitor.id}/txs`)
      .then((r) => r.json())
      .then((data) => {
        setTxs(Array.isArray(data.txs) ? data.txs : []);
        setStats(data.stats ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monitor.id]);

  useEffect(() => { load(); }, [load]);

  // ── Time-range filter ──
  const now = Date.now();
  const rangeStart =
    timePreset === "1h" ? now - 3_600_000
    : timePreset === "24h" ? now - 86_400_000
    : timePreset === "7d" ? now - 7 * 86_400_000
    : timePreset === "custom" && customFrom ? new Date(customFrom).getTime()
    : 0;
  const rangeEnd = timePreset === "custom" && customTo ? new Date(customTo).getTime() : now + 60_000;
  const inRange = txs.filter((t) => t.timestamp >= rangeStart && t.timestamp <= rangeEnd);

  // ── Period analysis (over the time-filtered set, before risk filter) ──
  const byRisk = { critical: 0, high: 0, medium: 0, low: 0 };
  let screenedCount = 0, queuedCount = 0, failedCount = 0, inCount = 0, outCount = 0, volume = 0;
  for (const t of inRange) {
    volume += t.amount;
    if (t.direction === "in") inCount++; else outCount++;
    if (t.kyt_status === "screened") {
      screenedCount++;
      const r = (t.risk_level || "low") as keyof typeof byRisk;
      if (r in byRisk) byRisk[r]++;
    } else if (t.kyt_status === "failed") failedCount++;
    else queuedCount++;
  }

  // ── Risk filter ──
  const filtered = inRange.filter((t) => {
    switch (riskFilter) {
      case "flagged": return t.kyt_status === "screened" && ["critical", "high"].includes(t.risk_level || "");
      case "critical": return t.kyt_status === "screened" && t.risk_level === "critical";
      case "high": return t.kyt_status === "screened" && t.risk_level === "high";
      case "clean": return t.kyt_status === "screened" && ["low", "medium"].includes(t.risk_level || "low");
      case "queued": return t.kyt_status !== "screened";
      default: return true;
    }
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 980, width: "94vw", maxHeight: "84vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", minWidth: 0 }}>
            <span className="truncate">{monitor.name}</span>
            <div className="tab-bar" style={{ width: "auto", flexShrink: 0 }}>
              <button className={`tab-btn ${tab === "txs" ? "active" : ""}`} onClick={() => setTab("txs")}>Transactions</button>
              <button className={`tab-btn ${tab === "runs" ? "active" : ""}`} onClick={() => setTab("runs")}>Runs</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
            <button className="btn-icon" onClick={load} title="Refresh">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        {tab === "txs" ? (
          <div style={{ overflowY: "auto", padding: "var(--sp-3) var(--sp-4)" }}>
            {/* ── Filters ── */}
            <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center", flexWrap: "wrap", marginBottom: "var(--sp-3)" }}>
              <div className="tab-bar" style={{ width: "auto" }}>
                {RISK_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    className={`tab-btn ${riskFilter === f.value ? "active" : ""}`}
                    onClick={() => setRiskFilter(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <select
                className="input input-sm"
                style={{ width: "auto" }}
                value={timePreset}
                onChange={(e) => setTimePreset(e.target.value as (typeof TIME_PRESETS)[number]["value"])}
              >
                {TIME_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {timePreset === "custom" && (
                <>
                  <input type="datetime-local" className="input input-sm" style={{ width: "auto" }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>→</span>
                  <input type="datetime-local" className="input input-sm" style={{ width: "auto" }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </>
              )}
            </div>

            {/* ── Period analysis ── */}
            <div className="card" style={{ padding: "var(--sp-2) var(--sp-3)", marginBottom: "var(--sp-3)", background: "var(--surface-2)" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", alignItems: "center" }}>
                <span>
                  <strong>{inRange.length}</strong> tx{inRange.length !== 1 ? "s" : ""} in period
                </span>
                <span style={{ color: "var(--text-tertiary)" }}>
                  ⬇ {inCount} in · ⬆ {outCount} out · {volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} total
                </span>
                <span style={{ color: "var(--text-tertiary)" }}>|</span>
                <span style={{ color: "var(--success)" }}>{screenedCount} screened</span>
                {byRisk.critical > 0 && <span style={{ color: "var(--risk-severe)", fontWeight: 700 }}>{byRisk.critical} critical</span>}
                {byRisk.high > 0 && <span style={{ color: "var(--risk-high)", fontWeight: 700 }}>{byRisk.high} high</span>}
                {byRisk.medium > 0 && <span style={{ color: "var(--risk-medium)" }}>{byRisk.medium} medium</span>}
                {(byRisk.low > 0) && <span style={{ color: "var(--risk-low)" }}>{byRisk.low} clean/low</span>}
                {queuedCount > 0 && <span style={{ color: "var(--warning)" }}>{queuedCount} queued</span>}
                {failedCount > 0 && <span style={{ color: "var(--danger)" }}>{failedCount} failed</span>}
                {stats && stats.total > txs.length && (
                  <span style={{ color: "var(--text-tertiary)" }}>(showing latest {txs.length} of {stats.total})</span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="spinner spinner-lg" style={{ margin: "var(--sp-8) auto" }} />
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)", padding: "var(--sp-8)" }}>
                {txs.length === 0
                  ? "No transactions captured yet — new transfers appear here after the next run."
                  : "No transactions match the current filters."}
              </div>
            ) : (
              <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Txn Hash</th>
                    <th>Age</th>
                    <th>From</th>
                    <th></th>
                    <th>To</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Token</th>
                    <th>KYT Result</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => (
                    <TxRow key={tx.tx_id} tx={tx} monitorAddress={monitor.address} chain={monitor.chain} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div style={{ padding: "var(--sp-4)", overflowY: "auto" }}>
            <RunsList monitor={monitor} />
          </div>
        )}
      </div>
    </div>
  );
}

/** External explorer link + in-app screening shortcut for a hash or address. */
function ChainLink({
  kind, chain, value, highlight,
}: { kind: "tx" | "address"; chain: string; value: string; highlight?: boolean }) {
  const explorerUrl = kind === "tx" ? explorerTxUrl(chain, value) : explorerAddressUrl(chain, value);
  const screenUrl = kind === "tx"
    ? `/kyt?tx=${encodeURIComponent(value)}&chain=${chain}`
    : `/screening?address=${encodeURIComponent(value)}&chain=${chain}`;
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener"
        onClick={(e) => e.stopPropagation()}
        title={`View on ${chain === "Tron" ? "Tronscan" : "Etherscan"}`}
        style={{ color: highlight ? "var(--primary-500)" : "var(--text-secondary)", textDecoration: "none" }}
        onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
        onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
      >
        {shortenAddr(value)}
      </a>
      <a
        href={screenUrl}
        onClick={(e) => e.stopPropagation()}
        title={kind === "tx" ? "Screen in Tx Screening (KYT)" : "Screen in Address Screening (KYA)"}
        style={{ marginLeft: 4, textDecoration: "none", opacity: 0.7 }}
      >
        🔍
      </a>
    </span>
  );
}

/** One ledger row + expandable KYT detail (alerts list from the linked job). */
function TxRow({ tx, monitorAddress, chain }: { tx: LedgerTx; monitorAddress: string; chain: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && tx.job_id && !detail) {
      setDetailLoading(true);
      fetch(`/api/kyt/${tx.job_id}`)
        .then((r) => r.json())
        .then(setDetail)
        .catch(() => {})
        .finally(() => setDetailLoading(false));
    }
  };

  const kytCell = tx.kyt_status === "screened" ? (
    <span style={{ color: riskColorVar(tx.risk_level || "low"), fontWeight: 700, textTransform: "uppercase" }}>
      {riskLabel(tx.risk_level || "low")}
    </span>
  ) : tx.kyt_status === "pending" ? (
    <span style={{ color: "var(--warning)" }}>Queued</span>
  ) : tx.kyt_status === "error" ? (
    <span style={{ color: "var(--warning)" }} title={tx.error}>Retry {tx.retry_count}/3</span>
  ) : (
    <span style={{ color: "var(--danger)" }} title={tx.error}>Failed</span>
  );

  // Sort by severity desc — the API returns alerts unsorted, and the top-10
  // slice must show the worst findings first (a hidden critical looked like
  // an all-medium result before this).
  const alerts = (((detail?.result as Record<string, unknown> | undefined)?.alerts as Record<string, unknown>[] | undefined) ?? [])
    .slice()
    .sort((a, b) => riskSortRank(String(b.alertLevel)) - riskSortRank(String(a.alertLevel)));

  return (
    <>
      <tr onClick={toggle} style={{ cursor: "pointer" }}>
        <td style={{ width: 20 }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "" }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </td>
        <td style={{ fontFamily: "var(--mono)" }}>
          <ChainLink kind="tx" chain={chain} value={tx.tx_id} />
        </td>
        <td style={{ whiteSpace: "nowrap" }} title={new Date(tx.timestamp).toLocaleString()}>{relTime(tx.timestamp)}</td>
        <td style={{ fontFamily: "var(--mono)" }}>
          <ChainLink kind="address" chain={chain} value={tx.from} highlight={tx.from === monitorAddress} />
        </td>
        <td style={{ color: tx.direction === "in" ? "var(--success)" : "var(--risk-high)", fontWeight: 700 }}>
          {tx.direction === "in" ? "⬇" : "⬆"}
        </td>
        <td style={{ fontFamily: "var(--mono)" }}>
          <ChainLink kind="address" chain={chain} value={tx.to} highlight={tx.to === monitorAddress} />
        </td>
        <td style={{ fontFamily: "var(--mono)", textAlign: "right" }}>{tx.amount.toLocaleString()}</td>
        <td>{tx.token}</td>
        <td>{kytCell}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9} style={{ background: "var(--surface-1)", padding: "var(--sp-3)" }}>
            {tx.kyt_status !== "screened" ? (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                {tx.kyt_status === "pending" && "Waiting for the next monitor run to screen this transaction."}
                {tx.kyt_status === "error" && `Last attempt failed (${tx.error}) — will retry automatically.`}
                {tx.kyt_status === "failed" && `Screening failed after ${tx.retry_count} attempts: ${tx.error}`}
              </div>
            ) : detailLoading ? (
              <div className="spinner" style={{ margin: "var(--sp-2) auto" }} />
            ) : alerts.length === 0 ? (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--success)" }}>
                ✓ No alerts — transaction clean under the applied KYT ruleset.
              </div>
            ) : (
              <table className="data-table" style={{ fontSize: "0.65rem" }}>
                <thead>
                  <tr>
                    <th>Level</th><th>Category</th><th>Exposure</th><th>Amount</th><th>Rule</th><th>Counterparty</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.slice(0, 10).map((a, i) => (
                    <tr key={i}>
                      <td><span style={{ color: riskColorVar(String(a.alertLevel)), fontWeight: 700, textTransform: "uppercase" }}>{riskLabel(String(a.alertLevel))}</span></td>
                      <td>{String(a.category ?? "")}</td>
                      <td>{String(a.exposureType ?? "")}{a.hops ? ` · ${a.hops}h` : ""}</td>
                      <td style={{ fontFamily: "var(--mono)" }}>{Number(a.alertAmount ?? 0).toLocaleString()}</td>
                      <td style={{ fontFamily: "var(--mono)" }}>{String(a.categoryId ?? "")}</td>
                      <td style={{ fontFamily: "var(--mono)" }}>
                        {a.opponentAddress ? <ChainLink kind="address" chain={chain} value={String(a.opponentAddress)} /> : "-"}
                      </td>
                      <td>{String(a.action ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tx.job_id && alerts.length > 10 && (
              <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: 4 }}>
                Showing first 10 of {alerts.length} alerts — open the full report from Tx Screening history (job {tx.job_id}).
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Runs Modal (kyt monitors) ── */

function RunsModal({ monitor, onClose }: { monitor: MonitorTask; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Run History — {monitor.name}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "var(--sp-4)", overflowY: "auto" }}>
          <RunsList monitor={monitor} />
        </div>
      </div>
    </div>
  );
}

function RunsList({ monitor }: { monitor: MonitorTask }) {
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/monitors/${monitor.id}/history`)
      .then((r) => r.json())
      .then((data) => setRuns(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monitor.id]);

  return (
    <div>
          {loading && <div className="spinner" style={{ margin: "var(--sp-4) auto" }} />}
          {!loading && runs.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)", padding: "var(--sp-6)" }}>
              No runs yet. Click <strong>Run now</strong> on the monitor to trigger one.
            </div>
          )}
          {runs.map((run) => (
            <div key={run.run_id} style={{ borderBottom: "1px solid var(--border-subtle)", padding: "var(--sp-2) 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)" }}>
                <span style={{ color: "var(--text-secondary)" }}>
                  {formatTime(run.started_at)} · {run.trigger}
                </span>
                <span className={`badge ${run.status === "completed" ? "badge-success" : run.status === "error" ? "badge-danger" : "badge-warning"}`}>
                  {run.status}
                </span>
              </div>
              {run.summary && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2, display: "flex", gap: "var(--sp-3)" }}>
                  {monitor.type === "address" ? (
                    <>
                      <span>{run.summary.new_txs} new</span>
                      <span>{run.summary.screened} screened</span>
                      {run.summary.skipped > 0 && <span>{run.summary.skipped} skipped</span>}
                    </>
                  ) : null}
                  <span style={{ color: riskColorVar(run.summary.highest_risk), fontWeight: 700, textTransform: "uppercase" }}>
                    {riskLabel(run.summary.highest_risk)}
                  </span>
                  {run.summary.flagged > 0 && <span style={{ color: "var(--danger)" }}>{run.summary.flagged} flagged</span>}
                </div>
              )}
              {/* Per-result rows */}
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                {(run.results || []).map((res, i) => (
                  <div key={i} style={{ fontSize: "0.65rem", fontFamily: "var(--mono)", color: "var(--text-tertiary)", display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                    {res.status === "error" ? (
                      <span style={{ color: "var(--danger)" }}>✗ {res.error}</span>
                    ) : res.status === "skipped" ? (
                      <span>⏭ {shortenAddr(res.tx_id || "")} skipped (over per-run cap)</span>
                    ) : monitor.type === "address" ? (
                      <>
                        <span>{res.direction === "in" ? "⬇ in" : "⬆ out"}</span>
                        <span>{res.amount} {res.token}</span>
                        {res.tx_id && <ChainLink kind="tx" chain={monitor.chain} value={res.tx_id} />}
                        <span style={{ color: riskColorVar(res.risk_level || "low"), fontWeight: 700 }}>
                          {riskLabel(res.risk_level || "low")}
                        </span>
                        {res.job_id && (
                          <a href={`/kyt?job=${res.job_id}`} style={{ color: "var(--primary-500)" }}>view</a>
                        )}
                      </>
                    ) : (
                      <>
                        <span>KYA</span>
                        {res.address && <ChainLink kind="address" chain={monitor.chain} value={res.address} />}
                        <span style={{ color: riskColorVar(res.risk_level || "low"), fontWeight: 700 }}>
                          {riskLabel(res.risk_level || "low")}
                        </span>
                        {res.job_id && (
                          <a href={`/screening?job=${res.job_id}`} style={{ color: "var(--primary-500)" }}>view</a>
                        )}
                        {res.escalated && <span style={{ color: "var(--danger)" }}>▲ escalated from {res.previous_risk_level}</span>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
    </div>
  );
}
