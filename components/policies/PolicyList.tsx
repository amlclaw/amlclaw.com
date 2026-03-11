"use client";

import { useState, useEffect, useCallback } from "react";
import { showToast, formatTime } from "@/lib/utils";
import PolicyUpload from "./PolicyUpload";

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
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then(setPolicies)
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  // Auto-poll when any policy is generating
  useEffect(() => {
    const hasGenerating = policies.some((p) => p.status === "generating");
    if (!hasGenerating) return;

    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [policies, load]);

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
        <h2>Policies</h2>
        <div style={{ display: "flex", gap: "var(--sp-1)" }}>
          <button className="btn btn-sm btn-secondary" onClick={() => setUploadOpen(true)} title="Upload policy">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </button>
          <button className="btn btn-sm btn-primary" onClick={onGenerate}>
            + Generate
          </button>
        </div>
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
      <PolicyUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(policyId) => {
          setUploadOpen(false);
          load();
          onSelect(policyId);
        }}
      />
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
