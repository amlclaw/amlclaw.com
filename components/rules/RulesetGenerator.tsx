"use client";

import { useState, useEffect, useRef } from "react";
import { showToast } from "@/lib/utils";

interface PolicyMeta {
  id: string;
  name: string;
  jurisdiction: string;
  status: string;
}

interface Props {
  initialPolicyId?: string;
  onComplete: (rulesetId: string) => void;
  onCancel: () => void;
}

export default function RulesetGenerator({ initialPolicyId, onComplete, onCancel }: Props) {
  const [policies, setPolicies] = useState<PolicyMeta[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState(initialPolicyId || "");
  const [customInstructions, setCustomInstructions] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [rulesetId, setRulesetId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((data: PolicyMeta[]) => {
        const ready = data.filter((p) => p.status === "ready");
        setPolicies(ready);
      })
      .catch(() => {});
  }, [initialPolicyId]);

  // Auto-generate name from selected policy
  const selectedPolicyMeta = policies.find((p) => p.id === selectedPolicy);
  const autoName = selectedPolicyMeta ? `${selectedPolicyMeta.name} Rules` : "";

  // Poll for completion
  useEffect(() => {
    if (status !== "generating" || !rulesetId) return;

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/rulesets");
        if (!res.ok) return;
        const rulesets = await res.json();
        const target = rulesets.find((r: Record<string, unknown>) => r.id === rulesetId);

        if (target?.status === "ready") {
          setStatus("ready");
          showToast("Rules generated successfully", "success");
          onComplete(rulesetId);
        } else if (target?.status === "error") {
          setStatus("error");
          showToast("Rule generation failed", "error");
        }
      } catch { /* retry next poll */ }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, rulesetId, onComplete]);

  const handleStart = async () => {
    if (!selectedPolicy) {
      showToast("Select a policy", "error");
      return;
    }

    try {
      const res = await fetch("/api/rulesets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyId: selectedPolicy,
          name: autoName,
          jurisdiction: selectedPolicyMeta?.jurisdiction || "Custom",
          customInstructions: customInstructions.trim() || undefined,
        }),
      });

      if (res.status === 409) {
        showToast("AI is busy with another task. Please wait.", "error");
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to start generation");
      }

      const data = await res.json();
      setRulesetId(data.rulesetId);
      setStatus("generating");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  if (status === "generating") {
    return (
      <div className="card">
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
              AI is generating detection rules...
            </div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
              {elapsed}s elapsed
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--sp-3)" }}>
              This may take a few minutes. You can close this panel and check back later — the ruleset will appear in the sidebar when ready.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card">
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
            Rule generation failed. Make sure Claude Code is connected and try again.
          </div>
          <button className="btn btn-primary" onClick={() => setStatus("idle")}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="panel-header">
        <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Generate Rules from Policy</h3>
        <button className="btn-icon" onClick={onCancel}>&times;</button>
      </div>
      <div style={{ padding: "var(--sp-5)" }}>
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <label className="label">Source Policy</label>
          <select className="input" value={selectedPolicy} onChange={(e) => setSelectedPolicy(e.target.value)}>
            <option value="">Select a policy...</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.jurisdiction})
              </option>
            ))}
          </select>
          {policies.length === 0 && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--sp-2)" }}>
              No ready policies found. Generate a policy first.
            </div>
          )}
        </div>
        <div style={{ marginBottom: "var(--sp-5)" }}>
          <label className="label">Custom Instructions <span style={{ fontWeight: 400, color: "var(--text-tertiary)" }}>(optional)</span></label>
          <textarea
            className="input"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g. Set stricter thresholds for sanctions, add rules for stablecoin monitoring, focus on FATF travel rule..."
            rows={3}
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--sp-1)" }}>
            Guide the AI to customize rules for your compliance requirements.
          </div>
        </div>
        <button
          className={`btn btn-lg ${selectedPolicy ? "btn-primary" : "btn-secondary"}`}
          onClick={handleStart}
          disabled={!selectedPolicy}
          style={{ width: "100%" }}
        >
          {autoName ? `Generate "${autoName}"` : "Generate Rules"}
        </button>
      </div>
    </div>
  );
}
