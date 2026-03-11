"use client";

import { useState, useEffect, useCallback } from "react";
import { iconText, showToast } from "@/lib/utils";
import RulesetViewer from "./RulesetViewer";
import RuleEditor from "./RuleEditor";

interface Ruleset {
  id: string;
  name: string;
  jurisdiction?: string;
  icon?: string;
  builtin?: boolean;
  rules_count: number;
  generated_by?: string;
}

interface Props {
  onGenerateFromPolicy?: () => void;
  refreshTrigger?: number;
}

export default function RulesetList({ onGenerateFromPolicy, refreshTrigger }: Props = {}) {
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerRuleset, setViewerRuleset] = useState<Ruleset | null>(null);
  const [viewerRules, setViewerRules] = useState<Record<string, unknown>[]>([]);
  const [viewerIsBuiltin, setViewerIsBuiltin] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Record<string, unknown> | null>(null);
  const [editingRulesetId, setEditingRulesetId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createJurisdiction, setCreateJurisdiction] = useState("Custom");
  const [createClone, setCreateClone] = useState("");

  const loadRulesets = useCallback(() => {
    fetch("/api/rulesets")
      .then((r) => r.json())
      .then(setRulesets)
      .catch(() => {});
  }, []);

  useEffect(() => { loadRulesets(); }, [loadRulesets, refreshTrigger]);

  // Auto-poll when any ruleset is generating
  useEffect(() => {
    const hasGenerating = rulesets.some((r) => (r as unknown as Record<string, unknown>).status === "generating");
    if (!hasGenerating) return;

    const interval = setInterval(loadRulesets, 5000);
    return () => clearInterval(interval);
  }, [rulesets, loadRulesets]);

  const openRuleset = useCallback(async (rs: Ruleset) => {
    try {
      const res = await fetch(`/api/rulesets/${rs.id}`);
      const data = await res.json();
      setViewerRuleset(rs);
      setViewerRules(data.rules);
      setViewerIsBuiltin(data.meta.builtin !== false);
      setViewerOpen(true);
    } catch {
      showToast("Failed to load ruleset", "error");
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this custom ruleset?")) return;
    try {
      const res = await fetch(`/api/rulesets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).detail);
      showToast("Ruleset deleted", "success");
      setViewerOpen(false);
      loadRulesets();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  }, [loadRulesets]);

  const handleClone = useCallback(async (sourceId: string, sourceName: string) => {
    const name = prompt(`Clone "${sourceName}" as:`, `${sourceName} (Copy)`);
    if (!name) return;
    try {
      const res = await fetch("/api/rulesets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, jurisdiction: "Custom", clone_from: sourceId }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      showToast(`Cloned: ${name}`, "success");
      loadRulesets();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  }, [loadRulesets]);

  const handleDeleteRule = useCallback(async (rulesetId: string, ruleId: string) => {
    if (!confirm(`Delete rule ${ruleId}?`)) return;
    try {
      const res = await fetch(`/api/rulesets/${rulesetId}/rules/${ruleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).detail);
      showToast(`Deleted: ${ruleId}`, "success");
      if (viewerRuleset) openRuleset(viewerRuleset);
      loadRulesets();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  }, [loadRulesets, openRuleset, viewerRuleset]);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/rulesets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, jurisdiction: createJurisdiction, clone_from: createClone }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      showToast(`Created: ${createName}`, "success");
      setCreateOpen(false);
      setCreateName("");
      loadRulesets();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  }, [createName, createJurisdiction, createClone, loadRulesets]);

  return (
    <div className="card">
      <div className="panel-header">
        <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Rule Sets</h2>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          {onGenerateFromPolicy && (
            <button className="btn btn-sm btn-primary" onClick={onGenerateFromPolicy}>
              AI Generate
            </button>
          )}
          <button className="btn btn-sm btn-secondary" onClick={() => setCreateOpen(true)}>
            + Manual
          </button>
        </div>
      </div>
      <div style={{ maxHeight: 600, overflowY: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ruleset</th>
              <th>Jurisdiction</th>
              <th>Type</th>
              <th>Rules</th>
              <th className="col-actions" style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rulesets.map((rs) => {
              const isBuiltin = rs.builtin !== false;
              const rsStatus = (rs as unknown as Record<string, unknown>).status as string | undefined;
              const isGenerating = rsStatus === "generating";
              const isError = rsStatus === "error";
              const typeLabel = isGenerating ? "Generating..." : isError ? "Error" : isBuiltin ? "Built-in" : rs.generated_by === "ai" ? "AI-Generated" : "Custom";
              return (
                <tr key={rs.id} onClick={() => openRuleset(rs)}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
                      <div
                        style={{
                          width: 32, height: 32, borderRadius: "var(--radius)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "var(--text-sm)", flexShrink: 0,
                          background: "var(--success-dim)", color: "var(--success)",
                        }}
                      >
                        {iconText(rs.icon || "rules")}
                      </div>
                      <span className="truncate" style={{ fontWeight: 500 }}>
                        {rs.name}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="category-badge">{rs.jurisdiction || "—"}</span>
                  </td>
                  <td>
                    <span className={`badge ${isGenerating ? "badge-warning" : isError ? "badge-danger" : isBuiltin ? "badge-neutral" : rs.generated_by === "ai" ? "badge-success" : "badge-warning"}`}>
                      {isGenerating && <span className="spinner spinner-xs" style={{ marginRight: 4 }} />}
                      {typeLabel}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.7rem", fontFamily: "var(--mono)",
                        padding: "3px 8px", borderRadius: "var(--radius-sm)",
                        background: "var(--surface-2)", border: "1px solid var(--border-default)",
                        color: "var(--text-secondary)", whiteSpace: "nowrap",
                      }}
                    >
                      {rs.rules_count}
                    </span>
                  </td>
                  <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: "var(--sp-1)", justifyContent: "center" }}>
                      <button className="btn-icon" title="Clone" onClick={() => handleClone(rs.id, rs.name)} style={{ fontSize: "var(--text-xs)" }}>
                        &#x29C9;
                      </button>
                      {!isBuiltin && (
                        <button className="btn-icon" title="Delete" onClick={() => handleDelete(rs.id)} style={{ fontSize: "var(--text-xs)" }}>
                          &#x2715;
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rulesets.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--sp-10)", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            No rulesets yet. Generate from a policy or create manually.
          </div>
        )}
      </div>

      {/* Ruleset Viewer */}
      <RulesetViewer
        open={viewerOpen}
        ruleset={viewerRuleset}
        rules={viewerRules}
        isBuiltin={viewerIsBuiltin}
        onClose={() => setViewerOpen(false)}
        onEditRule={(ruleId) => {
          const rule = viewerRules.find((r) => r.rule_id === ruleId) || null;
          setEditingRule(rule);
          setEditingRulesetId(viewerRuleset?.id || "");
          setEditorOpen(true);
        }}
        onDeleteRule={(ruleId) => handleDeleteRule(viewerRuleset?.id || "", ruleId)}
        onAddRule={() => {
          setEditingRule(null);
          setEditingRulesetId(viewerRuleset?.id || "");
          setEditorOpen(true);
        }}
      />

      {/* Rule Editor */}
      <RuleEditor
        open={editorOpen}
        rulesetId={editingRulesetId}
        editingRule={editingRule}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          if (viewerRuleset) openRuleset(viewerRuleset);
          loadRulesets();
        }}
      />

      {/* Create Ruleset Dialog */}
      {createOpen && (
        <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Ruleset</h3>
              <button className="btn-icon" onClick={() => setCreateOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate} className="modal-body">
              <div style={{ marginBottom: "var(--sp-3)" }}>
                <label className="label">Ruleset Name</label>
                <input
                  className="input"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. My Company AML Policy"
                  required
                />
              </div>
              <div style={{ marginBottom: "var(--sp-3)" }}>
                <label className="label">Jurisdiction</label>
                <input
                  className="input"
                  value={createJurisdiction}
                  onChange={(e) => setCreateJurisdiction(e.target.value)}
                  placeholder="e.g. Singapore"
                />
              </div>
              <div style={{ marginBottom: "var(--sp-4)" }}>
                <label className="label">Clone From (optional)</label>
                <select className="input" value={createClone} onChange={(e) => setCreateClone(e.target.value)}>
                  <option value="">Start empty</option>
                  {rulesets.map((rs) => (
                    <option key={rs.id} value={rs.id}>{rs.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-md btn-primary" style={{ width: "100%" }}>
                Create Ruleset
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
