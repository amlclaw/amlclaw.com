"use client";

import { useState } from "react";
import { formatTime, showToast } from "@/lib/utils";
import { riskPillClass, riskColorVar, riskLabel, riskSortRank, verdictColorVar, verdictZh } from "@/lib/risk-ui";
import { RiskBadge } from "./ScreeningResult";
import type { KytScreenResult } from "@/lib/width-api";
import type { FundScore } from "@/lib/risk-score";
import FundScoreCard, { ScoreVerdictBadge, PathAnalysisDivider } from "./FundScoreCard";
import RiskEvidence from "./RiskEvidence";
import AiReviewer from "./AiReviewer";

interface KytResultProps {
  job: Record<string, unknown> | null;
  jobId: string | null;
  loading: boolean;
  progress: string;
}

export default function KytResult({ job, loading, progress }: KytResultProps) {
  if (loading) {
    return (
      <Container>
        <div style={{ padding: "var(--sp-10) var(--sp-6)", textAlign: "center" }}>
          <div className="spinner spinner-lg" style={{ margin: "0 auto var(--sp-4)" }} />
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {progress || "Processing..."}
          </div>
        </div>
      </Container>
    );
  }

  if (!job) {
    return (
      <Container>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--sp-16) var(--sp-5)", textAlign: "center" }}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginTop: "var(--sp-4)" }}>
            Enter a transaction hash and click <strong>Start KYT Screening</strong> to begin.
          </p>
        </div>
      </Container>
    );
  }

  if (job.status === "error") {
    return (
      <Container>
        <div style={{ padding: "var(--sp-10) var(--sp-6)", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--danger-dim)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--sp-4)", fontSize: "var(--text-xl)", fontWeight: 700 }}>
            !
          </div>
          <div style={{ color: "var(--danger)", fontSize: "var(--text-sm)", maxWidth: 500, margin: "0 auto", wordBreak: "break-word" }}>
            {(job.error as string) || "Unknown error"}
          </div>
        </div>
      </Container>
    );
  }

  return <CompletedKytReport job={job} />;
}

