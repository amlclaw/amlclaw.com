"use client";

import { useState, useEffect, useCallback } from "react";
import { formatTime } from "@/lib/utils";

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

const ACTION_FILTERS = [
  { value: "", label: "All Events" },
  { value: "screening", label: "Screening" },
  { value: "ruleset", label: "Rulesets" },
  { value: "policy", label: "Policies" },
  { value: "monitor", label: "Monitoring" },
  { value: "settings", label: "Settings" },
  { value: "webhook", label: "Webhooks" },
];

const ACTION_COLORS: Record<string, string> = {
  "screening.completed": "var(--success)",
  "screening.error": "var(--danger)",
  "screening.started": "var(--info)",
  "screening.batch_started": "var(--info)",
  "screening.batch_completed": "var(--success)",
  "screening.exported": "var(--text-secondary)",
  "ruleset.created": "var(--primary-400)",
  "ruleset.generated": "var(--primary-400)",
  "ruleset.deleted": "var(--danger)",
  "policy.created": "var(--primary-400)",
  "policy.generated": "var(--primary-400)",
  "policy.deleted": "var(--danger)",
  "monitor.run_completed": "var(--success)",
  "monitor.created": "var(--primary-400)",
  "settings.updated": "var(--warning)",
  "webhook.sent": "var(--success)",
  "webhook.failed": "var(--danger)",
};

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (filter) params.set("action", filter);
    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [offset, filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: "var(--sp-5) var(--sp-6)" }}>
      <div style={{ marginBottom: "var(--sp-4)" }}>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--sp-1)" }}>Audit Log</h1>
        <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
          Complete record of all compliance operations for regulatory traceability.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-3)", alignItems: "center" }}>
        <select
          className="input input-sm"
          style={{ width: 200 }}
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setOffset(0); }}
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginLeft: "auto" }}>
          {total} total events
        </span>
      </div>

      {/* Events */}
      <div className="card">
        {loading ? (
          <div style={{ padding: "var(--sp-8)", textAlign: "center" }}>
            <div className="spinner" />
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            No audit events recorded yet. Events are logged automatically as you use the platform.
          </div>
        ) : (
          <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
            <thead>
              <tr>
                <th style={{ width: 160 }}>Timestamp</th>
                <th style={{ width: 200 }}>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text-tertiary)" }}>
                    {formatTime(evt.timestamp)}
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontFamily: "var(--mono)",
                        fontSize: "0.65rem",
                        color: ACTION_COLORS[evt.action] || "var(--text-secondary)",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: ACTION_COLORS[evt.action] || "var(--text-tertiary)",
                          flexShrink: 0,
                        }}
                      />
                      {evt.action}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-secondary)", fontSize: "0.65rem", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {formatDetails(evt.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > limit && (
          <div style={{ display: "flex", justifyContent: "center", gap: "var(--sp-2)", padding: "var(--sp-3)", borderTop: "1px solid var(--border-subtle)" }}>
            <button
              className="btn btn-sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </button>
            <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", alignSelf: "center" }}>
              {offset + 1}-{Math.min(offset + limit, total)} of {total}
            </span>
            <button
              className="btn btn-sm"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDetails(details: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(details)) {
    if (val === undefined || val === null) continue;
    if (key === "sections" && Array.isArray(val)) {
      parts.push(`sections: ${val.join(", ")}`);
    } else {
      parts.push(`${key}: ${String(val)}`);
    }
  }
  return parts.join(" | ");
}
