"use client";

import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/lib/utils";

interface Ruleset {
  id: string;
  name: string;
  rules_count: number;
}

interface ScreeningFormProps {
  onJobStarted: (jobId: string) => void;
  onLoading: (loading: boolean) => void;
}

const SCENARIOS = [
  { value: "deposit", label: "Deposit", desc: "Inflow source" },
  { value: "withdrawal", label: "Withdrawal", desc: "Outflow dest check" },
  { value: "onboarding", label: "Onboarding", desc: "KYC self-tag + history" },
  { value: "cdd", label: "CDD", desc: "Threshold triggers" },
  { value: "monitoring", label: "Monitoring", desc: "Structuring alerts" },
  { value: "all", label: "Full Scan", desc: "All rules applied" },
];

export default function ScreeningForm({ onJobStarted, onLoading }: ScreeningFormProps) {
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [rulesetId, setRulesetId] = useState("");
  const [scenario, setScenario] = useState("deposit");
  const [chain, setChain] = useState("Tron");
  const [address, setAddress] = useState("");
  const [inflowHops, setInflowHops] = useState("3");
  const [outflowHops, setOutflowHops] = useState("3");
  const [maxNodes, setMaxNodes] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetch("/api/rulesets")
      .then((r) => r.json())
      .then((data) => {
        setRulesets(data);
        if (data.length > 0) setRulesetId(data[0].id);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!address.trim()) {
        showToast("Please enter an address", "error");
        return;
      }

      setSubmitting(true);
      onLoading(true);

      try {
        const res = await fetch("/api/screening", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ruleset_id: rulesetId,
            scenario,
            chain,
            address: address.trim(),
            inflow_hops: inflowHops,
            outflow_hops: outflowHops,
            max_nodes: maxNodes,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to start screening");
        }

        const { job_id } = await res.json();
        onJobStarted(job_id);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
        onLoading(false);
      }
      setSubmitting(false);
    },
    [rulesetId, scenario, chain, address, inflowHops, outflowHops, maxNodes, onJobStarted, onLoading]
  );

  return (
    <div className="card" style={{ padding: "var(--sp-5)" }}>
      <form onSubmit={handleSubmit}>
        {/* Hero Address Input */}
        <div className="screening-address-input" style={{ marginBottom: "var(--sp-4)" }}>
          <select
            className="screening-chain-select"
            value={chain}
            onChange={(e) => setChain(e.target.value)}
          >
            <option value="Tron">Tron</option>
            <option value="Ethereum">Ethereum</option>
            <option value="Bitcoin">Bitcoin</option>
            <option value="Solana">Solana</option>
          </select>
          <div className="screening-chain-divider" />
          <input
            type="text"
            className="screening-address-field"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter blockchain address..."
            required
          />
        </div>

        {/* Scenario Chips */}
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <label className="label">Scenario</label>
          <div className="screening-chips">
            {SCENARIOS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`screening-chip${scenario === s.value ? " active" : ""}`}
                onClick={() => setScenario(s.value)}
              >
                <span className="screening-chip-label">{s.label}</span>
                <span className="screening-chip-desc">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rule Set Dropdown */}
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <label className="label">Rule Set</label>
          <select
            className="input"
            value={rulesetId}
            onChange={(e) => setRulesetId(e.target.value)}
            required
          >
            {rulesets.map((rs) => (
              <option key={rs.id} value={rs.id}>
                {rs.name} ({rs.rules_count} rules)
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Settings Toggle */}
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <button
            type="button"
            className="screening-advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: showAdvanced ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 200ms",
              }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Advanced Settings
          </button>
          {showAdvanced && (
            <div className="screening-advanced-body" style={{ marginTop: "var(--sp-2)" }}>
              <div style={{ display: "flex", gap: "var(--sp-3)" }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Inflow Hops</label>
                  <select className="input" value={inflowHops} onChange={(e) => setInflowHops(e.target.value)}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Outflow Hops</label>
                  <select className="input" value={outflowHops} onChange={(e) => setOutflowHops(e.target.value)}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Max Nodes</label>
                  <select className="input" value={maxNodes} onChange={(e) => setMaxNodes(e.target.value)}>
                    {[50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-lg btn-primary"
          disabled={submitting}
          style={{ width: "100%" }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {submitting ? "Screening..." : "Start Screening"}
        </button>
      </form>
    </div>
  );
}
