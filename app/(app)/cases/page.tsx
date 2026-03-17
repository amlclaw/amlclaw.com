"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface CaseAttachment {
  id: string;
  filename: string;
  size: number;
  uploaded_at: string;
}

interface CaseNote {
  text: string;
  attachments?: CaseAttachment[];
  created_at: string;
}

interface Case {
  id: string;
  reference: string;
  status: "open" | "under_review" | "closed";
  screening_job_id: string;
  trigger_risk_level: string;
  trigger_address: string;
  trigger_chain: string;
  trigger_scenario?: string;
  trigger_ruleset?: string;
  triggered_rules?: string[];
  disposition?: string;
  disposition_reason?: string;
  notes: CaseNote[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  open: { bg: "var(--danger-dim)", color: "var(--danger)", label: "Open" },
  under_review: { bg: "var(--warning-dim)", color: "var(--warning)", label: "Under Review" },
  closed: { bg: "var(--success-dim)", color: "var(--success)", label: "Closed" },
};

const RISK_STYLE: Record<string, string> = {
  Severe: "var(--danger)",
  High: "var(--warning)",
  Medium: "var(--info)",
  Low: "var(--success)",
};

const DISPOSITION_LABELS: Record<string, string> = {
  escalate_str: "Escalated to STR",
  block_freeze: "Blocked / Frozen",
  clear: "Cleared",
  false_positive: "False Positive",
};

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);

  // Note input
  const [noteText, setNoteText] = useState("");
  const [noteFiles, setNoteFiles] = useState<File[]>([]);
  const [addingNote, setAddingNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dialog
  const [showClose, setShowClose] = useState(false);
  const [closeDisposition, setCloseDisposition] = useState("clear");
  const [closeReason, setCloseReason] = useState("");
  const [closing, setClosing] = useState(false);

  const loadCases = useCallback(async () => {
    try {
      const url = filter === "all" ? "/api/cases" : `/api/cases?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) setCases(await res.json());
    } catch { /* */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadCases(); }, [loadCases]);

  // Load selected case detail
  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    fetch(`/api/cases/${selectedId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSelected(d); })
      .catch(() => {});
  }, [selectedId, cases]);

  const handleAddNote = async () => {
    if (!selected || (!noteText.trim() && noteFiles.length === 0)) return;
    setAddingNote(true);
    try {
      if (noteFiles.length > 0) {
        // Use FormData for file upload
        const fd = new FormData();
        fd.append("note", noteText.trim());
        for (const f of noteFiles) fd.append("files", f);
        await fetch(`/api/cases/${selected.id}/attachments`, { method: "POST", body: fd });
      } else {
        await fetch(`/api/cases/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add_note", text: noteText.trim() }),
        });
      }
      setNoteText("");
      setNoteFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadCases();
    } catch { /* */ }
    setAddingNote(false);
  };

  const handleStatusChange = async (status: string) => {
    if (!selected) return;
    await fetch(`/api/cases/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", status }),
    });
    loadCases();
  };

  const handleClose = async () => {
    if (!selected) return;
    setClosing(true);
    await fetch(`/api/cases/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", disposition: closeDisposition, reason: closeReason }),
    });
    setShowClose(false);
    setCloseReason("");
    setClosing(false);
    loadCases();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this case?")) return;
    await fetch(`/api/cases/${id}`, { method: "DELETE" });
    if (selectedId === id) { setSelectedId(null); setSelected(null); }
    loadCases();
  };

  const openCount = cases.filter((c) => c.status === "open").length;
  const reviewCount = cases.filter((c) => c.status === "under_review").length;

  if (loading) {
    return <div style={{ padding: "var(--sp-6)", color: "var(--text-tertiary)" }}>Loading...</div>;
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left: Case list */}
      <div style={{
        width: 380,
        flexShrink: 0,
        borderRight: "1px solid var(--border-default)",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{ padding: "var(--sp-4) var(--sp-5)", borderBottom: "1px solid var(--border-subtle)" }}>
          <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700, margin: 0 }}>Case Management</h1>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", margin: "var(--sp-1) 0 0" }}>
            {openCount > 0 && <span style={{ color: "var(--danger)" }}>{openCount} open</span>}
            {openCount > 0 && reviewCount > 0 && " · "}
            {reviewCount > 0 && <span style={{ color: "var(--warning)" }}>{reviewCount} under review</span>}
            {openCount === 0 && reviewCount === 0 && "No active cases"}
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 1, padding: "var(--sp-2) var(--sp-3)", borderBottom: "1px solid var(--border-subtle)" }}>
          {[
            { id: "all", label: "All" },
            { id: "open", label: "Open" },
            { id: "under_review", label: "Review" },
            { id: "closed", label: "Closed" },
          ].map((f) => (
            <button
              key={f.id}
              className={`btn btn-sm ${filter === f.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilter(f.id)}
              style={{ flex: 1 }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {cases.length === 0 ? (
            <div style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
              No cases. Cases are auto-created when screening detects High or Severe risk.
            </div>
          ) : (
            cases.map((c) => {
              const st = STATUS_STYLE[c.status] || STATUS_STYLE.open;
              const isSelected = selectedId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
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
                      {c.reference}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                      <span style={{
                        fontSize: "var(--text-xs)", padding: "1px 8px", borderRadius: 10,
                        background: st.bg, color: st.color, fontWeight: 500,
                      }}>
                        {st.label}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 14, padding: "0 2px", opacity: 0.4 }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--danger)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.color = "var(--text-tertiary)"; }}
                        title="Delete"
                      >&#x2715;</button>
                    </div>
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
                    <span style={{ color: RISK_STYLE[c.trigger_risk_level] || "var(--text-tertiary)", fontWeight: 600 }}>
                      {c.trigger_risk_level}
                    </span>
                    <span>&middot;</span>
                    <span>{c.trigger_chain}</span>
                    <span>&middot;</span>
                    <span style={{ fontFamily: "var(--mono)" }}>{c.trigger_address.slice(0, 12)}...</span>
                    <span>&middot;</span>
                    <span>{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  {c.disposition && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                      {DISPOSITION_LABELS[c.disposition] || c.disposition}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Case detail */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            {cases.length > 0 ? "Select a case to view" : "Cases are auto-created from High/Severe screening results"}
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: "var(--sp-3) var(--sp-5)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div>
                <span style={{ fontWeight: 600, fontFamily: "var(--mono)", fontSize: "var(--text-sm)" }}>{selected.reference}</span>
                <span style={{
                  marginLeft: "var(--sp-2)", fontSize: "var(--text-xs)", padding: "1px 8px", borderRadius: 10,
                  background: (STATUS_STYLE[selected.status] || STATUS_STYLE.open).bg,
                  color: (STATUS_STYLE[selected.status] || STATUS_STYLE.open).color,
                }}>
                  {(STATUS_STYLE[selected.status] || STATUS_STYLE.open).label}
                </span>
                <span style={{
                  marginLeft: "var(--sp-2)", fontSize: "var(--text-xs)", padding: "1px 8px", borderRadius: 10,
                  background: "rgba(128,128,128,0.1)",
                  color: RISK_STYLE[selected.trigger_risk_level],
                  fontWeight: 600,
                }}>
                  {selected.trigger_risk_level}
                </span>
              </div>
              <div style={{ display: "flex", gap: "var(--sp-2)" }}>
                {selected.status === "open" && (
                  <button className="btn btn-sm btn-secondary" onClick={() => handleStatusChange("under_review")}>
                    Start Review
                  </button>
                )}
                {selected.status !== "closed" && (
                  <button className="btn btn-sm btn-primary" onClick={() => setShowClose(true)}>
                    Close Case
                  </button>
                )}
                <Link href={`/screening?job=${selected.screening_job_id}`} className="btn btn-sm btn-secondary">
                  View Screening
                </Link>
              </div>
            </div>

            {/* Case info */}
            <div style={{ flex: 1, overflowY: "auto", padding: "var(--sp-4) var(--sp-5)" }}>
              {/* Trigger info */}
              <div style={{ marginBottom: "var(--sp-5)" }}>
                <h3 style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: "var(--sp-2)" }}>
                  Trigger Details
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)", fontSize: "var(--text-sm)" }}>
                  <div><span style={{ color: "var(--text-tertiary)" }}>Address:</span> <code style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)" }}>{selected.trigger_address}</code></div>
                  <div><span style={{ color: "var(--text-tertiary)" }}>Chain:</span> {selected.trigger_chain}</div>
                  <div><span style={{ color: "var(--text-tertiary)" }}>Scenario:</span> {selected.trigger_scenario || "—"}</div>
                  <div><span style={{ color: "var(--text-tertiary)" }}>Ruleset:</span> {selected.trigger_ruleset || "—"}</div>
                </div>
                {selected.triggered_rules && selected.triggered_rules.length > 0 && (
                  <div style={{ marginTop: "var(--sp-2)", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                    Rules triggered: {selected.triggered_rules.join(", ")}
                  </div>
                )}
              </div>

              {/* Disposition (if closed) */}
              {selected.status === "closed" && selected.disposition && (
                <div style={{ marginBottom: "var(--sp-5)", padding: "var(--sp-3)", background: "var(--surface-1)", borderRadius: "var(--radius)", border: "1px solid var(--border-subtle)" }}>
                  <h3 style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: "var(--sp-1)" }}>
                    Disposition
                  </h3>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                    {DISPOSITION_LABELS[selected.disposition] || selected.disposition}
                  </div>
                  {selected.disposition_reason && (
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: "var(--sp-1)" }}>
                      {selected.disposition_reason}
                    </div>
                  )}
                  {selected.closed_at && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--sp-1)" }}>
                      Closed: {new Date(selected.closed_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* Timeline / Notes */}
              <div>
                <h3 style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: "var(--sp-3)" }}>
                  Investigation Notes
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", marginBottom: "var(--sp-4)" }}>
                  {selected.notes.map((note, i) => (
                    <div key={i} style={{
                      padding: "var(--sp-2) var(--sp-3)",
                      background: "var(--surface-1)",
                      borderRadius: "var(--radius)",
                      borderLeft: "3px solid var(--border-default)",
                      fontSize: "var(--text-sm)",
                    }}>
                      <div style={{ color: "var(--text-primary)" }}>{note.text}</div>
                      {note.attachments && note.attachments.length > 0 && (
                        <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap", marginTop: 4 }}>
                          {note.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={`/api/cases/${selected.id}/attachments?id=${att.id}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                fontSize: "var(--text-xs)", padding: "2px 8px",
                                background: "var(--surface-2)", borderRadius: 4,
                                color: "var(--primary-400, var(--info))", textDecoration: "none",
                                border: "1px solid var(--border-subtle)",
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                              </svg>
                              {att.filename} ({(att.size / 1024).toFixed(0)}K)
                            </a>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                        {new Date(note.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add note */}
                {selected.status !== "closed" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                    <textarea
                      className="input"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add investigation note..."
                      rows={2}
                      style={{ resize: "vertical", fontFamily: "inherit", fontSize: "var(--text-sm)" }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={(e) => setNoteFiles(Array.from(e.target.files || []))}
                        style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", flex: 1 }}
                      />
                      {noteFiles.length > 0 && (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                          {noteFiles.length} file(s)
                        </span>
                      )}
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={handleAddNote}
                        disabled={(!noteText.trim() && noteFiles.length === 0) || addingNote}
                      >
                        {addingNote ? "Uploading..." : noteFiles.length > 0 ? "Add with Files" : "Add Note"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Close case dialog */}
            {showClose && (
              <div style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
                display: "flex", alignItems: "center", justifyContent: "center",
              }} onClick={() => setShowClose(false)}>
                <div style={{
                  background: "var(--surface-0)", borderRadius: "var(--radius-lg)",
                  padding: "var(--sp-5)", width: 400, maxWidth: "90vw",
                  border: "1px solid var(--border-default)",
                }} onClick={(e) => e.stopPropagation()}>
                  <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--sp-4)" }}>
                    Close Case — {selected.reference}
                  </h3>
                  <div style={{ marginBottom: "var(--sp-3)" }}>
                    <label className="label">Disposition</label>
                    <select className="input" value={closeDisposition} onChange={(e) => setCloseDisposition(e.target.value)}>
                      <option value="escalate_str">Escalate to STR</option>
                      <option value="block_freeze">Block / Freeze</option>
                      <option value="clear">Clear (no further action)</option>
                      <option value="false_positive">False Positive</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: "var(--sp-4)" }}>
                    <label className="label">Reason / Rationale</label>
                    <textarea
                      className="input"
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      placeholder="Describe the investigation findings and rationale for this decision..."
                      rows={4}
                      style={{ resize: "vertical", fontFamily: "inherit" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "flex-end" }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setShowClose(false)}>Cancel</button>
                    <button className="btn btn-sm btn-primary" onClick={handleClose} disabled={closing}>
                      {closing ? "Closing..." : "Close Case"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
