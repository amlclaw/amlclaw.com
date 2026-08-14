"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import PageGuide from "@/components/shared/PageGuide";
import { showToast, shortenAddr } from "@/lib/utils";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorers";
import { riskPillClass, riskColorVar, riskLabel, verdictColorVar, verdictZh } from "@/lib/risk-ui";
import type { WidthTag } from "@/lib/width-api";
import type { BatchJob, BatchType, BatchIndexEntry } from "@/lib/types";
import ScreeningResult from "@/components/screening/ScreeningResult";
import KytResult from "@/components/screening/KytResult";

const MAX_BATCH_ITEMS = 50;

const RISK_FILTERS = [
  { value: "all", label: "All" },
  { value: "flagged", label: "Flagged" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "clean", label: "Clean" },
  { value: "error", label: "Error" },
] as const;

type RiskFilter = (typeof RISK_FILTERS)[number]["value"];

/** Human-readable duration, e.g. 12.3s / 1m23s. */
function fmtDur(ms?: number): string {
  if (ms == null || ms < 0) return "—";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m${String(rem).padStart(2, "0")}s`;
}

/** Batch wall-clock duration: created_at → completed_at (or now while running). */
function batchDuration(batch: BatchJob): string {
  const end = batch.completed_at ? new Date(batch.completed_at).getTime() : Date.now();
  return fmtDur(end - new Date(batch.created_at).getTime());
}

export default function BatchPage({ type }: { type: BatchType }) {
  const isKya = type === "kya";
  const [itemsText, setItemsText] = useState("");
  const [chain, setChain] = useState("Tron");
  const [batch, setBatch] = useState<BatchJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<BatchIndexEntry[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);

  /** Open a stored batch from history (completed/interrupted) and scroll to it. */
  const openHistoryBatch = useCallback((id: string) => {
    fetch(`/api/batch/${id}`)
      .then((r) => r.json())
      .then((data: BatchJob) => {
        setBatch(data);
        setLoading(false);
        // Scroll once the panel has rendered (below).
        setTimeout(() => resultPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      })
      .catch(() => showToast("Failed to load batch", "error"));
  }, []);

  const loadHistory = useCallback(() => {
    fetch("/api/batch")
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadHistory();
    const t = setInterval(loadHistory, 15000); // keep history fresh (other tabs / background runs)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearInterval(t);
    };
  }, [loadHistory]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const poll = useCallback((id: string) => {
    stopPolling();
    const tick = () => {
      fetch(`/api/batch/${id}`)
        .then((r) => r.json())
        .then((data: BatchJob) => {
          setBatch(data);
          if (data.status !== "running") {
            stopPolling();
            setLoading(false);
            loadHistory();
          }
        })
        .catch(() => { /* keep polling */ });
    };
    tick();
    pollRef.current = setInterval(tick, 3000);
  }, [stopPolling, loadHistory]);

  const submit = async () => {
    const items = [...new Set(itemsText.split(/\n|,|;/).map((s) => s.trim()).filter(Boolean))];
    if (items.length === 0) {
      showToast(isKya ? "Please paste at least one address" : "Please paste at least one transaction hash", "error");
      return;
    }
    if (items.length > MAX_BATCH_ITEMS) {
      showToast(`Batch limited to ${MAX_BATCH_ITEMS} items per run`, "error");
      return;
    }
    setLoading(true);
    setBatch(null);
    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, items, chain }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to start batch");
      }
      const { batch_id } = await res.json();
      poll(batch_id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
      setLoading(false);
    }
  };

  const running = batch?.status === "running";
  const pct = batch && batch.total > 0 ? Math.round((batch.done / batch.total) * 100) : 0;

  return (
    <div style={{ padding: "var(--sp-5) var(--sp-6)" }}>
      <PageGuide
        pageKey={isKya ? "batch-screening" : "batch-kyt"}
        title={isKya ? "批量地址筛查 Batch Address Screening" : "批量交易筛查 Batch Transaction Screening"}
        description={
          isKya
            ? "一次提交多个地址(每行一个),用设置页的默认参数逐个调用 width.info KYA(async 模式)批量出报告——无需自己算分,评分/风险/路径证据全部由 width 引擎返回。"
            : "一次提交多笔交易哈希(每行一个),用设置页的默认参数逐个调用 width.info KYT(async 模式,方向 both)批量出报告。"
        }
        tips={[
          "每行一个地址 / 交易哈希,支持逗号或分号分隔;最多 50 条/批",
          "参数全部使用 Settings → Screening Defaults 的默认值(跳数、节点上限、时间序列、CEX 免疫等)",
          "链自动识别(地址格式 / tx 前缀),识别不出则用上方选择的链",
          "每条约 10-30 秒(取决于地址活跃度),并发 2 条;完成后可展开看完整报告或导出 CSV",
        ]}
      />

      {/* ── Input card ── */}
      <div className="card" style={{ padding: "var(--sp-4)", marginBottom: "var(--sp-4)" }}>
        <textarea
          className="input"
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
          disabled={running}
          placeholder={isKya
            ? "Paste addresses, one per line:\nTZ8Ksz21Hk1tQuztCKCUJBRXStCav9uyjM\n0x1234..."
            : "Paste transaction hashes, one per line:\n0cbaf7b3a9f544b91c20244ff426e78e23d53031fecbf070642d703265e458d6\n0x5678..."}
          style={{ width: "100%", minHeight: 140, fontFamily: "var(--mono)", fontSize: "var(--text-xs)" }}
        />
        <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center", marginTop: "var(--sp-3)", flexWrap: "wrap" }}>
          <label className="label" style={{ margin: 0 }}>Chain (fallback):</label>
          <select className="input" style={{ width: "auto" }} value={chain} onChange={(e) => setChain(e.target.value)} disabled={running}>
            <option value="Tron">Tron</option>
            <option value="Ethereum">Ethereum</option>
          </select>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {itemsText ? new Set(itemsText.split(/\n|,|;/).map((s) => s.trim()).filter(Boolean)).size : 0} items
            {batch && batch.status === "running" && <span> · 每项用 Settings 默认参数</span>}
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-md btn-primary" onClick={submit} disabled={loading || running}>
            {running ? "Running…" : loading ? "Starting…" : `Start Batch ${isKya ? "KYA" : "KYT"}`}
          </button>
        </div>
      </div>

      {/* ── Active batch panel ── */}
      {batch && (
        <div ref={resultPanelRef} className="card" style={{ padding: "var(--sp-4)", marginBottom: "var(--sp-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", flexWrap: "wrap", marginBottom: "var(--sp-3)" }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>
              Batch {batch.id}
              <span className="badge" style={{ marginLeft: 8, color: batch.status === "completed" ? "var(--success)" : batch.status === "error" ? "var(--danger)" : "var(--warning)" }}>
                {batch.status}
              </span>
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
              {batch.done}/{batch.total} done · {batch.failed} failed · <span style={{ color: "var(--danger)", fontWeight: 700 }}>{batch.flagged} flagged</span>
              <span style={{ marginLeft: 8 }}>
                耗时 <b style={{ color: "var(--text-secondary)", fontFamily: "var(--mono)" }}>{batchDuration(batch)}</b>
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
              <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: batch.status === "completed" ? "var(--success)" : "var(--primary-500)", transition: "width .4s" }} />
              </div>
              <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--mono)" }}>{pct}%</span>
            </div>
            {batch.status !== "running" && (
              <button className="btn btn-sm btn-secondary" onClick={() => exportCsv(batch)}>Export CSV</button>
            )}
          </div>
          <BatchTable key={batch.id} batch={batch} type={type} />
        </div>
      )}

      {/* ── Batch history (persisted under data/batches/, survives refresh/restart) ── */}
      <div className="card" style={{ padding: "var(--sp-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>
            Batch History · 批次历史
            <span className="badge" style={{ marginLeft: 8, fontWeight: 400, color: "var(--text-tertiary)" }}>
              完成/中断的批次保存在 data/batches/,刷新或重启后仍可查看
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm btn-secondary" onClick={loadHistory} title="手动刷新批次历史">
            ⟳ 刷新
          </button>
        </div>
        {history.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-xs)", padding: "var(--sp-6)" }}>
            暂无批次记录 — 提交一个批量检测后,结果会保存在这里。
          </div>
        ) : (
          <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
            <thead>
              <tr>
                <th>Type</th><th>ID</th><th>Chain</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Done</th>
                <th style={{ textAlign: "right" }}>Failed</th><th style={{ textAlign: "right" }}>Flagged</th><th>Status</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 20).map((h) => (
                <tr key={h.id} style={{ cursor: "pointer" }} onClick={() => { openHistoryBatch(h.id); }}>
                  <td><span className="badge">{h.type === "kya" ? "KYA" : "KYT"}</span></td>
                  <td style={{ fontFamily: "var(--mono)" }}>{h.id}</td>
                  <td>{h.chain}</td>
                  <td style={{ textAlign: "right" }}>{h.total}</td>
                  <td style={{ textAlign: "right" }}>{h.done}</td>
                  <td style={{ textAlign: "right", color: h.failed > 0 ? "var(--danger)" : undefined }}>{h.failed}</td>
                  <td style={{ textAlign: "right", color: h.flagged > 0 ? "var(--danger)" : undefined, fontWeight: 700 }}>{h.flagged}</td>
                  <td>
                    <span className="badge" style={{
                      color: h.status === "completed" ? "var(--success)"
                        : h.status === "interrupted" ? "var(--warning)"
                        : h.status === "error" ? "var(--danger)"
                        : "var(--primary-500)",
                    }}>
                      {h.status}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{new Date(h.created_at).toLocaleString()}</td>
                  <td><span style={{ color: "var(--primary-500)" }}>open →</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Results table ── */

function BatchTable({ batch, type }: { batch: BatchJob; type: BatchType }) {
  const [filter, setFilter] = useState<RiskFilter>("all");
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filtered = batch.items.filter((it) => {
    switch (filter) {
      case "flagged": return it.status === "completed" && ["critical", "high"].includes(it.risk || "");
      case "critical": return it.status === "completed" && it.risk === "critical";
      case "high": return it.status === "completed" && it.risk === "high";
      case "clean": return it.status === "completed" && ["low", "medium"].includes(it.risk || "low");
      case "error": return it.status === "error";
      default: return true;
    }
  });

  const toggle = async (index: number) => {
    const next = openRow === index ? null : index;
    setOpenRow(next);
    setDetail(null);
    if (next !== null) {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/batch/${batch.id}?item=${index}`);
        if (res.ok) setDetail(await res.json());
      } catch { /* keep null */ }
      setDetailLoading(false);
    }
  };

  const jobFor = (index: number): Record<string, unknown> => ({
    status: "completed",
    type,
    completed_at: batch.completed_at ?? batch.created_at,
    request: { chain: batch.items[index]?.chain },
    result: detail?.result ?? {},
    fund_score: detail?.fund_score ?? null,
    chain_stats: detail?.chain_stats ?? null,
    tx_endpoints: detail?.tx_endpoints ?? null,
  });

  return (
    <div>
      <div className="tab-bar" style={{ width: "auto", marginBottom: "var(--sp-2)" }}>
        {RISK_FILTERS.map((f) => (
          <button key={f.value} className={`tab-btn ${filter === f.value ? "active" : ""}`} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-xs)", padding: "var(--sp-6)" }}>
          No items match the current filter.
        </div>
      ) : (
        <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
          <thead>
            <tr>
              <th></th>
              <th>#</th>
              <th>{type === "kya" ? "Address" : "Tx Hash"}</th>
              <th>Chain</th>
              <th>Status</th>
              <th title={type === "kya" ? "地址自身标签 subjectTags" : "发送方标签 fromTags"}>Tags</th>
              <th>Score · Verdict</th>
              <th title="该条从开始筛查到出结果的时间">耗时</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <ItemRow key={it.index} item={it} type={type} open={openRow === it.index} onToggle={() => toggle(it.index)} />
            ))}
          </tbody>
        </table>
      )}
      {openRow !== null && (
        <div className="card" style={{ marginTop: "var(--sp-3)", padding: "var(--sp-2)" }}>
          {detailLoading ? (
            <div className="spinner" style={{ margin: "var(--sp-4) auto" }} />
          ) : !detail ? (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", padding: "var(--sp-4)" }}>
              Item detail unavailable yet.
            </div>
          ) : type === "kya" ? (
            <ScreeningResult job={jobFor(openRow)} jobId={`${batch.id}/${openRow}`} loading={false} progress="" />
          ) : (
            <KytResult job={jobFor(openRow)} jobId={`${batch.id}/${openRow}`} loading={false} progress="" />
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, type, open, onToggle }: {
  item: BatchJob["items"][number];
  type: BatchType;
  open: boolean;
  onToggle: () => void;
}) {
  const subject = item.subject;
  const url = type === "kya" ? explorerAddressUrl(item.chain, subject) : explorerTxUrl(item.chain, subject);
  const statusColor =
    item.status === "completed" ? "var(--success)"
    : item.status === "error" ? "var(--danger)"
    : "var(--warning)";

  return (
    <tr onClick={onToggle} style={{ cursor: "pointer" }}>
      <td style={{ width: 18 }}>
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "" }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </td>
      <td style={{ color: "var(--text-tertiary)" }}>{item.index + 1}</td>
      <td style={{ fontFamily: "var(--mono)" }}>
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--text-secondary)", textDecoration: "none" }} title={subject}>
          {shortenAddr(subject)}
        </a>
      </td>
      <td>{item.chain}</td>
      <td style={{ color: statusColor, fontWeight: 700 }} title={item.error}>
        {item.status === "running" ? "…" : item.status}
      </td>
      <td>
        {item.status === "completed" ? (
          <TagChips tags={item.tags} />
        ) : item.error ? (
          <span style={{ color: "var(--danger)", fontSize: "0.62rem" }} title={item.error}>error</span>
        ) : "—"}
      </td>
      <td>
        {item.status === "completed" && item.score != null ? (
          <span style={{ color: verdictColorVar(item.verdict), fontWeight: 800, fontFamily: "var(--mono)" }}>
            {item.score}分·{verdictZh(item.verdict)}
          </span>
        ) : item.status === "completed" ? (
          <span style={{ color: riskColorVar(item.risk || "low"), fontWeight: 700 }}>{riskLabel(item.risk || "low")}</span>
        ) : "—"}
      </td>
      <td style={{ fontFamily: "var(--mono)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
        {item.status === "running" ? "…" : fmtDur(item.elapsedMs)}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <RowActions item={item} type={type} />
      </td>
    </tr>
  );
}

/** Copy + jump to the full single-screen report (地址检测 / 交易检测). */
function RowActions({ item, type }: { item: BatchJob["items"][number]; type: BatchType }) {
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(item.subject);
      showToast("已复制: " + shortenAddr(item.subject), "success");
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = item.subject;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("已复制: " + shortenAddr(item.subject), "success");
    }
  };

  const screenHref = type === "kya"
    ? `/screening?address=${encodeURIComponent(item.subject)}&chain=${encodeURIComponent(item.chain)}`
    : `/kyt?tx=${encodeURIComponent(item.subject)}&chain=${encodeURIComponent(item.chain)}`;

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <button
        type="button"
        className="btn btn-sm btn-secondary"
        onClick={copy}
        title="复制地址/交易哈希"
        style={{ padding: "2px 8px", fontSize: "0.65rem" }}
      >
        ⧉ 复制
      </button>
      <Link
        href={screenHref}
        onClick={(e) => e.stopPropagation()}
        className="btn btn-sm btn-secondary"
        title={type === "kya" ? "在地址检测中打开完整报告" : "在交易检测中打开完整报告"}
        style={{ padding: "2px 8px", fontSize: "0.65rem", textDecoration: "none" }}
      >
        {type === "kya" ? "地址检测 →" : "交易检测 →"}
      </Link>
    </span>
  );
}

