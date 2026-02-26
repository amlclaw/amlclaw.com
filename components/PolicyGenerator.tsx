"use client";

import { useState, useCallback } from "react";
import { showToast } from "@/lib/utils";
import AIStreamPanel from "./AIStreamPanel";

interface Props {
  documentIds: string[];
  onPolicyCreated: (policyId: string) => void;
  onCancel: () => void;
}

export default function PolicyGenerator({ documentIds, onPolicyCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("Singapore");
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleStart = useCallback(async () => {
    if (!name.trim()) {
      showToast("Enter a policy name", "error");
      return;
    }

    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          jurisdiction,
          source_documents: documentIds,
        }),
      });
      if (!res.ok) throw new Error("Failed to create policy");
      const policy = await res.json();
      setPolicyId(policy.id);
      setGenerating(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    }
  }, [name, jurisdiction, documentIds]);

  if (generating && policyId) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "var(--sp-3) var(--sp-4)", borderBottom: "1px solid var(--border-default)", background: "var(--surface-1)", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }}>
          <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
            Generating: {name}
          </h3>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
            {jurisdiction} &middot; {documentIds.length} source docs
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <AIStreamPanel
            endpoint="/api/policies/generate"
            body={{ policyId, documentIds, jurisdiction }}
            active={true}
            onComplete={(id) => {
              showToast("Policy generated successfully", "success");
              onPolicyCreated(id);
            }}
            onError={(err) => {
              showToast(`Generation failed: ${err}`, "error");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Generate Compliance Policy</h3>
        <button className="btn-icon" onClick={onCancel}>&times;</button>
      </div>
      <div style={{ padding: "var(--sp-5)", flex: 1 }}>
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <label className="label">Policy Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Singapore MAS DPT Compliance Policy"
          />
        </div>
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <label className="label">Jurisdiction</label>
          <select className="input" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
            <option>Singapore</option>
            <option>Hong Kong</option>
            <option>Dubai</option>
            <option>International</option>
            <option>Custom</option>
          </select>
        </div>
        <div style={{ marginBottom: "var(--sp-5)" }}>
          <label className="label">Source Documents</label>
          <div
            style={{
              background: "var(--surface-2)", border: "1px solid var(--border-default)", borderRadius: "var(--radius)",
              padding: "10px 14px", fontSize: "var(--text-sm)", color: "var(--text-secondary)",
            }}
          >
            {documentIds.length} document{documentIds.length !== 1 ? "s" : ""} selected
          </div>
        </div>
        <button
          className={`btn btn-lg ${name.trim() ? "btn-primary" : "btn-secondary"}`}
          onClick={handleStart}
          disabled={!name.trim()}
          style={{ width: "100%" }}
        >
          Start AI Generation
        </button>
      </div>
    </div>
  );
}
