"use client";

import { useState, useEffect, useCallback } from "react";
import PageGuide from "@/components/shared/PageGuide";
import { showToast, shortenAddr, formatTime } from "@/lib/utils";
import { detectChainFromAddress, detectChainFromTxId } from "@/lib/chain-detect";
import { explorerTxUrl, explorerAddressUrl } from "@/lib/explorers";
import { riskColorVar, riskLabel, riskSortRank, verdictColorVar, verdictZh } from "@/lib/risk-ui";
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
  const [editTarget, setEditTarget] = useState<MonitorTask | null>(null);
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
          title={isAddress ? "地址监控 Address Monitoring" : "TX 监控 TX Monitoring"}
          description={
            isAddress
              ? "盯防一个地址「加入监控之后」发生的每一笔交易 —— 添加后按你设定的周期，从 Etherscan / TronGrid 拉取该地址的新增稳定币转账，对每一笔（金额达标的）自动做 KYT 查询：收款按 in 方向、付款按 out 方向，及时发现它与高风险地址之间的资金往来。"
              : "盯防一笔交易的对手方地址「本身的风险标签变化」—— 从交易解析出 from 或 to 地址，按你设定的周期对它反复做 KYA 复筛，跟踪风险等级走势；一旦该地址被打上 Sanctions（制裁）/ Freeze（冻结）等标签、或风险等级升高，第一时间告警。"
          }
          tips={
            isAddress
              ? [
                  "① 捕获：每周期从 Etherscan（ETH：USDT+USDC）/ TronGrid（Tron：仅 USDT）拉取新交易，游标从「加入监控的时刻」起算，只看未来、不扫历史",
                  "② 筛查：金额 ≥ 阈值的新交易逐笔 KYT（追溯 1 跳、串行执行），全量入台账一笔不漏，失败自动重试",
                  "③ 告警：命中 high / critical 触发 Webhook；可按风险等级、时间区间筛选与统计",
                ]
              : [
                  "① 来源：从「交易筛查」结果一键「监控 from / to 地址」，或在此直接粘贴交易哈希并选监控侧",
                  "② 复筛：每周期对该地址做一次 KYA（滚动时间窗，只看上次检测以来的活动），几秒出结果",
                  "③ 告警：风险等级升高（如 low→critical）或涉及制裁 / 冻结标签立即告警，历史趋势可回溯",
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
          <MonitorCard key={m.id} monitor={m} onChanged={load} onOpen={() => setSelected(m)} onEdit={() => setEditTarget(m)} />
        ))}
      </div>

      {(createOpen || editTarget) && (
        <CreateModal
          type={type}
          editing={editTarget}
          onClose={() => { setCreateOpen(false); setEditTarget(null); }}
          onCreated={() => { setCreateOpen(false); setEditTarget(null); load(); }}
        />
      )}
      {selected && (
        selected.type === "address"
          ? <TxLedgerModal monitor={selected} onClose={() => setSelected(null)} />
          : <KyaLedgerModal monitor={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/* ── Monitor Card ── */

function MonitorCard({ monitor: m, onChanged, onOpen, onEdit }: { monitor: MonitorTask; onChanged: () => void; onOpen: () => void; onEdit: () => void }) {
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
            {m.type === "kyt" && m.last_score != null ? (
              <span style={{ fontSize: "0.7rem", fontWeight: 800, fontFamily: "var(--mono)", color: verdictColorVar(m.last_verdict) }}>
                {m.last_score}分·{verdictZh(m.last_verdict)}
              </span>
            ) : m.type === "kyt" && m.last_risk_level ? (
              <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: riskColorVar(m.last_risk_level) }}>
                {riskLabel(m.last_risk_level)}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2, display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
            <span>{m.chain}</span>
            <span>&middot;</span>
            <span style={{ fontFamily: "var(--mono)", minWidth: 0 }}>
              <a
                href={explorerAddressUrl(m.chain, m.address)}
                target="_blank"
                rel="noopener"
                onClick={(e) => e.stopPropagation()}
                title={`在 ${m.chain === "Tron" ? "Tronscan" : "Etherscan"} 查看`}
                style={{ color: "var(--text-secondary)", textDecoration: "none", wordBreak: "break-all" }}
              >
                {m.address}
              </a>
              <a
                href={`/screening?address=${encodeURIComponent(m.address)}&chain=${m.chain}`}
                onClick={(e) => e.stopPropagation()}
                title="在地址筛查中打开"
                style={{ marginLeft: 4, textDecoration: "none", opacity: 0.7 }}
              >
                🔍
              </a>
            </span>
            {m.type === "address" && m.tokens && (
              <>
                <span>&middot;</span>
                <span>{m.tokens.join("+")} ≥ {m.min_amount ?? 10}</span>
                <span>&middot;</span>
                <span title="Server-side ruleset ids (0 = builtin default)">
                  rules in#{m.in_ruleset_id ?? 0} out#{m.out_ruleset_id ?? 0}
                </span>
              </>
            )}
            {m.type === "kyt" && m.watch_side && m.origin_tx_id && (
              <>
                <span>&middot;</span>
                <span
                  className="badge"
                  style={{
                    background: m.watch_side === "from" ? "var(--risk-high)" : "var(--success)",
                    color: "#000", fontWeight: 700, textTransform: "uppercase",
                  }}
                >
                  {m.watch_side === "from" ? "FROM" : "TO"}
                </span>
                <span style={{ minWidth: 0 }}>
                  of{" "}
                  <a
                    href={explorerTxUrl(m.chain, m.origin_tx_id)}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => e.stopPropagation()}
                    title={`在 ${m.chain === "Tron" ? "Tronscan" : "Etherscan"} 查看`}
                    style={{ fontFamily: "var(--mono)", color: "var(--text-secondary)", textDecoration: "none", wordBreak: "break-all" }}
                  >
                    {m.origin_tx_id}
                  </a>
                  <a
                    href={`/kyt?tx=${encodeURIComponent(m.origin_tx_id)}&chain=${m.chain}`}
                    onClick={(e) => e.stopPropagation()}
                    title="在交易筛查中打开"
                    style={{ marginLeft: 4, textDecoration: "none", opacity: 0.7 }}
                  >
                    🔍
                  </a>
                </span>
                <span>&middot;</span>
                <span title="Server-side KYA ruleset id (0 = builtin default)">rules #{m.kya_ruleset_id ?? 0}</span>
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
          <button className="btn btn-sm btn-secondary" onClick={onEdit} disabled={busy}>
            Edit
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

function CreateModal({ type, editing, onClose, onCreated }: { type: "address" | "kyt"; editing?: MonitorTask | null; onClose: () => void; onCreated: () => void }) {
  const isEdit = !!editing;
  const [chain, setChain] = useState(editing?.chain ?? "Tron");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [txId, setTxId] = useState(editing?.origin_tx_id ?? "");
  const [watchSide, setWatchSide] = useState<"from" | "to">(editing?.watch_side ?? "from");
  const [minAmount, setMinAmount] = useState(String(editing?.min_amount ?? 10));
  const [schedule, setSchedule] = useState(editing?.schedule_preset ?? "every_4h");
  const [name, setName] = useState(editing?.name ?? "");
  // Server-side ruleset ids (0 = builtin default — usually too broad; teams
  // create their own rulesets on width.info and reference the id here)
  const [inRulesetId, setInRulesetId] = useState(String(editing?.in_ruleset_id ?? 0));
  const [outRulesetId, setOutRulesetId] = useState(String(editing?.out_ruleset_id ?? 0));
  const [kyaRulesetId, setKyaRulesetId] = useState(String(editing?.kya_ruleset_id ?? 0));
  const [saving, setSaving] = useState(false);

  const isAddress = type === "address";

  // New monitors default to the global ruleset ids from Settings
  useEffect(() => {
    if (isEdit) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s?.screening) {
          setInRulesetId(String(s.screening.defaultKytInRulesetId ?? 0));
          setOutRulesetId(String(s.screening.defaultKytOutRulesetId ?? 0));
          setKyaRulesetId(String(s.screening.defaultKyaRulesetId ?? 0));
        }
      })
      .catch(() => {});
  }, [isEdit]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit && editing) {
        // Editable subset: identity fields (chain/address/tx) stay fixed
        const body: Record<string, unknown> = {
          name: name.trim() || editing.name,
          schedule_preset: schedule,
        };
        if (isAddress) {
          body.min_amount = parseFloat(minAmount) || 10;
          body.in_ruleset_id = parseInt(inRulesetId) || 0;
          body.out_ruleset_id = parseInt(outRulesetId) || 0;
        } else {
          body.kya_ruleset_id = parseInt(kyaRulesetId) || 0;
        }
        const res = await fetch(`/api/monitors/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to update monitor");
        }
        showToast("Monitor updated", "success");
      } else {
        const body: Record<string, unknown> = {
          type,
          chain,
          name: name.trim(),
          schedule_preset: schedule,
        };
        if (isAddress) {
          body.address = address.trim();
          body.min_amount = parseFloat(minAmount) || 10;
          body.in_ruleset_id = parseInt(inRulesetId) || 0;
          body.out_ruleset_id = parseInt(outRulesetId) || 0;
        } else {
          body.tx_id = txId.trim();
          body.watch_side = watchSide;
          body.kya_ruleset_id = parseInt(kyaRulesetId) || 0;
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
      }
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
          <span>{isEdit ? `Edit — ${editing?.name}` : isAddress ? "New Address Monitor" : "New KYT Monitor"}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{ padding: "var(--sp-4)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            <div>
              <label className="label">Chain</label>
              <select className="input" value={chain} onChange={(e) => setChain(e.target.value)} disabled={isEdit}>
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
                    disabled={isEdit}
                  />
                </div>
                <div>
                  <label className="label">Minimum transfer amount (token units)</label>
                  <input className="input" type="number" min="0" step="any" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                  <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                    Only transfers ≥ this amount are screened. Screening starts from NOW — history is not scanned.
                  </div>
                </div>
                <div style={{ display: "flex", gap: "var(--sp-3)" }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">KYT-IN Ruleset ID</label>
                    <input className="input" type="number" min={0} value={inRulesetId} onChange={(e) => setInRulesetId(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">KYT-OUT Ruleset ID</label>
                    <input className="input" type="number" min={0} value={outRulesetId} onChange={(e) => setOutRulesetId(e.target.value)} />
                  </div>
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: -6 }}>
                  0 = builtin default (broad). Use your own ruleset IDs from{" "}
                  <a href="https://width.info" target="_blank" rel="noopener" style={{ color: "var(--primary-500)" }}>width.info</a>
                  {" "}→ Compliance → Rulesets. Incoming txs use IN, outgoing use OUT.
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
                    disabled={isEdit}
                  />
                </div>
                <div>
                  <label className="label">Watch side</label>
                  <select className="input" value={watchSide} onChange={(e) => setWatchSide(e.target.value as "from" | "to")} disabled={isEdit}>
                    <option value="from">from — the sender address</option>
                    <option value="to">to — the recipient address</option>
                  </select>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                    The selected side is resolved from the tx and KYA-screened on every cycle.
                  </div>
                </div>
                <div>
                  <label className="label">KYA Ruleset ID</label>
                  <input className="input" type="number" min={0} value={kyaRulesetId} onChange={(e) => setKyaRulesetId(e.target.value)} />
                  <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: 2 }}>
                    0 = builtin default (broad). Use your own ruleset ID from width.info → Compliance → Rulesets.
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
  score?: number | null;
  verdict?: string | null;
  /** Risk categories (Sanctions / Cybercrime / …) hit by the screen. */
  categories?: string[];
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
  // Clock snapshot — refreshed on load/refresh, never read during render
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    fetch(`/api/monitors/${monitor.id}/txs`)
      .then((r) => r.json())
      .then((data) => {
        setNow(Date.now());
        setTxs(Array.isArray(data.txs) ? data.txs : []);
        setStats(data.stats ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monitor.id]);

  useEffect(() => { load(); }, [load]);

  // ── Time-range filter ──
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
            {/* ── 被监控地址 ── */}
            <div className="card" style={{ padding: "var(--sp-3)", marginBottom: "var(--sp-3)", background: "var(--surface-2)" }}>
              <div style={{ fontSize: "0.6rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                监控地址 Watched Address
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)", wordBreak: "break-all", color: "var(--primary-500)" }}>
                <a href={explorerAddressUrl(monitor.chain, monitor.address)} target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "none" }}>
                  {monitor.address}
                </a>
                <a href={`/screening?address=${encodeURIComponent(monitor.address)}&chain=${monitor.chain}`} style={{ marginLeft: 6, textDecoration: "none" }} title="在地址筛查中打开">🔍</a>
              </div>
              <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginTop: "var(--sp-2)", paddingTop: "var(--sp-2)", borderTop: "1px solid var(--border-subtle)", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                <span>{monitor.chain}</span>
                <span>&middot;</span>
                <span>{(monitor.tokens ?? []).join("+")} ≥ {monitor.min_amount ?? 10}</span>
                <span>&middot;</span>
                <span>周期：{SCHEDULES.find((s) => s.value === monitor.schedule_preset)?.label || monitor.schedule}</span>
                <span>&middot;</span>
                <span>KYT 规则集 in#{monitor.in_ruleset_id ?? 0} out#{monitor.out_ruleset_id ?? 0}</span>
                <span>&middot;</span>
                <span>追溯 1 跳</span>
                {monitor.last_run_at && (
                  <>
                    <span>&middot;</span>
                    <span>上次 {formatTime(monitor.last_run_at)}</span>
                  </>
                )}
                {monitor.next_run_at && (
                  <>
                    <span>&middot;</span>
                    <span>下次 {formatTime(monitor.next_run_at)}</span>
                  </>
                )}
                {!monitor.enabled && <span style={{ color: "var(--warning)" }}>· 已暂停</span>}
              </div>
            </div>

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

  // Dual-signal cell: rule-level risk (what flags sanctions etc.) is ALWAYS
  // visible, with the fund score as the secondary number — a low score must
  // not hide a critical exposure.
  const kytCell = tx.kyt_status === "screened" ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ color: riskColorVar(tx.risk_level || "low"), fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>
          {riskLabel(tx.risk_level || "low")}
        </span>
        {tx.score != null && (
          <span style={{ color: verdictColorVar(tx.verdict), fontWeight: 600, fontFamily: "var(--mono)" }}>
            {tx.score}分·{verdictZh(tx.verdict)}
          </span>
        )}
      </div>
      {tx.categories && tx.categories.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {tx.categories.map((c) => (
            <span
              key={c}
              className="risk-pill"
              style={{
                fontSize: "0.58rem", fontWeight: 700, padding: "1px 5px",
                color: riskColorVar(tx.risk_level || "low"),
                border: `1px solid ${riskColorVar(tx.risk_level || "low")}`,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
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

/* ── KYA Ledger Modal (kyt monitors) — same shape as the address ledger ── */

interface KyaScan {
  /** run completion time (ms) */
  timestamp: number;
  address: string;
  risk_level: string;
  previous_risk_level?: string;
  escalated?: boolean;
  job_id?: string;
  status: "completed" | "error" | "skipped";
  error?: string;
  trigger: string;
  score?: number | null;
  verdict?: string | null;
  /** Risk categories (Sanctions / Cybercrime / …) hit by the screen. */
  categories?: string[];
}

function KyaLedgerModal({ monitor, onClose }: { monitor: MonitorTask; onClose: () => void }) {
  const [tab, setTab] = useState<"scans" | "runs">("scans");
  const [scans, setScans] = useState<KyaScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<(typeof RISK_FILTERS)[number]["value"]>("all");
  const [timePreset, setTimePreset] = useState<(typeof TIME_PRESETS)[number]["value"]>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    fetch(`/api/monitors/${monitor.id}/history`)
      .then((r) => r.json())
      .then((runs: MonitorRun[]) => {
        setNow(Date.now());
        const rows: KyaScan[] = [];
        for (const run of Array.isArray(runs) ? runs : []) {
          const ts = new Date(run.completed_at || run.started_at).getTime();
          for (const res of run.results || []) {
            rows.push({
              timestamp: ts,
              address: res.address || monitor.address,
              risk_level: res.risk_level || "low",
              score: (res as { score?: number | null }).score ?? null,
              verdict: (res as { verdict?: string | null }).verdict ?? null,
              categories: (res as { categories?: string[] }).categories,
              previous_risk_level: res.previous_risk_level,
              escalated: res.escalated,
              job_id: res.job_id,
              status: res.status,
              error: res.error,
              trigger: run.trigger,
            });
          }
        }
        rows.sort((a, b) => b.timestamp - a.timestamp);
        setScans(rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monitor.id, monitor.address]);

  useEffect(() => { load(); }, [load]);

  // ── Time-range filter ──
  const rangeStart =
    timePreset === "1h" ? now - 3_600_000
    : timePreset === "24h" ? now - 86_400_000
    : timePreset === "7d" ? now - 7 * 86_400_000
    : timePreset === "custom" && customFrom ? new Date(customFrom).getTime()
    : 0;
  const rangeEnd = timePreset === "custom" && customTo ? new Date(customTo).getTime() : now + 60_000;
  const inRange = scans.filter((s) => s.timestamp >= rangeStart && s.timestamp <= rangeEnd);

  // ── Period analysis ──
  const byRisk = { critical: 0, high: 0, medium: 0, low: 0 };
  let okCount = 0, errCount = 0, escalations = 0;
  for (const s of inRange) {
    if (s.status === "completed") {
      okCount++;
      const r = (s.risk_level || "low") as keyof typeof byRisk;
      if (r in byRisk) byRisk[r]++;
      if (s.escalated) escalations++;
    } else errCount++;
  }

  // ── Risk filter ──
  const filtered = inRange.filter((s) => {
    switch (riskFilter) {
      case "flagged": return s.status === "completed" && ["critical", "high"].includes(s.risk_level);
      case "critical": return s.status === "completed" && s.risk_level === "critical";
      case "high": return s.status === "completed" && s.risk_level === "high";
      case "clean": return s.status === "completed" && ["low", "medium"].includes(s.risk_level);
      case "queued": return s.status !== "completed";
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
              <button className={`tab-btn ${tab === "scans" ? "active" : ""}`} onClick={() => setTab("scans")}>KYA Scans</button>
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

        {tab === "scans" ? (
          <div style={{ overflowY: "auto", padding: "var(--sp-3) var(--sp-4)" }}>
            {/* 被监控对象 —— 醒目展示：源交易 / 监控侧 / 被监控地址 */}
            <div className="card" style={{ padding: "var(--sp-3)", marginBottom: "var(--sp-3)", background: "var(--surface-2)" }}>
              <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, flex: "1 1 380px" }}>
                  <div style={{ fontSize: "0.6rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                    源交易 Origin Transaction
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)", wordBreak: "break-all" }}>
                    {monitor.origin_tx_id ? (
                      <>
                        <a
                          href={explorerTxUrl(monitor.chain, monitor.origin_tx_id)}
                          target="_blank"
                          rel="noopener"
                          style={{ color: "var(--text-secondary)", textDecoration: "none" }}
                        >
                          {monitor.origin_tx_id}
                        </a>
                        <a href={`/kyt?tx=${encodeURIComponent(monitor.origin_tx_id)}&chain=${monitor.chain}`} style={{ marginLeft: 6, textDecoration: "none" }} title="在交易筛查中打开">🔍</a>
                      </>
                    ) : "—"}
                  </div>
                </div>

                <div style={{ minWidth: 0, flex: "1 1 300px" }}>
                  <div style={{ fontSize: "0.6rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                    监控对象 Watched Address
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                    <span
                      className="badge"
                      style={{
                        background: monitor.watch_side === "from" ? "var(--risk-high)" : "var(--success)",
                        color: "#000", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                      }}
                      title={monitor.watch_side === "from" ? "该交易的发送方地址" : "该交易的接收方地址"}
                    >
                      {monitor.watch_side === "from" ? "FROM · 发送方" : "TO · 接收方"}
                    </span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)", color: "var(--primary-500)", wordBreak: "break-all" }}>
                      <a href={explorerAddressUrl(monitor.chain, monitor.address)} target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "none" }}>
                        {monitor.address}
                      </a>
                      <a href={`/screening?address=${encodeURIComponent(monitor.address)}&chain=${monitor.chain}`} style={{ marginLeft: 6, textDecoration: "none" }} title="在地址筛查中打开">🔍</a>
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginTop: "var(--sp-2)", paddingTop: "var(--sp-2)", borderTop: "1px solid var(--border-subtle)", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                <span>{monitor.chain}</span>
                <span>&middot;</span>
                <span>周期：{SCHEDULES.find((s) => s.value === monitor.schedule_preset)?.label || monitor.schedule}</span>
                <span>&middot;</span>
                <span>KYA 规则集 #{monitor.kya_ruleset_id ?? 0}</span>
                <span>&middot;</span>
                <span>追溯 1 跳</span>
                {monitor.last_run_at && (
                  <>
                    <span>&middot;</span>
                    <span>上次 {formatTime(monitor.last_run_at)}</span>
                  </>
                )}
                {monitor.next_run_at && (
                  <>
                    <span>&middot;</span>
                    <span>下次 {formatTime(monitor.next_run_at)}</span>
                  </>
                )}
                {!monitor.enabled && <span style={{ color: "var(--warning)" }}>· 已暂停</span>}
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center", flexWrap: "wrap", marginBottom: "var(--sp-3)" }}>
              <div className="tab-bar" style={{ width: "auto" }}>
                {RISK_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    className={`tab-btn ${riskFilter === f.value ? "active" : ""}`}
                    onClick={() => setRiskFilter(f.value)}
                  >
                    {f.value === "queued" ? "Errors" : f.label}
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

            {/* Period analysis */}
            <div className="card" style={{ padding: "var(--sp-2) var(--sp-3)", marginBottom: "var(--sp-3)", background: "var(--surface-2)" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", alignItems: "center" }}>
                <span><strong>{inRange.length}</strong> scan{inRange.length !== 1 ? "s" : ""} in period</span>
                <span style={{ color: "var(--text-tertiary)" }}>|</span>
                <span style={{ color: "var(--success)" }}>{okCount} completed</span>
                {byRisk.critical > 0 && <span style={{ color: "var(--risk-severe)", fontWeight: 700 }}>{byRisk.critical} critical</span>}
                {byRisk.high > 0 && <span style={{ color: "var(--risk-high)", fontWeight: 700 }}>{byRisk.high} high</span>}
                {byRisk.medium > 0 && <span style={{ color: "var(--risk-medium)" }}>{byRisk.medium} medium</span>}
                {byRisk.low > 0 && <span style={{ color: "var(--risk-low)" }}>{byRisk.low} clean/low</span>}
                {escalations > 0 && <span style={{ color: "var(--danger)", fontWeight: 700 }}>▲ {escalations} escalation{escalations !== 1 ? "s" : ""}</span>}
                {errCount > 0 && <span style={{ color: "var(--danger)" }}>{errCount} error</span>}
              </div>
            </div>

            {loading ? (
              <div className="spinner spinner-lg" style={{ margin: "var(--sp-8) auto" }} />
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)", padding: "var(--sp-8)" }}>
                {scans.length === 0
                  ? "No KYA scans yet — the watched address is re-screened on each scheduled run."
                  : "No scans match the current filters."}
              </div>
            ) : (
              <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Address</th>
                    <th>Age</th>
                    <th>Trigger</th>
                    <th>Previous</th>
                    <th></th>
                    <th>KYA Result</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((scan, i) => (
                    <KyaScanRow key={`${scan.timestamp}-${scan.job_id ?? i}`} scan={scan} chain={monitor.chain} />
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

/** One KYA scan row + expandable hit detail from the linked screening job. */
function KyaScanRow({ scan, chain }: { scan: KyaScan; chain: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && scan.job_id && !detail) {
      setDetailLoading(true);
      fetch(`/api/screening/${scan.job_id}`)
        .then((r) => r.json())
        .then(setDetail)
        .catch(() => {})
        .finally(() => setDetailLoading(false));
    }
  };

  const result = (detail?.result as Record<string, unknown> | undefined) ?? {};
  const hits = ((result.hits as Record<string, unknown>[] | undefined) ?? [])
    .slice()
    .sort((a, b) => riskSortRank(String(b.riskLevel)) - riskSortRank(String(a.riskLevel)));
  const identifications = (result.addressIdentifications as Record<string, unknown>[] | undefined) ?? [];

  return (
    <>
      <tr onClick={toggle} style={{ cursor: "pointer" }}>
        <td style={{ width: 20 }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "" }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </td>
        <td style={{ fontFamily: "var(--mono)" }}>
          <ChainLink kind="address" chain={chain} value={scan.address} highlight />
        </td>
        <td style={{ whiteSpace: "nowrap" }} title={new Date(scan.timestamp).toLocaleString()}>{relTime(scan.timestamp)}</td>
        <td style={{ color: "var(--text-tertiary)" }}>{scan.trigger}</td>
        <td style={{ color: "var(--text-tertiary)", textTransform: "uppercase" }}>
          {scan.previous_risk_level ? riskLabel(scan.previous_risk_level) : "-"}
        </td>
        <td>
          {scan.escalated
            ? <span style={{ color: "var(--danger)", fontWeight: 700 }} title="Risk level escalated">▲</span>
            : <span style={{ color: "var(--text-tertiary)" }}>→</span>}
        </td>
        <td>
          {scan.status === "completed" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: riskColorVar(scan.risk_level), fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>
                  {riskLabel(scan.risk_level)}
                </span>
                {scan.score != null && (
                  <span style={{ color: verdictColorVar(scan.verdict), fontWeight: 600, fontFamily: "var(--mono)" }}>
                    {scan.score}分·{verdictZh(scan.verdict)}
                  </span>
                )}
              </div>
              {scan.categories && scan.categories.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {scan.categories.map((c) => (
                    <span
                      key={c}
                      className="risk-pill"
                      style={{
                        fontSize: "0.58rem", fontWeight: 700, padding: "1px 5px",
                        color: riskColorVar(scan.risk_level),
                        border: `1px solid ${riskColorVar(scan.risk_level)}`,
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span style={{ color: "var(--danger)" }} title={scan.error}>Error</span>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ background: "var(--surface-1)", padding: "var(--sp-3)" }}>
            {scan.status !== "completed" ? (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--danger)" }}>{scan.error || "Screening failed"}</div>
            ) : detailLoading ? (
              <div className="spinner" style={{ margin: "var(--sp-2) auto" }} />
            ) : (
              <>
                {identifications.length > 0 && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--danger)", marginBottom: "var(--sp-2)" }}>
                    ⚠ Address identified as: {identifications.map((id) => String(id.category)).join(", ")}
                  </div>
                )}
                {hits.length === 0 ? (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--success)" }}>
                    ✓ No rule hits — address clean under the applied KYA ruleset.
                  </div>
                ) : (
                  <table className="data-table" style={{ fontSize: "0.65rem" }}>
                    <thead>
                      <tr>
                        <th>Level</th><th>Category</th><th>Rule</th><th>Flow</th><th>Hops</th><th>Amount</th><th>Counterparty</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hits.slice(0, 10).map((h, i) => (
                        <tr key={i}>
                          <td><span style={{ color: riskColorVar(String(h.riskLevel)), fontWeight: 700, textTransform: "uppercase" }}>{riskLabel(String(h.riskLevel))}</span></td>
                          <td>{String(h.category ?? "")}</td>
                          <td style={{ fontFamily: "var(--mono)" }}>{String(h.ruleCode ?? "")}</td>
                          <td>{String(h.pathFlow ?? "")}</td>
                          <td>{String(h.hops ?? "")}</td>
                          <td style={{ fontFamily: "var(--mono)" }}>{Number(h.maxAmount ?? 0).toLocaleString()}</td>
                          <td style={{ fontFamily: "var(--mono)" }}>
                            {h.opponentAddress ? <ChainLink kind="address" chain={chain} value={String(h.opponentAddress)} /> : "-"}
                          </td>
                          <td>{String(h.action ?? "")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {hits.length > 10 && (
                  <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: 4 }}>
                    Showing first 10 of {hits.length} hits — open the full report from Address Screening history (job {scan.job_id}).
                  </div>
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </>
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
