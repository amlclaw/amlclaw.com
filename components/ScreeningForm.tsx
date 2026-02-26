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
        <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
          <div style={{ flex: 1 }}>
            <label className="label">Rule Set</label>
            <select className="input" value={rulesetId} onChange={(e) => setRulesetId(e.target.value)} required>
              {rulesets.map((rs) => (
                <option key={rs.id} value={rs.id}>
                  {rs.name} ({rs.rules_count} rules)
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Scenario</label>
            <select className="input" value={scenario} onChange={(e) => setScenario(e.target.value)} required>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="onboarding">Onboarding (KYC)</option>
              <option value="cdd">CDD</option>
              <option value="monitoring">Monitoring</option>
              <option value="all">All (Full Scan)</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
          <div style={{ flex: 1 }}>
            <label className="label">Chain</label>
            <select className="input" value={chain} onChange={(e) => setChain(e.target.value)} required>
              <option value="Tron">Tron</option>
              <option value="Ethereum">Ethereum</option>
              <option value="Bitcoin">Bitcoin</option>
              <option value="Solana">Solana</option>
            </select>
          </div>
          <div style={{ flex: 3 }}>
            <label className="label">Address</label>
            <input
              type="text"
              className="input input-mono"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter blockchain address..."
              required
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-end" }}>
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
          <div>
            <button
              type="submit"
              className="btn btn-md btn-primary"
              disabled={submitting}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {submitting ? "Screening..." : "Start Screening"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
