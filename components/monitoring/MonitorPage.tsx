"use client";

import { useState, useEffect, useCallback } from "react";
import PageGuide from "@/components/shared/PageGuide";
import { showToast, shortenAddr, formatTime } from "@/lib/utils";
import { detectChainFromAddress, detectChainFromTxId } from "@/lib/chain-detect";
import { riskColorVar, riskLabel } from "@/lib/risk-ui";
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
        <RunsModal monitor={selected} onClose={() => setSelected(null)} />
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
            <span style={{ fontFamily: "var(--mono)" }}>{shortenAddr(m.address)}</span>
            {m.type === "address" && m.tokens && (
              <>
                <span>&middot;</span>
                <span>{m.tokens.join("+")} ≥ {m.min_amount ?? 1}</span>
              </>
            )}
            {m.type === "kyt" && m.watch_side && (
              <>
                <span>&middot;</span>
                <span>watching {m.watch_side} of {shortenAddr(m.origin_tx_id || "")}</span>
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
  const [minAmount, setMinAmount] = useState("1");
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

/* ── Runs Modal ── */

function RunsModal({ monitor, onClose }: { monitor: MonitorTask; onClose: () => void }) {
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Run History — {monitor.name}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "var(--sp-4)", overflowY: "auto" }}>
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
                        <span>{shortenAddr(res.tx_id || "")}</span>
                        <span style={{ color: riskColorVar(res.risk_level || "low"), fontWeight: 700 }}>
                          {riskLabel(res.risk_level || "low")}
                        </span>
                        {res.job_id && (
                          <a href={`/screening?job=${res.job_id}`} style={{ color: "var(--primary-500)" }}>view</a>
                        )}
                      </>
                    ) : (
                      <>
                        <span>KYA {shortenAddr(res.address || "")}</span>
                        <span style={{ color: riskColorVar(res.risk_level || "low"), fontWeight: 700 }}>
                          {riskLabel(res.risk_level || "low")}
                        </span>
                        {res.escalated && <span style={{ color: "var(--danger)" }}>▲ escalated from {res.previous_risk_level}</span>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
