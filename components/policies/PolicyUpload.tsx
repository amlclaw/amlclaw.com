"use client";

import { useState, useRef } from "react";
import { showToast } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded: (policyId: string) => void;
}

export default function PolicyUpload({ open, onClose, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jurisdiction, setJurisdiction] = useState("Custom");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["md", "txt"].includes(ext)) {
      showToast("Only .md and .txt files are supported", "error");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jurisdiction", jurisdiction);
      const res = await fetch("/api/policies/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const policy = await res.json();
      showToast(`Uploaded: ${file.name}`, "success");
      onUploaded(policy.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload failed", "error");
    }
    setUploading(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Upload Policy</h3>
          <button className="btn-icon" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: "var(--sp-4)" }}>
            <label className="label">Jurisdiction</label>
            <select className="input" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
              <option>Custom</option>
              <option>Singapore</option>
              <option>Hong Kong</option>
              <option>Dubai</option>
              <option>International</option>
            </select>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "var(--primary-500)" : "var(--border-default)"}`,
              borderRadius: "var(--radius-lg)",
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragging ? "var(--primary-dim)" : "transparent",
              transition: "all var(--transition)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>
              {uploading ? (
                <div className="spinner spinner-lg" style={{ margin: "0 auto" }} />
              ) : (
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{ margin: "0 auto" }}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              )}
            </div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
              {uploading ? "Uploading..." : "Drop policy file here or click to browse"}
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
              Supports .md and .txt files
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".md,.txt"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      </div>
    </div>
  );
}
