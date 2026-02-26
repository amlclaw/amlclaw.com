"use client";

import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/lib/utils";
import AIStreamPanel from "./AIStreamPanel";

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
  const [name, setName] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((data: PolicyMeta[]) => {
        const ready = data.filter((p) => p.status === "ready");
        setPolicies(ready);
        if (initialPolicyId) {
          const p = ready.find((pol) => pol.id === initialPolicyId);
          if (p) setName(`${p.name} Rules`);
        }
      })
      .catch(() => {});
  }, [initialPolicyId]);

  const handlePolicyChange = useCallback((policyId: string) => {
    setSelectedPolicy(policyId);
    const p = policies.find((pol) => pol.id === policyId);
    if (p && !name) setName(`${p.name} Rules`);
  }, [policies, name]);

  const handleStart = () => {
    if (!selectedPolicy) {
      showToast("Select a policy", "error");
      return;
    }
    if (!name.trim()) {
      showToast("Enter a ruleset name", "error");
      return;
    }
    setGenerating(true);
  };

  const selectedPolicyMeta = policies.find((p) => p.id === selectedPolicy);

  if (generating) {
    return (
      <div style={{ height: "100%" }}>
        <AIStreamPanel
          endpoint="/api/rulesets/generate"
          body={{
            policyId: selectedPolicy,
            name: name.trim(),
            jurisdiction: selectedPolicyMeta?.jurisdiction || "Custom",
          }}
          active={true}
          onComplete={(id) => {
            showToast("Rules generated successfully", "success");
            onComplete(id);
          }}
          onError={(err) => {
            showToast(`Generation failed: ${err}`, "error");
          }}
        />
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
          <select className="input" value={selectedPolicy} onChange={(e) => handlePolicyChange(e.target.value)}>
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
          <label className="label">Ruleset Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Singapore MAS DPT Rules"
          />
        </div>
        <button
          className={`btn btn-lg ${selectedPolicy && name.trim() ? "btn-primary" : "btn-secondary"}`}
          onClick={handleStart}
          disabled={!selectedPolicy || !name.trim()}
          style={{ width: "100%" }}
        >
          Start AI Generation
        </button>
      </div>
    </div>
  );
}
