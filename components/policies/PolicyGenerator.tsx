"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { showToast } from "@/lib/utils";

interface Props {
  documentIds: string[];
  onPolicyCreated: (policyId: string) => void;
  onCancel: () => void;
}

export default function PolicyGenerator({ documentIds, onPolicyCreated, onCancel }: Props) {
  const [jurisdiction, setJurisdiction] = useState("Singapore");
  const [customInstructions, setCustomInstructions] = useState("");
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [elapsed, setElapsed] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-generate name from jurisdiction
  const autoName = `${jurisdiction} AML Policy`;

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
    try {
      // 1. Create policy record with auto-generated name
      const createRes = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: autoName,
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
          customInstructions: customInstructions.trim() || undefined,
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
  }, [autoName, jurisdiction, documentIds, customInstructions]);

  if (status === "generating") {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
            Generating: {autoName}
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
            Policy generation failed. Make sure Claude Code is connected and try again.
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
          <label className="label">Jurisdiction</label>
          <select className="input" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
            <option>Singapore</option>
            <option>Hong Kong</option>
            <option>Dubai</option>
            <option>International</option>
            <option>Custom</option>
          </select>
        </div>
        <div style={{ marginBottom: "var(--sp-4)" }}>
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
        <div style={{ marginBottom: "var(--sp-5)" }}>
          <label className="label">Custom Instructions <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>(optional)</span></label>
          <textarea
            className="input"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g. Focus on DeFi-specific risks, include travel rule requirements, use formal tone..."
            rows={3}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--sp-1)" }}>
            Guide the AI to tailor the policy to your specific needs.
          </div>
        </div>
        <button
          className="btn btn-lg btn-primary"
          onClick={handleStart}
          style={{ width: "100%" }}
        >
          Generate &ldquo;{autoName}&rdquo;
        </button>
      </div>
    </div>
  );
}
