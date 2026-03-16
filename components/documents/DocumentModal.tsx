"use client";

import { useEffect } from "react";
import { renderMarkdown } from "@/lib/utils";

interface DocumentModalProps {
  open: boolean;
  title: string;
  content: string | null;
  loading: boolean;
  onClose: () => void;
}

export default function DocumentModal({ open, title, content, loading, onClose }: DocumentModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
              Loading document...
            </div>
          ) : content ? (
            <div className="document-paper" style={{ margin: 0, maxWidth: "none" }}>
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 32, color: "var(--danger)" }}>
              Failed to load document
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
