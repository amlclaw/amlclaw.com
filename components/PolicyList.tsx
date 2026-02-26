"use client";

import { useState, useEffect, useCallback } from "react";
import { showToast, formatTime } from "@/lib/utils";

interface PolicyMeta {
  id: string;
  name: string;
  jurisdiction: string;
  status: "generating" | "ready" | "error";
  source_documents: string[];
  created_at: string;
  updated_at: string;
}

interface Props {
  selected: string | null;
  onSelect: (id: string) => void;
  onGenerate: () => void;
  refreshTrigger?: number;
}

export default function PolicyList({ selected, onSelect, onGenerate, refreshTrigger }: Props) {
  const [policies, setPolicies] = useState<PolicyMeta[]>([]);

  const load = useCallback(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then(setPolicies)
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this policy?")) return;
    try {
      const res = await fetch(`/api/policies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      showToast("Policy deleted", "success");
      load();
    } catch {
      showToast("Delete failed", "error");
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Compliance Policies</h2>
        <button className="btn btn-sm btn-primary" onClick={onGenerate}>
          + Generate New
        </button>
      </div>
      <div className="panel-body">
        {policies.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--sp-10)", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            No policies yet. Select documents and generate one.
          </div>
        )}
        {policies.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`list-item${selected === p.id ? " active" : ""}`}
            style={{ marginBottom: "var(--sp-1)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  {p.name}
                </div>
                <div style={{ display: "flex", gap: "var(--sp-2)", marginTop: "var(--sp-1)", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                    {p.source_documents.length} doc{p.source_documents.length !== 1 ? "s" : ""}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                    {formatTime(p.updated_at)}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
              </div>
              <button
                className="btn-icon"
                onClick={(e) => handleDelete(p.id, e)}
                title="Delete"
                style={{ fontSize: "var(--text-xs)" }}
              >
                &#x2715;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    ready: "badge-success",
    generating: "badge-warning",
    error: "badge-danger",
  };
  return (
    <span className={`badge ${cls[status] || "badge-neutral"}`}>
      {status}
    </span>
  );
}
