"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { renderMarkdown } from "@/lib/utils";

interface Props {
  jobId: string;
  job: Record<string, unknown>;
  onClose: () => void;
}

const JURISDICTIONS = [
  { id: "generic", label: "Generic", icon: "🌐" },
  { id: "singapore", label: "Singapore", icon: "🇸🇬" },
  { id: "hongkong", label: "Hong Kong", icon: "🇭🇰" },
  { id: "dubai", label: "Dubai", icon: "🇦🇪" },
];

export default function SARGenerator({ jobId, job, onClose }: Props) {
  const [jurisdiction, setJurisdiction] = useState("generic");
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [output, setOutput] = useState("");
  const [sarId, setSarId] = useState<string | null>(null);
  const [sarRef, setSarRef] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const r = (job.result as Record<string, unknown>) || {};
  const req = (job.request as Record<string, unknown>) || {};
  const target = (r.target as Record<string, unknown>) || {};
  const summary = (r.summary as Record<string, unknown>) || {};

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const generate = useCallback(async () => {
    setOutput("");
    setStatus("generating");
    setSarId(null);
    setSarRef(null);
    setEditing(false);
    setElapsed(0);

    // Start timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      // Fire-and-forget: API returns 202 immediately
      const res = await fetch("/api/sar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screening_job_id: jobId, jurisdiction }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setStatus("error");
        setOutput(err.error || "Generation failed");
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      const data = await res.json();
      setSarId(data.id);
      setSarRef(data.reference);

      // Poll for completion
      pollingRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/sar/${data.id}`);
          if (!pollRes.ok) return;
          const sar = await pollRes.json();

          if (sar.status === "draft" || sar.status === "final") {
            // Done!
            setOutput(sar.content || "");
            setStatus("done");
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
          }
        } catch { /* retry */ }
      }, 3000);

    } catch {
      setStatus("error");
      setOutput("Generation failed");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [jobId, jurisdiction]);

  const startEdit = () => {
    setEditContent(output);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!sarId) return;
    setSaving(true);
    try {
      await fetch(`/api/sar/${sarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      setOutput(editContent);
      setEditing(false);
    } catch { /* */ }
    setSaving(false);
  };

  const saveFinal = async () => {
    if (!sarId) return;
    setSaving(true);
    const content = editing ? editContent : output;
    try {
      await fetch(`/api/sar/${sarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, status: "final" }),
      });
      if (editing) { setOutput(content); setEditing(false); }
    } catch { /* */ }
    setSaving(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="sar-overlay" onClick={onClose}>
      <div className="sar-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sar-header">
          <div>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 700 }}>Generate SAR</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
              {(target.chain as string) || (req.chain as string) || ""} &middot;{" "}
              {((target.address as string) || (req.address as string) || "").slice(0, 16)}... &middot;{" "}
              Risk: {(summary.highest_severity as string) || "Low"}
              {sarRef && <> &middot; {sarRef}</>}
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose} style={{ padding: "4px 8px" }}>✕</button>
        </div>

        {/* Jurisdiction tabs */}
        <div className="sar-tabs">
          {JURISDICTIONS.map((j) => (
            <button
              key={j.id}
              className={`sar-tab ${jurisdiction === j.id ? "active" : ""}`}
              onClick={() => setJurisdiction(j.id)}
              disabled={status === "generating"}
            >
              {j.icon} {j.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="sar-content" ref={scrollRef}>
          {status === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "var(--sp-4)", color: "var(--text-tertiary)" }}>
              <div style={{ fontSize: "2rem" }}>📋</div>
              <div style={{ fontSize: "var(--text-sm)" }}>Select jurisdiction and click Generate</div>
            </div>
          )}
          {status === "generating" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--sp-3)", padding: "var(--sp-6)", color: "var(--text-tertiary)", height: "100%" }}>
              <div className="spinner" />
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>Generating SAR...</div>
              <div style={{ fontSize: "var(--text-xs)", textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>
                You can close this dialog — the report will be available in <strong style={{ color: "var(--text-secondary)" }}>SAR Reports</strong> when ready.
              </div>
            </div>
          )}
          {output && !editing && (
            <div className="md-content markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }} />
          )}
          {editing && (
            <textarea
              className="sar-editor"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          )}
          {status === "error" && !output && (
            <div style={{ color: "var(--danger)", padding: "var(--sp-4)" }}>Generation failed</div>
          )}
        </div>

        {/* Footer */}
        <div className="sar-footer">
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {status === "generating" && `Generating... (${elapsed}s)`}
            {status === "done" && `Done (${elapsed}s) · ${(output.length / 1024).toFixed(1)}K`}
            {status === "error" && "Error"}
            {status === "idle" && "Ready"}
          </div>
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            {status === "idle" && (
              <button className="btn btn-sm btn-primary" onClick={generate}>Generate</button>
            )}
            {status === "done" && !editing && (
              <>
                <button className="btn btn-sm btn-secondary" onClick={startEdit}>Edit</button>
                <button className="btn btn-sm btn-secondary" onClick={saveFinal} disabled={saving}>
                  {saving ? "Saving..." : "Save as Final"}
                </button>
                {sarId && (
                  <>
                    <a href={`/api/sar/${sarId}/export?format=pdf`} target="_blank" className="btn btn-sm btn-secondary" rel="noreferrer">PDF</a>
                    <a href={`/api/sar/${sarId}/export?format=md`} target="_blank" className="btn btn-sm btn-secondary" rel="noreferrer">MD</a>
                  </>
                )}
              </>
            )}
            {editing && (
              <>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={saving}>
                  {saving ? "Saving..." : "Save Edit"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
