"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { shortenAddr } from "@/lib/utils";
import { showToast } from "@/lib/utils";
import type { MonitorTask } from "@/lib/types";

interface MonitorListProps {
  onEdit: (task: MonitorTask) => void;
  onSelectHistory: (taskId: string, taskName: string) => void;
  onNewTask: () => void;
  refreshTrigger: number;
}

function relativeTime(iso?: string): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PRESET_LABELS: Record<string, string> = {
  every_1h: "Every 1h",
  every_4h: "Every 4h",
  every_8h: "Every 8h",
  every_12h: "Every 12h",
  every_24h: "Every 24h",
  custom: "Custom",
};

export default function MonitorList({ onEdit, onSelectHistory, onNewTask, refreshTrigger }: MonitorListProps) {
  const [tasks, setTasks] = useState<MonitorTask[]>([]);
  const [schedulerActive, setSchedulerActive] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const pollRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const load = useCallback(() => {
    fetch("/api/monitors")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
      })
      .catch(() => {});
    fetch("/api/monitors/scheduler/status")
      .then((r) => r.json())
      .then((data) => setSchedulerActive(data.initialized && data.active_jobs > 0))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  // Cleanup poll intervals
  useEffect(() => {
    return () => {
      for (const interval of pollRefs.current.values()) {
        clearInterval(interval);
      }
    };
  }, []);

  const handleToggle = useCallback(async (task: MonitorTask) => {
    try {
      const res = await fetch(`/api/monitors/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !task.enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      load();
    } catch {
      showToast("Failed to toggle task", "error");
    }
  }, [load]);

  const handleRunNow = useCallback(async (taskId: string) => {
    try {
      const res = await fetch(`/api/monitors/${taskId}/run`, { method: "POST" });
      if (res.status === 409) {
        showToast("Task is already running", "error");
        return;
      }
      if (!res.ok) throw new Error("Failed to start");

      setRunningIds((prev) => new Set(prev).add(taskId));

      // Poll until no longer running
      const poll = setInterval(() => {
        fetch(`/api/monitors/${taskId}`)
          .then((r) => r.json())
          .then((data) => {
            if (!data.running) {
              clearInterval(poll);
              pollRefs.current.delete(taskId);
              setRunningIds((prev) => {
                const next = new Set(prev);
                next.delete(taskId);
                return next;
              });
              load();
            }
          })
          .catch(() => {});
      }, 3000);
      pollRefs.current.set(taskId, poll);
    } catch {
      showToast("Failed to run task", "error");
    }
  }, [load]);

  const handleDelete = useCallback(async (task: MonitorTask) => {
    if (!confirm(`Delete monitoring task "${task.name}"?`)) return;
    try {
      const res = await fetch(`/api/monitors/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      showToast("Task deleted", "success");
      load();
    } catch {
      showToast("Failed to delete", "error");
    }
  }, [load]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
          <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700, margin: 0 }}>Monitoring Tasks</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className={`status-dot ${schedulerActive ? "active" : "disabled"}`} />
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
              {schedulerActive ? "Scheduler active" : "No active schedules"}
            </span>
          </div>
        </div>
        <button className="btn btn-md btn-primary" onClick={onNewTask}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Task
        </button>
      </div>

      {/* Task list */}
      {tasks.length === 0 && (
        <div className="card" style={{ padding: "var(--sp-8)", textAlign: "center" }}>
          <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginBottom: "var(--sp-3)" }}>
            No monitoring tasks yet
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
            Create a task to automatically screen addresses on a schedule
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        {tasks.map((task) => {
          const isRunning = runningIds.has(task.id) || task.running;
          return (
            <div
              key={task.id}
              className={`monitor-card ${isRunning ? "running" : ""} ${!task.enabled ? "disabled" : ""}`}
            >
              {/* Row 1: Name + Toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-2)" }}>
                <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{task.name}</div>
                <button
                  className={`toggle ${task.enabled ? "active" : ""}`}
                  onClick={() => handleToggle(task)}
                  title={task.enabled ? "Disable" : "Enable"}
                />
              </div>

              {/* Row 2: Schedule + Scenario + Ruleset */}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-2)", flexWrap: "wrap" }}>
                <span className="schedule-badge">
                  {PRESET_LABELS[task.schedule_preset] || task.schedule}
                </span>
                <span className="badge badge-neutral">{task.scenario}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                  {task.ruleset_id.replace(/_/g, " ")}
                </span>
              </div>

              {/* Row 3: Address count + chains + last run */}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-2)", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                <span>{task.addresses.length} address{task.addresses.length !== 1 ? "es" : ""}</span>
                <span>
                  {[...new Set(task.addresses.map((a) => a.chain))].map((c) => (
                    <span key={c} className="badge badge-neutral" style={{ marginRight: 4 }}>{c}</span>
                  ))}
                </span>
                <span>Last: {relativeTime(task.last_run_at)}</span>
              </div>

              {/* Row 4: Last run summary (if available) */}
              {task.last_result_summary && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-2)", fontSize: "var(--text-xs)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {task.last_result_summary.flagged}/{task.last_result_summary.total_addresses} flagged
                  </span>
                  {task.last_result_summary.highest_risk !== "Low" && (
                    <span className={`risk-pill ${task.last_result_summary.highest_risk.toLowerCase()}`}>
                      {task.last_result_summary.highest_risk}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-2)", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--sp-3)" }}>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleRunNow(task.id)}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <>
                      <span className="spinner spinner-sm" />
                      Running...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Run Now
                    </>
                  )}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => onSelectHistory(task.id, task.name)}
                >
                  History
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => onEdit(task)}>
                  Edit
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(task)}>
                  Delete
                </button>
              </div>

              {/* Address preview (collapsed) */}
              <div style={{ marginTop: "var(--sp-2)", display: "flex", flexWrap: "wrap", gap: 4 }}>
                {task.addresses.slice(0, 3).map((a, i) => (
                  <span
                    key={i}
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "0.65rem",
                      background: "var(--surface-3)",
                      padding: "1px 6px",
                      borderRadius: 3,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {shortenAddr(a.address)}
                  </span>
                ))}
                {task.addresses.length > 3 && (
                  <span style={{ fontSize: "0.65rem", color: "var(--text-tertiary)" }}>
                    +{task.addresses.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
