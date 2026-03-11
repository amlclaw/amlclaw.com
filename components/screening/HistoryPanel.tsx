"use client";

import { useState, useEffect, useCallback } from "react";
import { shortenAddr, formatTime } from "@/lib/utils";

interface HistoryEntry {
  job_id: string;
  chain: string;
  address: string;
  scenario: string;
  ruleset_name: string;
  status: string;
  risk_score?: number;
  timestamp: string;
}

interface HistoryPanelProps {
  onSelect: (jobId: string) => void;
  refreshTrigger?: number;
}

export default function HistoryPanel({ onSelect, refreshTrigger }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const load = useCallback(() => {
    fetch("/api/screening/history")
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const riskColor = (score?: number) => {
    if (score === undefined || score === null) return "var(--text-tertiary)";
    if (score >= 80) return "var(--risk-severe)";
    if (score >= 50) return "var(--risk-high)";
    if (score >= 20) return "var(--risk-medium)";
    return "var(--success)";
  };

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--sp-2) var(--sp-3)", borderBottom: "1px solid var(--border-default)" }}>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>History</span>
        <button className="btn-icon" onClick={load} title="Refresh" style={{ padding: 2 }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>
      <div style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
        {entries.length === 0 && (
          <div style={{ padding: "var(--sp-5)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
            No screening history yet
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.job_id}
            onClick={() => onSelect(e.job_id)}
            style={{
              padding: "5px var(--sp-2)",
              borderBottom: "1px solid var(--border-subtle)",
              cursor: "pointer",
              transition: "background var(--transition)",
            }}
            onMouseEnter={(ev) => { ev.currentTarget.style.background = "var(--surface-3)"; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.background = ""; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                className="truncate"
                style={{
                  fontSize: "0.65rem", fontFamily: "var(--mono)",
                  fontWeight: 500, flex: 1, minWidth: 0,
                }}
              >
                {shortenAddr(e.address)}
              </span>
              {e.status === "completed" && e.risk_score !== undefined ? (
                <span
                  style={{
                    fontSize: "0.65rem", fontWeight: 700,
                    fontFamily: "var(--mono)", color: riskColor(e.risk_score),
                    flexShrink: 0, marginLeft: 4,
                  }}
                >
                  {e.risk_score}
                </span>
              ) : e.status === "running" ? (
                <span style={{ fontSize: "0.6rem", color: "var(--warning)", flexShrink: 0 }}>Running</span>
              ) : e.status === "error" ? (
                <span style={{ fontSize: "0.6rem", color: "var(--danger)", flexShrink: 0 }}>Error</span>
              ) : null}
            </div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-tertiary)" }}>
              {e.chain} &middot; {e.scenario} &middot; {formatTime(e.timestamp)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
