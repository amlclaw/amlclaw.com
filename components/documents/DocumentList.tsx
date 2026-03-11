"use client";

import { useState, useEffect, useCallback } from "react";
import { iconText } from "@/lib/utils";
import DocumentModal from "./DocumentModal";

interface Doc {
  id: string;
  name: string;
  category: string;
  icon: string;
}

export default function DocumentList() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then(setDocs)
      .catch(() => {});
  }, []);

  const filtered = search
    ? docs.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.category.toLowerCase().includes(search.toLowerCase())
      )
    : docs;

  const groups: Record<string, Doc[]> = {};
  filtered.forEach((d) => {
    if (!groups[d.category]) groups[d.category] = [];
    groups[d.category].push(d);
  });

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

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Regulatory Documents</h2>
        <input
          type="text"
          className="input input-sm"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 140 }}
        />
      </div>
      <div className="panel-body" style={{ maxHeight: 600 }}>
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <div className="label" style={{ padding: "var(--sp-2) var(--sp-3) var(--sp-1)" }}>
              {cat}
            </div>
            {items.map((doc) => (
              <div key={doc.id} className="list-item" onClick={() => openDoc(doc)}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: "var(--radius)",
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
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                    {doc.category}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--sp-8)", color: "var(--text-tertiary)" }}>
            No documents found
          </div>
        )}
      </div>
      <DocumentModal
        open={modalOpen}
        title={modalTitle}
        content={modalContent}
        loading={modalLoading}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
