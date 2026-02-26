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
      <div className="panel-header">
        <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Recent Screenings</h2>
        <button className="btn btn-sm btn-secondary" onClick={load}>
          Refresh
        </button>
      </div>
      <div style={{ maxHeight: 500, overflowY: "auto" }}>
        {entries.length === 0 && (
          <div style={{ padding: "var(--sp-5)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            No screening history yet
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.job_id}
            className="list-item"
            onClick={() => onSelect(e.job_id)}
            style={{ borderBottom: "1px solid var(--border-subtle)", borderRadius: 0 }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="truncate"
                style={{
                  fontSize: "var(--text-sm)", fontFamily: "var(--mono)",
                  fontWeight: 500,
                }}
              >
                {shortenAddr(e.address)}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 3 }}>
                {e.chain} &middot; {e.scenario} &middot; {e.ruleset_name}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {e.status === "completed" && e.risk_score !== undefined ? (
                <div
                  style={{
                    fontSize: "var(--text-sm)", fontWeight: 700,
                    fontFamily: "var(--mono)", color: riskColor(e.risk_score),
                  }}
                >
                  {e.risk_score}
                </div>
              ) : e.status === "running" ? (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--warning)" }}>Running...</div>
              ) : e.status === "error" ? (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--danger)" }}>Error</div>
              ) : (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{e.status}</div>
              )}
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                {formatTime(e.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
