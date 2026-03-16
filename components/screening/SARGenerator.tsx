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
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [output, setOutput] = useState("");
  const [sarId, setSarId] = useState<string | null>(null);
  const [sarRef, setSarRef] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const cancelledRef = useRef(false);
  const startTimeRef = useRef(0);

  const r = (job.result as Record<string, unknown>) || {};
  const req = (job.request as Record<string, unknown>) || {};
  const target = (r.target as Record<string, unknown>) || {};
  const summary = (r.summary as Record<string, unknown>) || {};

  const generate = useCallback(async () => {
    cancelledRef.current = false;
    setOutput("");
    setStatus("streaming");
    setSarId(null);
    setSarRef(null);
    setEditing(false);
    setElapsed(0);
    startTimeRef.current = Date.now();

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    try {
      const res = await fetch("/api/sar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screening_job_id: jobId, jurisdiction }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setStatus("error");
        setOutput(err.error || "Generation failed");
        clearInterval(timer);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setStatus("error"); clearInterval(timer); return; }
      readerRef.current = reader;

      const decoder = new TextDecoder();
      let buffer = "";

      while (!cancelledRef.current) {
        const { done, value } = await reader.read();
        if (done || cancelledRef.current) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (cancelledRef.current) break;
          if (line.startsWith("event: done")) {
            setStatus("done");
            continue;
          }
          if (line.startsWith("event: error")) {
            setStatus("error");
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) setOutput((prev) => prev + data.text);
              if (data.id) setSarId(data.id);
              if (data.reference) setSarRef(data.reference);
              if (data.error) { setStatus("error"); setOutput(data.error); }
            } catch { /* */ }
          }
        }
      }

      if (!cancelledRef.current) {
        setStatus((prev) => (prev === "error" ? "error" : "done"));
      }
    } catch {
      setStatus("error");
      setOutput("Stream failed");
    }
    clearInterval(timer);
  }, [jobId, jurisdiction]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    setStatus("done");
  }, []);

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
              disabled={status === "streaming"}
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
          {status === "streaming" && !output && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-tertiary)", padding: "var(--sp-4)" }}>
              <div className="spinner spinner-sm" />
              Generating SAR...
            </div>
          )}
          {output && !editing && (
            <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }} />
          )}
          {output && status === "streaming" && <span className="ai-cursor" />}
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
            {status === "streaming" && `Generating... (${elapsed}s)`}
            {status === "done" && `Done (${elapsed}s) · ${(output.length / 1024).toFixed(1)}K`}
            {status === "error" && "Error"}
            {status === "idle" && "Ready"}
          </div>
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            {status === "streaming" && (
              <button className="btn btn-sm btn-danger" onClick={stop}>Stop</button>
            )}
            {status === "idle" && (
              <button className="btn btn-sm btn-primary" onClick={generate}>Generate</button>
            )}
            {status === "done" && (
              <>
                <button className="btn btn-sm btn-secondary" onClick={generate}>Regenerate</button>
                {!editing ? (
                  <button className="btn btn-sm btn-secondary" onClick={startEdit}>Edit</button>
                ) : (
                  <>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                    <button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={saving}>
                      {saving ? "Saving..." : "Save Edit"}
                    </button>
                  </>
                )}
                {sarId && (
                  <>
                    <a href={`/api/sar/${sarId}/export?format=pdf`} download className="btn btn-sm btn-secondary">PDF</a>
                    <a href={`/api/sar/${sarId}/export?format=md`} download className="btn btn-sm btn-secondary">MD</a>
                  </>
                )}
                <button className="btn btn-sm btn-primary" onClick={saveFinal} disabled={saving}>
                  {saving ? "Saving..." : "Save as Final"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
