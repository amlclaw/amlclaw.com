"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { showToast } from "@/lib/utils";

interface Props {
  documentIds: string[];
  onPolicyCreated: (policyId: string) => void;
  onCancel: () => void;
}

export default function PolicyGenerator({ documentIds, onPolicyCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("Singapore");
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [elapsed, setElapsed] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for completion
  useEffect(() => {
    if (status !== "generating" || !policyId) return;

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/policies/${policyId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "ready") {
          setStatus("ready");
          showToast("Policy generated successfully", "success");
          onPolicyCreated(policyId);
        } else if (data.status === "error") {
          setStatus("error");
          showToast("Policy generation failed", "error");
        }
      } catch { /* retry next poll */ }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, policyId, onPolicyCreated]);

  const handleStart = useCallback(async () => {
    if (!name.trim()) {
      showToast("Enter a policy name", "error");
      return;
    }

    try {
      // 1. Create policy record
      const createRes = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          jurisdiction,
          source_documents: documentIds,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create policy");
      const policy = await createRes.json();

      // 2. Trigger background generation
      const genRes = await fetch("/api/policies/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: policy.id,
          documentIds,
          jurisdiction,
        }),
      });

      if (genRes.status === 409) {
        showToast("AI is busy with another task. Please wait.", "error");
        return;
      }
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to start generation");
      }

      setPolicyId(policy.id);
      setStatus("generating");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    }
  }, [name, jurisdiction, documentIds]);

  if (status === "generating") {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
            Generating: {name}
          </h3>
          <button className="btn btn-sm btn-secondary" onClick={onCancel}>
            Close
          </button>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-4)",
            padding: "var(--sp-8)",
            minHeight: 300,
          }}
        >
          <div className="spinner" />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
              AI is generating your compliance policy...
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
              {jurisdiction} &middot; {documentIds.length} source docs &middot; {elapsed}s elapsed
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--sp-3)" }}>
              This may take a few minutes. You can close this panel and check back later — the policy will appear in the sidebar when ready.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Generation Failed</h3>
          <button className="btn-icon" onClick={onCancel}>&times;</button>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--sp-4)",
            padding: "var(--sp-8)",
            minHeight: 300,
          }}
        >
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", textAlign: "center" }}>
            Policy generation failed. Please check your AI provider settings and try again.
          </div>
          <button className="btn btn-primary" onClick={() => setStatus("idle")}>
            Try Again
          </button>
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
