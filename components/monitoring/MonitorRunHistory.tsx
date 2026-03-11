"use client";

import { useState, useEffect, useCallback } from "react";
import { shortenAddr, formatTime } from "@/lib/utils";
import type { MonitorRun } from "@/lib/types";

interface MonitorRunHistoryProps {
  taskId: string;
  taskName: string;
  onClose: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function MonitorRunHistory({ taskId, taskName, onClose }: MonitorRunHistoryProps) {
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/monitors/${taskId}/history`)
      .then((r) => r.json())
      .then((data) => setRuns(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const statusDotClass = (status: string) => {
    if (status === "completed") return "active";
    if (status === "error") return "error";
    if (status === "running") return "running";
    return "disabled"; // partial
  };

  return (
    <div className="card">
      <div className="panel-header">
        <div>
          <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Execution History</h2>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
            {taskName}
          </div>
        </div>
        <button className="btn-icon" onClick={onClose}>&times;</button>
      </div>
      <div style={{ maxHeight: 500, overflowY: "auto" }}>
        {runs.length === 0 && (
          <div style={{ padding: "var(--sp-5)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            No runs yet
          </div>
        )}
        {runs.map((run) => (
          <div key={run.run_id}>
            <div
              className="list-item"
              onClick={() => setExpandedRun(expandedRun === run.run_id ? null : run.run_id)}
              style={{ borderBottom: "1px solid var(--border-subtle)", borderRadius: 0 }}
            >
              <div className={`status-dot ${statusDotClass(run.status)}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                    {run.started_at ? relativeTime(run.started_at) : "-"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: run.trigger === "manual" ? "var(--info-dim)" : "var(--surface-4)",
                      color: run.trigger === "manual" ? "var(--info)" : "var(--text-secondary)",
                    }}
                  >
                    {run.trigger}
                  </span>
                </div>
                {run.summary && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 3 }}>
                    {run.summary.completed - run.summary.flagged}/{run.summary.total_addresses} clean
                    {run.summary.flagged > 0 && (
                      <span style={{ color: "var(--danger)", marginLeft: 6 }}>
                        {run.summary.flagged} flagged
                      </span>
                    )}
                    {run.summary.highest_risk !== "Low" && (
                      <span style={{ marginLeft: 6 }}>
                        Highest: <span style={{ fontWeight: 600 }}>{run.summary.highest_risk}</span>
                      </span>
                    )}
                  </div>
                )}
                {run.error && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--danger)", marginTop: 3 }}>
                    {run.error}
                  </div>
                )}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                {expandedRun === run.run_id ? "\u25B2" : "\u25BC"}
              </div>
            </div>

            {/* Expanded: per-address results */}
            {expandedRun === run.run_id && run.results && (
              <div style={{ padding: "0 var(--sp-4) var(--sp-3)", background: "var(--surface-2)" }}>
                <table className="data-table" style={{ marginTop: 0 }}>
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Status</th>
                      <th>Risk</th>
                      <th>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.results.map((r, i) => (
                      <tr key={i}>
                        <td>
                          <span style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)" }}>
                            {r.chain}:{shortenAddr(r.address)}
                          </span>
                        </td>
                        <td>
                          {r.status === "completed" ? (
                            <span style={{ color: "var(--success)" }}>OK</span>
                          ) : (
                            <span style={{ color: "var(--danger)" }}>Error</span>
                          )}
                        </td>
                        <td>
                          {r.risk_level && (
                            <span className={`risk-pill ${r.risk_level.toLowerCase()}`}>
                              {r.risk_level}
                            </span>
                          )}
                          {r.risk_entities_count !== undefined && r.risk_entities_count > 0 && (
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginLeft: 4 }}>
                              ({r.risk_entities_count})
                            </span>
                          )}
                        </td>
                        <td>
                          {r.job_id && (
                            <a
                              href={`/screening?job=${r.job_id}`}
                              style={{ fontSize: "var(--text-xs)", color: "var(--primary-400)" }}
                            >
                              View
                            </a>
                          )}
                          {r.error && (
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--danger)" }}>
                              {r.error.slice(0, 40)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--sp-2)" }}>
                  Completed: {formatTime(run.completed_at)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
