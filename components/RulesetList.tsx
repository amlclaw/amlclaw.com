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
      <div style={{ padding: "var(--sp-3)", maxHeight: 600, overflowY: "auto" }}>
        {rulesets.map((rs) => {
          const isBuiltin = rs.builtin !== false;
          return (
            <div key={rs.id} className="list-item" onClick={() => openRuleset(rs)}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: "var(--radius)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "var(--text-sm)", flexShrink: 0,
                  background: "var(--success-dim)", color: "var(--success)",
                }}
              >
                {iconText(rs.icon || "rules")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  {rs.name}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                  {rs.jurisdiction || ""} &middot; {isBuiltin ? "Built-in" : rs.generated_by === "ai" ? "AI-Generated" : "Custom"}
                </div>
              </div>
              <span
                style={{
                  fontSize: "0.7rem", fontFamily: "var(--mono)",
                  padding: "3px 8px", borderRadius: "var(--radius-sm)",
                  background: "var(--surface-2)", border: "1px solid var(--border-default)",
                  color: "var(--text-secondary)", whiteSpace: "nowrap",
                }}
              >
                {rs.rules_count} rules
              </span>
              <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: "var(--sp-1)", flexShrink: 0 }}>
                <button className="btn-icon" title="Clone" onClick={() => handleClone(rs.id, rs.name)} style={{ fontSize: "var(--text-xs)" }}>
                  &#x29C9;
                </button>
                {!isBuiltin && (
                  <button className="btn-icon" title="Delete" onClick={() => handleDelete(rs.id)} style={{ fontSize: "var(--text-xs)" }}>
                    &#x2715;
                  </button>
                )}
              </div>
            </div>
          );
        })}
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
