"use client";

import { useState } from "react";
import { formatTime, showToast } from "@/lib/utils";
import { RiskBadge } from "./ScreeningResult";
import type { KytScreenResult } from "@/lib/width-api";
import type { FundScore } from "@/lib/risk-score";
import FundScoreCard, { ScoreVerdictBadge, PathAnalysisDivider } from "./FundScoreCard";
import RiskEvidence from "./RiskEvidence";

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

        {/* ── Verdict: fund-attribution score is THE user-facing judgment ── */}
        {fundScore && (
          <FundScoreCard fundScore={fundScore} mode="kyt" />
        )}

        {/* ── Everything below is path-level EVIDENCE (rule engine view) ── */}
        {fundScore && <PathAnalysisDivider />}

        {/* ── Risk Evidence: rule-grouped fund paths (证据核心) ──
            KYT paths anchor at the tx counterparty, so per-path ratio chips
            (edge ÷ tx amount) would be misleading — denominators omitted. */}
        <RiskEvidence
          hits={r.hits || []}
          chain={r.chain || "Tron"}
          totalIn={null}
          totalOut={null}
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

function Container({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ minHeight: 300 }}>{children}</div>;
}
