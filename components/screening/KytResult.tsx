"use client";

import { useState, Suspense, lazy } from "react";
import { formatTime, shortenAddr, showToast } from "@/lib/utils";
import { hitsToEntities } from "@/lib/parse-evidence-flow";
import { riskPillClass, riskColorVar, riskLabel, recommendation, riskSortRank } from "@/lib/risk-ui";
import { RiskBadge, KriCard, EntityCard } from "./ScreeningResult";
import type { KytScreenResult } from "@/lib/width-api";
import type { FundScore } from "@/lib/risk-score";
import FundScoreCard, { ScoreVerdictBadge, PathAnalysisDivider } from "./FundScoreCard";

const FlowGraph = lazy(() => import("./FlowGraph"));

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
  const [evidenceView, setEvidenceView] = useState<"list" | "graph">("list");

  const r = (job.result ?? {}) as unknown as KytScreenResult;
  const req = (job.request as Record<string, unknown>) || {};
  const hits = r.hits || [];
  // Severity-desc — API order is unsorted; worst findings must lead the table
  const alerts = (r.alerts || []).slice().sort(
    (a, b) => riskSortRank(b.alertLevel) - riskSortRank(a.alertLevel),
  );
  const entities = hitsToEntities(hits);
  const target = { address: r.transaction, chain: r.chain, tags: [] };
  const rec = recommendation(hits.map((h) => h.action));
  const direction = (req.direction as string) || "both";

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
            {job.fund_score != null ? (
              <ScoreVerdictBadge fundScore={job.fund_score as FundScore} />
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

        {/* ── Verdict: fund-attribution score is THE user-facing judgment ── */}
        {job.fund_score != null && (
          <FundScoreCard fundScore={job.fund_score as FundScore} mode="kyt" />
        )}

        {/* ── Everything below is path-level EVIDENCE (rule engine view) ── */}
        {job.fund_score != null && <PathAnalysisDivider />}

        {/* Path-level indicators */}
        <div className="report-section">
          <div className="report-section-header">Path-Level Indicators · 路径指标(规则口径)</div>
          <div className="report-kri-grid">
            <KriCard value={r.riskScore === 0 ? "Clean" : riskLabel(r.risk)} label="Path Risk Level" color={r.riskScore === 0 ? "var(--success)" : riskColorVar(r.risk)} />
            <KriCard value={alerts.length} label="Alerts" color={alerts.length ? "var(--risk-high)" : "var(--success)"} />
            <KriCard value={`${r.hitPaths}/${r.totalPaths}`} label="Hit Paths" color={r.hitPaths > 0 ? "var(--risk-high)" : "var(--success)"} />
            <KriCard value={rec} label="Rule Action (path)" color={rec === "Pass" ? "var(--success)" : rec === "Review" ? "var(--risk-medium)" : "var(--danger)"} />
          </div>
        </div>

        {/* Alerts */}
        <div className="report-section">
          <div className="report-section-header">Alerts ({alerts.length})</div>
          {alerts.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Category</th>
                  <th>Exposure</th>
                  <th>Amount</th>
                  <th>Rule</th>
                  <th>Counterparty</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`risk-pill ${riskPillClass(a.alertLevel)}`}>{riskLabel(a.alertLevel)}</span>
                    </td>
                    <td>{a.category}</td>
                    <td>{a.exposureType}{a.hops ? ` · ${a.hops} hop${a.hops !== 1 ? "s" : ""}` : ""}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>{a.alertAmount.toLocaleString()}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: "0.65rem" }}>{a.categoryId}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: "0.65rem" }}>{shortenAddr(a.opponentAddress)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="report-alert report-alert-success">No alerts — transaction appears clean</div>
          )}
        </div>

        {/* Evidence */}
        <div className="report-section">
          <div className="report-section-header">
            <span>Risk Evidence ({entities.length})</span>
            {entities.length > 0 && (
              <div className="tab-bar" style={{ width: "auto" }}>
                <button className={`tab-btn ${evidenceView === "list" ? "active" : ""}`} onClick={() => setEvidenceView("list")}>
                  List
                </button>
                <button className={`tab-btn ${evidenceView === "graph" ? "active" : ""}`} onClick={() => setEvidenceView("graph")}>
                  Graph
                </button>
              </div>
            )}
          </div>

          {entities.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--sp-8)", color: "var(--success)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "var(--sp-2)" }}>{"✓"}</div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                No risk paths detected for this transaction.
              </div>
            </div>
          ) : evidenceView === "graph" ? (
            <Suspense fallback={
              <div style={{ height: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="spinner spinner-lg" />
              </div>
            }>
              <FlowGraph
                entities={entities as unknown as Record<string, unknown>[]}
                target={target as unknown as Record<string, unknown>}
                scenario="all"
                chain={r.chain || "Tron"}
              />
            </Suspense>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {entities.map((entity, idx) => (
                <EntityCard key={idx} entity={entity as unknown as Record<string, unknown>} />
              ))}
            </div>
          )}
        </div>
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

function Container({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ minHeight: 300 }}>{children}</div>;
}
