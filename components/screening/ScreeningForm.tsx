"use client";

import { useState, useCallback } from "react";
import { showToast } from "@/lib/utils";
import { detectChainFromAddress } from "@/lib/chain-detect";

interface ScreeningFormProps {
  onJobStarted: (jobId: string) => void;
  onLoading: (loading: boolean) => void;
  /** Prefill from ?address=&chain= deep links (e.g. monitoring shortcuts). */
  initialAddress?: string;
  initialChain?: string;
}

export default function ScreeningForm({ onJobStarted, onLoading, initialAddress, initialChain }: ScreeningFormProps) {
  const [chain, setChain] = useState(
    () => initialChain || (initialAddress ? detectChainFromAddress(initialAddress) : null) || "Tron",
  );
  const [address, setAddress] = useState(initialAddress ?? "");
  const [token, setToken] = useState("usdt");
  const [rulesetId, setRulesetId] = useState("0");
  const [inflowHops, setInflowHops] = useState("3");
  const [outflowHops, setOutflowHops] = useState("3");
  const [maxNodes, setMaxNodes] = useState("200");
  const [minAmount, setMinAmount] = useState("10");
  const [maxOpponentPaths, setMaxOpponentPaths] = useState("50");
  const [penetrateContract, setPenetrateContract] = useState(false);
  const [timeFrom, setTimeFrom] = useState(""); // datetime-local, empty = no limit
  const [timeTo, setTimeTo] = useState("");     // datetime-local, empty = now
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
            scenario: "all",
            chain,
            address: address.trim(),
            token,
            ruleset_id: rulesetId,
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
    [chain, address, token, rulesetId, inflowHops, outflowHops, maxNodes, minAmount, maxOpponentPaths, penetrateContract, timeFrom, timeTo, onJobStarted, onLoading]
  );

  return (
    <div className="card" style={{ padding: "var(--sp-3) var(--sp-4)" }}>
      <form onSubmit={handleSubmit}>
        {/* Address Input */}
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
            value={address}
            onChange={(e) => {
              const v = e.target.value;
              setAddress(v);
              // Auto-detect chain from address format; manual select still overrides
              const detected = detectChainFromAddress(v);
              if (detected && detected !== chain) {
                setChain(detected);
                if (detected === "Tron") setToken("usdt");
              }
            }}
            placeholder="Enter blockchain address..."
            required
          />
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
              </div>
              <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-2)" }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Max Nodes / Hop</label>
                  <select className="input" value={maxNodes} onChange={(e) => setMaxNodes(e.target.value)}>
                    {[20, 50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Ruleset ID (0 = default)</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    value={rulesetId}
                    onChange={(e) => setRulesetId(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Min Amount</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    step="any"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-2)" }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Max Opponent Paths</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={200}
                    value={maxOpponentPaths}
                    onChange={(e) => setMaxOpponentPaths(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Time From (empty = no limit)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Time To (empty = now)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                  />
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {submitting ? "Screening..." : "Start KYA Screening"}
        </button>
      </form>
    </div>
  );
}
