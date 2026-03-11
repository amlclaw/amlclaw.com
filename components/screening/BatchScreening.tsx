"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { showToast } from "@/lib/utils";

interface BatchScreeningProps {
  onClose: () => void;
  onComplete: () => void;
}

interface BatchResult {
  chain: string;
  address: string;
  status: string;
  job_id?: string;
  risk_level?: string;
  risk_entities_count?: number;
  error?: string;
}

interface BatchJob {
  status: string;
  total: number;
  completed: number;
  results: BatchResult[];
  progress: string;
  completed_at?: string;
}

export default function BatchScreening({ onClose, onComplete }: BatchScreeningProps) {
  const [addresses, setAddresses] = useState("");
  const [chain, setChain] = useState("Tron");
  const [scenario, setScenario] = useState("deposit");
  const [rulesets, setRulesets] = useState<{ id: string; name: string }[]>([]);
  const [rulesetId, setRulesetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [batchJob, setBatchJob] = useState<BatchJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/rulesets")
      .then((r) => r.json())
      .then((data) => {
        setRulesets(data);
        if (data.length > 0) setRulesetId(data[0].id);
      })
      .catch(() => {});
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = addresses
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      showToast("Enter at least one address", "error");
      return;
    }
    if (lines.length > 100) {
      showToast("Maximum 100 addresses per batch", "error");
      return;
    }

    const parsed = lines.map((line) => {
      if (line.includes(":")) {
        const [c, a] = line.split(":", 2);
        return { chain: c, address: a };
      }
      return { chain, address: line };
    });

    setSubmitting(true);
    try {
      const res = await fetch("/api/screening/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addresses: parsed,
          scenario,
          ruleset_id: rulesetId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to start batch");
      }
      const { batch_id } = await res.json();

      // Poll for progress
      const poll = () => {
        fetch(`/api/screening/batch?id=${batch_id}`)
          .then((r) => r.json())
          .then((data: BatchJob) => {
            setBatchJob(data);
            if (data.status === "completed") {
              stopPolling();
              onComplete();
            }
          })
          .catch(() => {});
      };
      poll();
      pollRef.current = setInterval(poll, 2000);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
    setSubmitting(false);
  };

  const riskColor = (level?: string) => {
    if (!level) return "var(--text-tertiary)";
    const m: Record<string, string> = { Severe: "var(--risk-severe)", High: "var(--risk-high)", Medium: "var(--risk-medium)", Low: "var(--risk-low)" };
    return m[level] || "var(--text-tertiary)";
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxHeight: "80vh", overflow: "auto" }}>
        <div className="modal-header">
          <h3 style={{ fontSize: "var(--text-md)", fontWeight: 600 }}>Batch Screening</h3>
          <button className="btn-icon" onClick={onClose}>&times;</button>
        </div>

        {!batchJob ? (
          <form onSubmit={handleSubmit} style={{ padding: "var(--sp-4)" }}>
            <div className="settings-field" style={{ marginBottom: "var(--sp-3)" }}>
              <label>Addresses (one per line, or chain:address format)</label>
              <textarea
                className="input"
                rows={8}
                value={addresses}
                onChange={(e) => setAddresses(e.target.value)}
                placeholder={"THaUdoNaeL7FEHFGpzEktHiJPsDctc6C6o\nEthereum:0x1234...\nTGE94jU39ithtHbrYAQJRTcvv785riPLdy"}
                style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)" }}
              />
              <span className="settings-hint">{addresses.split("\n").filter((l) => l.trim()).length} addresses</span>
            </div>

            <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
              <div style={{ flex: 1 }}>
                <label className="label">Default Chain</label>
                <select className="input input-sm" value={chain} onChange={(e) => setChain(e.target.value)}>
                  <option value="Tron">Tron</option>
                  <option value="Ethereum">Ethereum</option>
                  <option value="Bitcoin">Bitcoin</option>
                  <option value="Solana">Solana</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Scenario</label>
                <select className="input input-sm" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="all">Full Scan</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Ruleset</label>
                <select className="input input-sm" value={rulesetId} onChange={(e) => setRulesetId(e.target.value)}>
                  {rulesets.map((rs) => (
                    <option key={rs.id} value={rs.id}>{rs.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-md" disabled={submitting} style={{ width: "100%" }}>
              {submitting ? "Starting..." : "Start Batch Screening"}
            </button>
          </form>
        ) : (
          <div style={{ padding: "var(--sp-4)" }}>
            {/* Progress */}
            <div style={{ marginBottom: "var(--sp-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-2)", fontSize: "var(--text-sm)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{batchJob.progress}</span>
                <span style={{ color: "var(--text-tertiary)" }}>{batchJob.completed}/{batchJob.total}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(batchJob.completed / batchJob.total) * 100}%`,
                    borderRadius: 3,
                    background: batchJob.status === "completed" ? "var(--success)" : "var(--primary-500)",
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>

            {/* Results table */}
            {batchJob.results.length > 0 && (
              <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
                <thead>
                  <tr>
                    <th>Chain</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Risk</th>
                    <th>Entities</th>
                  </tr>
                </thead>
                <tbody>
                  {batchJob.results.map((r, i) => (
                    <tr key={i}>
                      <td>{r.chain}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: "0.65rem" }}>
                        {r.job_id ? (
                          <a href={`/screening?job=${r.job_id}`} style={{ color: "var(--primary-400)" }}>
                            {r.address.slice(0, 8)}...{r.address.slice(-4)}
                          </a>
                        ) : (
                          <span>{r.address.slice(0, 8)}...{r.address.slice(-4)}</span>
                        )}
                      </td>
                      <td>
                        {r.status === "completed" ? (
                          <span style={{ color: "var(--success)" }}>Done</span>
                        ) : (
                          <span style={{ color: "var(--danger)" }} title={r.error}>Error</span>
                        )}
                      </td>
                      <td>
                        {r.risk_level && (
                          <span className={`risk-pill ${r.risk_level.toLowerCase()}`}>
                            {r.risk_level}
                          </span>
                        )}
                      </td>
                      <td style={{ color: riskColor(r.risk_level) }}>
                        {r.risk_entities_count ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {batchJob.status === "completed" && (
              <div style={{ marginTop: "var(--sp-3)", textAlign: "center" }}>
                <button className="btn btn-primary btn-md" onClick={onClose}>Close</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