/** The subject's own tags (KYA = subjectTags, KYT = sender fromTags) as pills. */
function TagChips({ tags }: { tags?: WidthTag[] }) {
  if (!tags || tags.length === 0) {
    return <span style={{ color: "var(--text-tertiary)" }}>—</span>;
  }
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 220 }}>
      {tags.slice(0, 3).map((t, i) => {
        const label = [t.primary_category, t.tertiary_category].filter(Boolean).join(" · ") || (t.primary_category ?? "tag");
        return (
          <span
            key={i}
            className={`risk-pill ${riskPillClass(t.risk_level || "low")}`}
            style={{ fontSize: "0.62rem", whiteSpace: "nowrap" }}
            title={`${label} · ${t.risk_level || "low"}`}
          >
            {label}
          </span>
        );
      })}
      {tags.length > 3 && (
        <span style={{ color: "var(--text-tertiary)", fontSize: "0.62rem" }}>+{tags.length - 3}</span>
      )}
    </div>
  );
}

/* ── CSV export ── */

function exportCsv(batch: BatchJob) {
  const header = ["index", "subject", "chain", "status", "risk", "score", "verdict", "elapsed_seconds", "error"];
  const rows = batch.items.map((it) => [
    it.index,
    it.subject,
    it.chain,
    it.status,
    it.status === "completed" ? (it.risk ?? "") : "",
    it.score != null ? String(it.score) : "",
    it.verdict ?? "",
    it.elapsedMs != null ? (it.elapsedMs / 1000).toFixed(1) : "",
    it.error ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${batch.id}_${batch.type}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
