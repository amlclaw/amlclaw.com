"use client";

import { useState, useCallback } from "react";
import { showToast } from "@/lib/utils";

interface KytFormProps {
  onJobStarted: (jobId: string) => void;
  onLoading: (loading: boolean) => void;
}

const DIRECTIONS = [
  { value: "both", label: "Both", desc: "Source + destination" },
  { value: "in", label: "In", desc: "Source of funds (KYT-IN)" },
  { value: "out", label: "Out", desc: "Destination (KYT-OUT)" },
];

export default function KytForm({ onJobStarted, onLoading }: KytFormProps) {
  const [chain, setChain] = useState("Tron");
  const [txId, setTxId] = useState("");
  const [token, setToken] = useState("usdt");
  const [direction, setDirection] = useState("both");
  const [inRulesetId, setInRulesetId] = useState("0");
  const [outRulesetId, setOutRulesetId] = useState("0");
  const [inflowHops, setInflowHops] = useState("3");
  const [outflowHops, setOutflowHops] = useState("3");
  const [maxNodes, setMaxNodes] = useState("200");
  const [minAmount, setMinAmount] = useState("1");
  const [maxOpponentPaths, setMaxOpponentPaths] = useState("50");
  const [penetrateContract, setPenetrateContract] = useState(false);
  const [timeFrom, setTimeFrom] = useState(""); // datetime-local, empty = no limit
  const [timeTo, setTimeTo] = useState("");     // datetime-local, empty = now
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!txId.trim()) {
        showToast("Please enter a transaction hash", "error");
        return;
      }

      setSubmitting(true);
      onLoading(true);

      try {
        const res = await fetch("/api/kyt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain,
            tx_id: txId.trim(),
            token,
            direction,
            in_ruleset_id: inRulesetId,
            out_ruleset_id: outRulesetId,
            inflow_hops: inflowHops,
            outflow_hops: outflowHops,
            max_nodes: maxNodes,
            min_amount: minAmount,
            max_opponent_paths: maxOpponentPaths,
            is_penetrate_contract: penetrateContract,
            min_timestamp: timeFrom ? new Date(timeFrom).getTime() : 0,
            max_timestamp: timeTo ? new Date(timeTo).getTime() : undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to start KYT screening");
        }

        const { job_id } = await res.json();
        onJobStarted(job_id);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
        onLoading(false);
      }
      setSubmitting(false);
    },
    [chain, txId, token, direction, inRulesetId, outRulesetId, inflowHops, outflowHops, maxNodes, minAmount, maxOpponentPaths, penetrateContract, timeFrom, timeTo, onJobStarted, onLoading]
  );

  return (
    <div className="card" style={{ padding: "var(--sp-3) var(--sp-4)" }}>
      <form onSubmit={handleSubmit}>
        {/* Tx Hash Input */}
        <div className="screening-address-input" style={{ marginBottom: "var(--sp-3)" }}>
          <select
            className="screening-chain-select"
            value={chain}
            onChange={(e) => {
              setChain(e.target.value);
              if (e.target.value === "Tron") setToken("usdt");
            }}
          >
            <option value="Tron">Tron</option>
            <option value="Ethereum">Ethereum</option>
          </select>
          <div className="screening-chain-divider" />
          <input
            type="text"
            className="screening-address-field"
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            placeholder="Enter transaction hash..."
            required
          />
        </div>

        {/* Direction Chips */}
        <div style={{ marginBottom: "var(--sp-3)" }}>
          <label className="label" style={{ fontSize: "0.65rem" }}>Screen Direction</label>
          <div className="screening-chips">
            {DIRECTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                className={`screening-chip${direction === d.value ? " active" : ""}`}
                onClick={() => setDirection(d.value)}
              >
                <span className="screening-chip-label">{d.label}</span>
                <span className="screening-chip-desc">{d.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <div style={{ marginBottom: "var(--sp-3)" }}>
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
                  <label className="label">Token</label>
                  <select className="input" value={token} onChange={(e) => setToken(e.target.value)}>
                    <option value="usdt">USDT</option>
                    {chain === "Ethereum" && <option value="usdc">USDC</option>}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Inflow Hops</label>
                  <select className="input" value={inflowHops} onChange={(e) => setInflowHops(e.target.value)}>
                    {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Outflow Hops</label>
                  <select className="input" value={outflowHops} onChange={(e) => setOutflowHops(e.target.value)}>
                    {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Max Nodes / Hop</label>
                  <select className="input" value={maxNodes} onChange={(e) => setMaxNodes(e.target.value)}>
                    {[20, 50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-2)" }}>
                {(direction === "in" || direction === "both") && (
                  <div style={{ flex: 1 }}>
                    <label className="label">IN Ruleset ID (0 = KYT-IN builtin)</label>
                    <input type="number" className="input" min={0} value={inRulesetId} onChange={(e) => setInRulesetId(e.target.value)} />
                  </div>
                )}
                {(direction === "out" || direction === "both") && (
                  <div style={{ flex: 1 }}>
                    <label className="label">OUT Ruleset ID (0 = KYT-OUT builtin)</label>
                    <input type="number" className="input" min={0} value={outRulesetId} onChange={(e) => setOutRulesetId(e.target.value)} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <label className="label">Min Amount</label>
                  <input type="number" className="input" min={0} step="any" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Max Opponent Paths</label>
                  <input type="number" className="input" min={1} max={200} value={maxOpponentPaths} onChange={(e) => setMaxOpponentPaths(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-2)" }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Time From (empty = no limit)</label>
                  <input type="datetime-local" className="input" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Time To (empty = now)</label>
                  <input type="datetime-local" className="input" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginTop: "var(--sp-2)", fontSize: "var(--text-xs)", color: "var(--text-secondary)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={penetrateContract}
                  onChange={(e) => setPenetrateContract(e.target.checked)}
                />
                Penetrate contract addresses (trace through contracts)
              </label>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-md btn-primary"
          disabled={submitting}
          style={{ width: "100%" }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
          {submitting ? "Screening..." : "Start KYT Screening"}
        </button>
      </form>
    </div>
  );
}