function CompletedKytReport({ job }: { job: Record<string, unknown> }) {
  const r = (job.result ?? {}) as unknown as KytScreenResult;
  const req = (job.request as Record<string, unknown>) || {};
  const fundScore = (job.fund_score as FundScore | null) ?? null;
  const tx = (job.tx_endpoints as { from: string; to: string; token: string; amount: number; timestamp?: number } | null) ?? null;
  const direction = (req.direction as string) || "both";

  // Alerts from the width API (Chainalysis-style), sorted by severity desc.
  const alerts = (r.alerts || []).slice().sort((a, b) => riskSortRank(b.alertLevel) - riskSortRank(a.alertLevel));

  return (
    <Container>
      <div style={{ padding: "var(--sp-6)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--sp-6)", paddingBottom: "var(--sp-4)", borderBottom: "1px solid var(--border-default)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 700 }}>
              KYT Transaction Screening Report
            </div>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: "var(--sp-1)", display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
              <span>{formatTime(job.completed_at as string)}</span>
              <span>&middot;</span>
              <span>Engine: width.info V3</span>
              <span>&middot;</span>
              <span>Direction: {direction}</span>
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "var(--sp-2)", wordBreak: "break-all" }}>
              {r.transaction}
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-start", flexShrink: 0 }}>
            {fundScore ? (
              <ScoreVerdictBadge fundScore={fundScore} />
            ) : (
              <RiskBadge level={r.risk} score={r.riskScore} />
            )}
          </div>
        </div>

        {/* Monitor buttons */}
        <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-4)" }}>
          <MonitorSideButton chain={r.chain} txId={r.transaction} side="from" />
          <MonitorSideButton chain={r.chain} txId={r.transaction} side="to" />
        </div>

        {/* ── Transaction key factors ── */}
        {tx && (
          <div className="report-section">
            <div className="report-section-header">Transaction · 交易要素</div>
            <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
              <tbody>
                <tr>
                  <td style={{ color: "var(--text-tertiary)", width: 140, fontWeight: 600 }}>From(付款方)</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", wordBreak: "break-all" }}>
                    {tx.from}
                    <span className="badge" style={{ marginLeft: 8, color: "var(--primary-500)" }}>KYT-IN 溯源对象</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>To(收款方)</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", wordBreak: "break-all" }}>
                    {tx.to}
                    <span className="badge" style={{ marginLeft: 8, color: "var(--risk-medium)" }}>KYT-OUT 溯源对象</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Amount</td>
                  <td style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>
                    {tx.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} {tx.token}
                  </td>
                </tr>
                {tx.timestamp ? (
                  <tr>
                    <td style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Time</td>
                    <td>{formatTime(new Date(tx.timestamp).toISOString())}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {r.fromTags && r.fromTags.length > 0 && (
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--sp-2)", display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>Sender Tags:</span>
                {r.fromTags.map((t, i) => (
                  <span key={i} className={`risk-pill ${riskPillClass(t.risk_level || "low")}`} style={{ fontSize: "0.65rem" }}>
                    {[t.primary_category, t.tertiary_category].filter(Boolean).join(" · ")}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Verdict: fund-attribution score is THE user-facing judgment ── */}
        {fundScore && (
          <FundScoreCard fundScore={fundScore} mode="kyt" />
        )}

        {/* ── IN / OUT directional sub-scores (from the width engine) ── */}
        {(r.inScore || r.outScore) && (
          <div className="report-section">
            <div className="report-section-header">Directional Scores · 分向评分(KYT-IN 溯源 / KYT-OUT 去向)</div>
            <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
              {r.inScore && (
                <ScoreSplitBox title="KYT-IN · 付款方资金来源" score={r.inScore} color="var(--primary-500)" />
              )}
              {r.outScore && (
                <ScoreSplitBox title="KYT-OUT · 收款方资金去向" score={r.outScore} color="var(--risk-medium)" />
              )}
            </div>
          </div>
        )}

        {/* ── AI reviewer: catches direct/self high-risk the score may under-weight ── */}
        <AiReviewer type="kyt" result={r as unknown as Record<string, unknown>} />

        {/* ── Everything below is path-level EVIDENCE (rule engine view) ── */}
        {fundScore && <PathAnalysisDivider />}

        {/* ── Alerts (Chainalysis-style, straight from the width API) ── */}
        {alerts.length > 0 && (
          <div className="report-section">
            <div className="report-section-header">Alerts · 告警({alerts.length})</div>
            <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
              <thead>
                <tr>
                  <th>Level</th><th>Category</th><th>Exposure</th><th>Hops</th><th style={{ textAlign: "right" }}>Amount</th><th>Rule</th><th>Counterparty</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.slice(0, 20).map((a, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ color: riskColorVar(a.alertLevel), fontWeight: 700, textTransform: "uppercase" }}>
                        {riskLabel(a.alertLevel)}
                      </span>
                    </td>
                    <td>{a.category}</td>
                    <td>{a.exposureType}{a.direction ? ` · ${a.direction}` : ""}</td>
                    <td>{a.hops > 0 ? `${a.hops}h` : "—"}</td>
                    <td style={{ fontFamily: "var(--mono)", textAlign: "right" }}>
                      {a.alertAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontFamily: "var(--mono)" }}>{a.categoryId}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>
                      <a
                        href={explorerUrl(r.chain || "Tron", a.opponentAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--text-secondary)", textDecoration: "none", wordBreak: "break-all" }}
                      >
                        {a.opponentAddress || "-"}
                      </a>
                    </td>
                    <td>{a.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {alerts.length > 20 && (
              <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: 4 }}>
                Showing first 20 of {alerts.length} alerts.
              </div>
            )}
          </div>
        )}

        {/* ── Risk Evidence: rule-grouped fund paths (证据核心) ──
            KYT paths anchor at the tx counterparty, so per-path ratio chips
            (edge ÷ tx amount) would be misleading — denominators omitted. */}
        <RiskEvidence
          hits={r.hits || []}
          chain={r.chain || "Tron"}
          totalIn={null}
          totalOut={null}
          kytAnchors={tx ? { from: tx.from, to: tx.to } : undefined}
        />
      </div>
    </Container>
  );
}

/** Add the tx's from/to counterparty to TX Monitoring (periodic KYA). */
function MonitorSideButton({ chain, txId, side }: { chain: string; txId: string; side: "from" | "to" }) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  const add = async () => {
    if (state !== "idle") return;
    setState("saving");
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "kyt", chain, tx_id: txId, watch_side: side }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create monitor");
      }
      setState("done");
      showToast(`Monitoring the ${side} address (periodic KYA)`, "success");
    } catch (e) {
      setState("idle");
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  return (
    <button
      className="btn btn-sm btn-secondary"
      onClick={add}
      disabled={state !== "idle"}
      title={`Resolve the ${side} address of this tx and KYA-screen it on a schedule`}
    >
      {state === "done" ? `✓ Monitoring ${side}` : state === "saving" ? "Adding..." : `⏱ Monitor ${side} address`}
    </button>
  );
}

/** One IN or OUT directional sub-score box (renders the width engine's score). */
function ScoreSplitBox({ title, score, color }: { title: string; score: FundScore; color: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 240, padding: "var(--sp-3)", borderRadius: "var(--radius-md)",
      border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
      background: `color-mix(in srgb, ${color} 6%, transparent)`,
    }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color, letterSpacing: "0.02em", marginBottom: "var(--sp-2)" }}>
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--sp-2)", flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.6rem", fontWeight: 800, color: verdictColorVar(score.verdict), lineHeight: 1 }}>
          {score.score != null ? score.score : "—"}
          <span style={{ fontSize: "0.6rem", fontWeight: 400, color: "var(--text-tertiary)" }}>/100</span>
        </span>
        <span className="badge" style={{ background: `color-mix(in srgb, ${verdictColorVar(score.verdict)} 15%, transparent)`, color: verdictColorVar(score.verdict), fontWeight: 700 }}>
          {score.verdict ? `${score.verdict.toUpperCase()} · ${verdictZh(score.verdict)}` : "N/A"}
        </span>
        {score.selfHit && (
          <span className="badge" style={{ background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", fontWeight: 700 }}>
            SELFHIT · {(score.selfHitLevel || "critical").toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: "var(--sp-1)" }}>
        {score.hitPaths} hit paths · {score.riskyEdges} deduped edges
      </div>
    </div>
  );
}

function explorerUrl(chain: string, address: string): string {
  return chain === "Ethereum"
    ? `https://etherscan.io/address/${address}`
    : `https://tronscan.org/#/address/${address}`;
}

function Container({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ minHeight: 300 }}>{children}</div>;
}
