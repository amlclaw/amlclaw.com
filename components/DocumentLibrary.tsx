"use client";

import { useState, useEffect, useCallback } from "react";
import { iconText, showToast } from "@/lib/utils";
import DocumentModal from "./DocumentModal";
import DocumentUpload from "./DocumentUpload";

interface Doc {
  id: string;
  name: string;
  category: string;
  icon: string;
  type?: string;
}

const CATEGORIES = ["All", "FATF", "Singapore", "Hong Kong", "Dubai", "Sanctions", "Reference", "User Upload"];

export default function DocumentLibrary() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadDocs = useCallback(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then(setDocs)
      .catch(() => {});
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const filtered = docs.filter((d) => {
    if (activeCategory !== "All" && d.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q);
    }
    return true;
  });

  const groups: Record<string, Doc[]> = {};
  filtered.forEach((d) => {
    if (!groups[d.category]) groups[d.category] = [];
    groups[d.category].push(d);
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((d) => d.id)));
    }
  };

  const openDoc = useCallback(async (doc: Doc) => {
    setModalTitle(doc.name);
    setModalContent(null);
    setModalLoading(true);
    setModalOpen(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/content`);
      const data = await res.json();
      setModalContent(data.content);
    } catch {
      setModalContent(null);
    }
    setModalLoading(false);
  }, []);

  const handleDeleteUpload = useCallback(async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this uploaded document?")) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      showToast("Document deleted", "success");
      setSelected((prev) => { const n = new Set(prev); n.delete(docId); return n; });
      loadDocs();
    } catch {
      showToast("Delete failed", "error");
    }
  }, [loadDocs]);

  const handleGeneratePolicy = () => {
    if (selected.size === 0) {
      showToast("Select at least one document", "error");
      return;
    }
    const ids = Array.from(selected).join(",");
    window.location.href = `/policies?generate=true&docs=${encodeURIComponent(ids)}`;
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 var(--sp-6) var(--sp-5)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--sp-4)" }}>
        <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>Document Library</h1>
        <button className="btn btn-md btn-secondary" onClick={() => setUploadOpen(true)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload
        </button>
      </div>

      {/* Search + Category Filter */}
      <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-4)", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          className="input"
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220 }}
        />
        <div style={{ display: "flex", gap: "var(--sp-1)", flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => {
            const count = cat === "All" ? docs.length : docs.filter((d) => d.category === cat).length;
            if (count === 0 && cat !== "All") return null;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Document List */}
      <div className="card">
        <div style={{ padding: "10px var(--sp-4)", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            className="checkbox"
            checked={selected.size > 0 && selected.size === filtered.length}
            onChange={toggleAll}
          />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {selected.size > 0 ? `${selected.size} selected` : `${filtered.length} documents`}
          </span>
        </div>
        <div style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
          {Object.entries(groups).map(([cat, items]) => (
            <div key={cat}>
              <div className="label" style={{ padding: "10px var(--sp-4) var(--sp-1)" }}>
                {cat} ({items.length})
              </div>
              {items.map((doc) => (
                <div
                  key={doc.id}
                  className={`list-item${selected.has(doc.id) ? " active" : ""}`}
                  style={{ margin: "0 var(--sp-1)" }}
                >
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={selected.has(doc.id)}
                    onChange={() => toggleSelect(doc.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    onClick={() => openDoc(doc)}
                    style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flex: 1, minWidth: 0 }}
                  >
                    <div
                      style={{
                        width: 34, height: 34, borderRadius: "var(--radius)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "var(--text-sm)", flexShrink: 0,
                        background: "var(--info-dim)", color: "var(--info)",
                      }}
                    >
                      {iconText(doc.icon)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                        {doc.name}
                      </div>
                    </div>
                  </div>
                  {doc.type === "upload" && (
                    <button className="btn-icon" onClick={(e) => handleDeleteUpload(doc.id, e)} title="Delete upload" style={{ fontSize: "var(--text-xs)" }}>
                      &#x2715;
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "var(--sp-10)", color: "var(--text-tertiary)" }}>No documents found</div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      {selected.size > 0 && (
        <div className="bottom-action-bar">
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            {selected.size} document{selected.size > 1 ? "s" : ""} selected
          </span>
          <button className="btn btn-lg btn-primary" onClick={handleGeneratePolicy}>
            Generate Compliance Policy
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      )}

      <DocumentModal
        open={modalOpen}
        title={modalTitle}
        content={modalContent}
        loading={modalLoading}
        onClose={() => setModalOpen(false)}
      />
      <DocumentUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => { loadDocs(); setUploadOpen(false); }}
      />
    </div>
  );
}
