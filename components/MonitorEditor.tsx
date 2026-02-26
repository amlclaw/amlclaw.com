"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { showToast } from "@/lib/utils";
import type { MonitorTask } from "@/lib/types";

interface Ruleset {
  id: string;
  name: string;
  rules_count: number;
}

interface MonitorEditorProps {
  task?: MonitorTask | null;
  onClose: () => void;
  onSaved: () => void;
}

const SCHEDULE_OPTIONS = [
  { key: "every_1h", label: "Every 1 hour" },
  { key: "every_4h", label: "Every 4 hours" },
  { key: "every_8h", label: "Every 8 hours" },
  { key: "every_12h", label: "Every 12 hours" },
  { key: "every_24h", label: "Every 24 hours" },
  { key: "custom", label: "Custom cron" },
];

export default function MonitorEditor({ task, onClose, onSaved }: MonitorEditorProps) {
  const isEdit = !!task;

  const [name, setName] = useState(task?.name || "");
  const [addressText, setAddressText] = useState(
    task ? task.addresses.map((a) => `${a.chain}:${a.address}`).join("\n") : ""
  );
  const [defaultChain, setDefaultChain] = useState("Tron");
  const [scenario, setScenario] = useState(task?.scenario || "deposit");
  const [rulesetId, setRulesetId] = useState(task?.ruleset_id || "");
  const [schedulePreset, setSchedulePreset] = useState(task?.schedule_preset || "every_4h");
  const [customCron, setCustomCron] = useState(task?.schedule || "");
  const [inflowHops, setInflowHops] = useState(String(task?.inflow_hops || 3));
  const [outflowHops, setOutflowHops] = useState(String(task?.outflow_hops || 3));
  const [maxNodes, setMaxNodes] = useState(String(task?.max_nodes || 100));
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/rulesets")
      .then((r) => r.json())
      .then((data) => {
        setRulesets(data);
        if (!rulesetId && data.length > 0) setRulesetId(data[0].id);
      })
      .catch(() => {});
  }, [rulesetId]);

  const parsedAddresses = useMemo(() => {
    return addressText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        if (line.includes(":")) {
          const [chain, address] = line.split(":", 2);
          return { chain, address };
        }
        return { chain: defaultChain, address: line };
      });
  }, [addressText, defaultChain]);

  // API usage estimate
  const intervalHours = useMemo(() => {
    const map: Record<string, number> = {
      every_1h: 1, every_4h: 4, every_8h: 8, every_12h: 12, every_24h: 24,
    };
    return map[schedulePreset] || 4;
  }, [schedulePreset]);

  const dailyCalls = parsedAddresses.length * Math.floor(24 / intervalHours);
  const usagePercent = Math.min((dailyCalls / 100) * 100, 100);
  const usageClass = usagePercent > 80 ? "danger" : usagePercent > 50 ? "warning" : "safe";

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      showToast("Task name is required", "error");
      return;
    }
    if (parsedAddresses.length === 0) {
      showToast("At least one address is required", "error");
      return;
    }
    if (parsedAddresses.length > 20) {
      showToast("Maximum 20 addresses per task", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        addresses: parsedAddresses,
        default_chain: defaultChain,
        scenario,
        ruleset_id: rulesetId,
        schedule_preset: schedulePreset,
        schedule: schedulePreset === "custom" ? customCron : undefined,
        inflow_hops: inflowHops,
        outflow_hops: outflowHops,
        max_nodes: maxNodes,
      };

      const url = isEdit ? `/api/monitors/${task.id}` : "/api/monitors";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save");
      }

      showToast(isEdit ? "Task updated" : "Task created", "success");
      onSaved();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
    setSaving(false);
  }, [name, parsedAddresses, defaultChain, scenario, rulesetId, schedulePreset, customCron, inflowHops, outflowHops, maxNodes, isEdit, task, onSaved, onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? "Edit Monitoring Task" : "New Monitoring Task"}</h3>
          <button className="btn-icon" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Task Name */}
          <div style={{ marginBottom: "var(--sp-4)" }}>
            <label className="label">Task Name</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Deposit Watch"
            />
          </div>

          {/* Addresses */}
          <div style={{ marginBottom: "var(--sp-4)" }}>
            <label className="label">
              Addresses
              <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 8, color: "var(--text-tertiary)" }}>
                {parsedAddresses.length} address{parsedAddresses.length !== 1 ? "es" : ""} parsed
              </span>
            </label>
            <textarea
              className="input input-mono"
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              placeholder={"Tron:TGE94jU39ithtHbrYAQJRTcvv785riPLdy\nTHaUdoNaeL7FEHFGpzEktHiJPsDctc6C6o"}
              rows={4}
              style={{ fontSize: "var(--text-xs)" }}
            />
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>
              One per line. Format: Chain:Address or bare address (uses default chain)
            </div>
          </div>

          {/* Default Chain + Scenario */}
          <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
            <div style={{ flex: 1 }}>
              <label className="label">Default Chain</label>
              <select className="input" value={defaultChain} onChange={(e) => setDefaultChain(e.target.value)}>
                <option value="Tron">Tron</option>
                <option value="Ethereum">Ethereum</option>
                <option value="Bitcoin">Bitcoin</option>
                <option value="Solana">Solana</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Scenario</label>
              <select className="input" value={scenario} onChange={(e) => setScenario(e.target.value)}>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="onboarding">Onboarding (KYC)</option>
                <option value="cdd">CDD</option>
                <option value="monitoring">Monitoring</option>
                <option value="all">All (Full Scan)</option>
              </select>
            </div>
          </div>

          {/* Ruleset */}
          <div style={{ marginBottom: "var(--sp-4)" }}>
            <label className="label">Ruleset</label>
            <select className="input" value={rulesetId} onChange={(e) => setRulesetId(e.target.value)}>
              {rulesets.map((rs) => (
                <option key={rs.id} value={rs.id}>
                  {rs.name} ({rs.rules_count} rules)
                </option>
              ))}
            </select>
          </div>

          {/* Schedule */}
          <div style={{ marginBottom: "var(--sp-4)" }}>
            <label className="label">Schedule</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
              {SCHEDULE_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: "var(--radius)",
                    border: `1px solid ${schedulePreset === opt.key ? "var(--primary-500)" : "var(--border-default)"}`,
                    background: schedulePreset === opt.key ? "var(--primary-dim)" : "var(--surface-2)",
                    cursor: "pointer",
                    fontSize: "var(--text-xs)",
                    color: schedulePreset === opt.key ? "var(--text-primary)" : "var(--text-secondary)",
                    transition: "all var(--transition)",
                  }}
                >
                  <input
                    type="radio"
                    name="schedule"
                    value={opt.key}
                    checked={schedulePreset === opt.key}
                    onChange={() => setSchedulePreset(opt.key)}
                    style={{ display: "none" }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {schedulePreset === "custom" && (
              <input
                type="text"
                className="input input-mono"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="0 */6 * * *"
                style={{ marginTop: "var(--sp-2)" }}
              />
            )}
          </div>

          {/* Hops + Max Nodes */}
          <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
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

          {/* API Usage Estimate */}
          <div style={{ padding: "var(--sp-3)", background: "var(--surface-2)", borderRadius: "var(--radius)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "var(--text-xs)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Est. API calls/day</span>
              <span style={{ fontFamily: "var(--mono)", color: usageClass === "danger" ? "var(--danger)" : usageClass === "warning" ? "var(--warning)" : "var(--text-secondary)" }}>
                {dailyCalls} / 100
              </span>
            </div>
            <div className="usage-bar">
              <div className={`usage-bar-fill ${usageClass}`} style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-sm btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Update Task" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
