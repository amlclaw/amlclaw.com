"use client";

import { useState, useEffect, useCallback } from "react";
import { renderMarkdown, showToast } from "@/lib/utils";
import RuleCard from "@/components/rules/RuleCard";
import RuleEditor from "@/components/rules/RuleEditor";

interface Policy {
  id: string;
  name: string;
  jurisdiction: string;
  status: string;
  content: string;
  source_documents: string[];
  created_at: string;
  updated_at: string;
}

interface RulesetMeta {
  id: string;
  name: string;
  builtin?: boolean;
  source_policies?: string[];
  rules_count: number;
}

interface Rule {
  rule_id: string;
  category: string;
  name: string;
  risk_level: string;
  action: string;
  direction?: string;
  min_hops?: number;
  max_hops?: number;
  description?: string;
  conditions?: { parameter: string; operator: string; value: unknown; unit?: string }[];
}

interface Props {
  policyId: string | null;
  onGenerateRules?: (policyId: string) => void;
  onRefresh?: () => void;
}

export default function PolicyViewer({ policyId, onGenerateRules, onRefresh }: Props) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "rules">("content");

  // Rules tab state
  const [rulesets, setRulesets] = useState<RulesetMeta[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [activeRulesetId, setActiveRulesetId] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Record<string, unknown> | null>(null);

  const loadPolicy = useCallback(async () => {
    if (!policyId) { setPolicy(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/policies/${policyId}`);
      if (res.ok) {
        const data = await res.json();
        setPolicy(data);
        setEditContent(data.content);
      }
    } catch { /* */ }
    setLoading(false);
  }, [policyId]);

  useEffect(() => { loadPolicy(); }, [loadPolicy]);

  // Load associated rulesets when switching to rules tab
  const loadRulesets = useCallback(async () => {
    if (!policyId) return;
    setRulesLoading(true);
    try {
      const res = await fetch("/api/rulesets");
      if (res.ok) {
        const data = await res.json();
        const associated = (data as RulesetMeta[]).filter(
          (rs) => rs.source_policies?.includes(policyId)
        );
        setRulesets(associated);
        // Auto-select first if none selected
        if (associated.length > 0 && !activeRulesetId) {
          setActiveRulesetId(associated[0].id);
        }
      }
    } catch { /* */ }
    setRulesLoading(false);
  }, [policyId, activeRulesetId]);

  // Load rules for selected ruleset
  const loadRules = useCallback(async () => {
    if (!activeRulesetId) { setRules([]); return; }
    try {
      const res = await fetch(`/api/rulesets/${activeRulesetId}`);
      if (res.ok) {
        const data = await res.json();
        setRules((data.rules as Rule[]) || []);
      }
    } catch { /* */ }
  }, [activeRulesetId]);

  useEffect(() => {
    if (activeTab === "rules") loadRulesets();
  }, [activeTab, loadRulesets]);

  useEffect(() => {
    if (activeRulesetId) loadRules();
  }, [activeRulesetId, loadRules]);

  const handleSave = async () => {
    if (!policy) return;
    try {
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent, status: "ready" }),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("Policy saved", "success");
      setEditing(false);
      loadPolicy();
      onRefresh?.();
    } catch {
      showToast("Save failed", "error");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!activeRulesetId) return;
    if (!confirm(`Delete rule ${ruleId}?`)) return;
    try {
      const res = await fetch(`/api/rulesets/${activeRulesetId}/rules/${ruleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      showToast(`Rule ${ruleId} deleted`, "success");
      loadRules();
    } catch {
      showToast("Delete failed", "error");
    }
  };

  const isBuiltin = rulesets.find((rs) => rs.id === activeRulesetId)?.builtin || false;

  if (!policyId) {
    return (
      <div className="panel" style={{ alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
        Select a policy to view, or generate a new one
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!policy) return null;

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header" style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--sp-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{policy.name}</h3>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
              {policy.jurisdiction} &middot; {policy.source_documents.length} source docs
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--sp-2)" }}>
            {activeTab === "content" && editing ? (
              <>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
              </>
            ) : activeTab === "content" ? (
              <>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}>Edit</button>
                {onGenerateRules && policy.status === "ready" && (
                  <button className="btn btn-sm btn-primary" onClick={() => onGenerateRules(policy.id)}>
                    Generate Rules
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>
        {/* Tabs */}
        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === "content" ? "active" : ""}`}
            onClick={() => setActiveTab("content")}
          >
            Content
          </button>
          <button
            className={`tab-btn ${activeTab === "rules" ? "active" : ""}`}
            onClick={() => setActiveTab("rules")}
          >
            Rules {rulesets.length > 0 ? `(${rulesets.reduce((s, rs) => s + rs.rules_count, 0)})` : ""}
          </button>
        </div>
      </div>

      {/* Content Tab */}
      {activeTab === "content" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--sp-4) var(--sp-5)" }}>
          {editing ? (
            <textarea
              className="input input-mono"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={{ height: "100%", minHeight: 400 }}
            />
          ) : policy.content ? (
            <div className="document-paper-scroll">
              <div className="document-paper">
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(policy.content) }}
                />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "var(--sp-10)", color: "var(--text-tertiary)" }}>
              No content yet
            </div>
          )}
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === "rules" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--sp-4) var(--sp-5)" }}>
          {rulesLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--sp-10)" }}>
              <div className="spinner" />
            </div>
          ) : rulesets.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--sp-10)", color: "var(--text-tertiary)" }}>
              <div style={{ fontSize: "var(--text-sm)", marginBottom: "var(--sp-2)" }}>No rulesets generated from this policy yet</div>
              {onGenerateRules && policy.status === "ready" && (
                <button className="btn btn-sm btn-primary" onClick={() => onGenerateRules(policy.id)}>
                  Generate Rules
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Ruleset selector if multiple */}
              {rulesets.length > 1 && (
                <div style={{ marginBottom: "var(--sp-3)" }}>
                  <select
                    className="input input-sm"
                    value={activeRulesetId || ""}
                    onChange={(e) => setActiveRulesetId(e.target.value)}
                  >
                    {rulesets.map((rs) => (
                      <option key={rs.id} value={rs.id}>
                        {rs.name} ({rs.rules_count} rules)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Add rule button */}
              {!isBuiltin && activeRulesetId && (
                <div style={{ marginBottom: "var(--sp-3)", textAlign: "right" }}>
                  <button
                    className="btn btn-sm btn-secondary"
                    style={{ color: "var(--success)" }}
                    onClick={() => { setEditingRule(null); setEditorOpen(true); }}
                  >
                    + Add Rule
                  </button>
                </div>
              )}

              {/* Rule cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                {rules.map((rule) => (
                  <RuleCard
                    key={rule.rule_id}
                    rule={rule}
                    editable={!isBuiltin}
                    onEdit={() => {
                      setEditingRule(rule as unknown as Record<string, unknown>);
                      setEditorOpen(true);
                    }}
                    onDelete={() => handleDeleteRule(rule.rule_id)}
                  />
                ))}
              </div>

              {rules.length === 0 && !rulesLoading && (
                <div style={{ textAlign: "center", padding: "var(--sp-6)", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
                  No rules in this ruleset
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Rule Editor Modal */}
      {activeRulesetId && (
        <RuleEditor
          open={editorOpen}
          rulesetId={activeRulesetId}
          editingRule={editingRule}
          onClose={() => { setEditorOpen(false); setEditingRule(null); }}
          onSaved={() => { loadRules(); loadRulesets(); }}
        />
      )}
    </div>
  );
}
