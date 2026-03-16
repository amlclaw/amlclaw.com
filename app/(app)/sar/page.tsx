"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { renderMarkdown } from "@/lib/utils";

interface SAR {
  id: string;
  reference: string;
  screening_job_id: string;
  jurisdiction: string;
  status: "generating" | "draft" | "final" | "filed";
  content: string;
  institution: { name: string; license: string; compliance_officer: string };
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  generating: { bg: "var(--warning-dim)", color: "var(--warning)", label: "Generating" },
  draft: { bg: "var(--info-dim)", color: "var(--info)", label: "Draft" },
  final: { bg: "var(--success-dim)", color: "var(--success)", label: "Final" },
  filed: { bg: "var(--primary-dim, var(--info-dim))", color: "var(--primary-400, var(--info))", label: "Filed" },
};

const JURISDICTION_LABELS: Record<string, string> = {
  generic: "Generic",
  singapore: "Singapore",
  hongkong: "Hong Kong",
  dubai: "Dubai",
};

export default function SARPage() {
  const [sars, setSars] = useState<SAR[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSar, setSelectedSar] = useState<SAR | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSars = useCallback(async () => {
    try {
      const res = await fetch("/api/sar");
      if (res.ok) {
        const data = await res.json();
        setSars(data);
      }
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSars();
  }, [loadSars]);

  // Poll for generating SARs
  useEffect(() => {
    const hasGenerating = sars.some((s) => s.status === "generating");
    if (!hasGenerating) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }
    pollingRef.current = setInterval(loadSars, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [sars, loadSars]);

  // Load full SAR when selected
  useEffect(() => {
    if (!selectedId) { setSelectedSar(null); return; }
    fetch(`/api/sar/${selectedId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setSelectedSar(data); })
      .catch(() => {});
  }, [selectedId, sars]); // re-fetch when sars updates (for generating → draft transition)

  const handleSaveEdit = async () => {
    if (!selectedSar) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sar/${selectedSar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        setEditing(false);
        setSelectedSar({ ...selectedSar, content: editContent });
        loadSars();
      }
    } catch { /* */ }
    setSaving(false);
  };

  const handleMarkFinal = async () => {
    if (!selectedSar) return;
    try {
      await fetch(`/api/sar/${selectedSar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "final" }),
      });
      setSelectedSar({ ...selectedSar, status: "final" });
      loadSars();
    } catch { /* */ }
  };

  const handleExport = (format: "pdf" | "md") => {
    if (!selectedSar) return;
    window.open(`/api/sar/${selectedSar.id}/export?format=${format}`, "_blank");
  };

  if (loading) {
    return <div style={{ padding: "var(--sp-6)", color: "var(--text-tertiary)" }}>Loading...</div>;
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left: SAR list */}
      <div style={{
        width: 360,
        flexShrink: 0,
        borderRight: "1px solid var(--border-default)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ padding: "var(--sp-4) var(--sp-5)", borderBottom: "1px solid var(--border-subtle)" }}>
          <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700, margin: 0 }}>SAR Reports</h1>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "var(--sp-1) 0 0" }}>
            Suspicious Activity Reports generated from screening results
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {sars.length === 0 ? (
            <div style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
              No SAR reports yet. Generate one from a screening result.
            </div>
          ) : (
            sars.map((sar) => {
              const statusInfo = STATUS_COLORS[sar.status] || STATUS_COLORS.draft;
              const isSelected = selectedId === sar.id;
              return (
                <div
                  key={sar.id}
                  onClick={() => setSelectedId(sar.id)}
                  style={{
                    padding: "var(--sp-3) var(--sp-5)",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border-subtle)",
                    background: isSelected ? "var(--surface-2)" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--surface-1)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", fontFamily: "var(--mono)" }}>
                      {sar.reference}
                    </span>
                    <span style={{
                      fontSize: "var(--text-xs)",
                      padding: "1px 8px",
                      borderRadius: 10,
                      background: statusInfo.bg,
                      color: statusInfo.color,
                      fontWeight: 500,
                    }}>
                      {sar.status === "generating" && (
                        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: statusInfo.color, marginRight: 4, animation: "pulse 1.5s infinite" }} />
                      )}
                      {statusInfo.label}
                    </span>
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", gap: "var(--sp-2)" }}>
                    <span>{JURISDICTION_LABELS[sar.jurisdiction] || sar.jurisdiction}</span>
                    <span>&middot;</span>
                    <span>{new Date(sar.created_at).toLocaleDateString()}</span>
                    {sar.institution?.name && (
                      <>
                        <span>&middot;</span>
                        <span>{sar.institution.name}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: SAR detail */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!selectedSar ? (
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-sm)",
          }}>
            {sars.length > 0 ? "Select a SAR report to view" : "Generate a SAR from a screening result to get started"}
          </div>
        ) : selectedSar.status === "generating" ? (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-4)",
          }}>
            <div className="spinner" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>
                Generating {selectedSar.reference}...
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginTop: 4 }}>
                This will appear here automatically when ready.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: "var(--sp-3) var(--sp-5)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div>
                <span style={{ fontWeight: 600, fontFamily: "var(--mono)", fontSize: "var(--text-sm)" }}>
                  {selectedSar.reference}
                </span>
                <span style={{
                  marginLeft: "var(--sp-2)",
                  fontSize: "var(--text-xs)",
                  padding: "1px 8px",
                  borderRadius: 10,
                  background: (STATUS_COLORS[selectedSar.status] || STATUS_COLORS.draft).bg,
                  color: (STATUS_COLORS[selectedSar.status] || STATUS_COLORS.draft).color,
                }}>
                  {(STATUS_COLORS[selectedSar.status] || STATUS_COLORS.draft).label}
                </span>
              </div>
              <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                {!editing && selectedSar.status !== "filed" && (
                  <button className="btn btn-sm btn-secondary" onClick={() => { setEditing(true); setEditContent(selectedSar.content); }}>
                    Edit
                  </button>
                )}
                {!editing && selectedSar.status === "draft" && (
                  <button className="btn btn-sm btn-secondary" onClick={handleMarkFinal}>
                    Mark Final
                  </button>
                )}
                <button className="btn btn-sm btn-secondary" onClick={() => handleExport("pdf")}>
                  PDF
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => handleExport("md")}>
                  MD
                </button>
              </div>
            </div>

            {/* Content */}
            {editing ? (
              <div style={{ flex: 1, overflow: "auto", padding: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                <textarea
                  className="input"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{ flex: 1, fontFamily: "var(--mono)", fontSize: "var(--text-sm)", resize: "none" }}
                />
                <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "flex-end" }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                  <button className="btn btn-sm btn-primary" onClick={handleSaveEdit} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="document-paper-scroll">
                <div className="document-paper">
                  <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedSar.content) }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

