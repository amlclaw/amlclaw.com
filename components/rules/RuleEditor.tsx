"use client";

import { useState, useEffect, useCallback } from "react";
import { showToast } from "@/lib/utils";

interface SchemaEnums {
  categories: string[];
  risk_levels: string[];
  actions: string[];
  directions: string[];
  parameters: string[];
  operators: string[];
}

interface Condition {
  parameter: string;
  operator: string;
  value: string;
}

interface RuleEditorProps {
  open: boolean;
  rulesetId: string;
  editingRule: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function RuleEditor({ open, rulesetId, editingRule, onClose, onSaved }: RuleEditorProps) {
  const [enums, setEnums] = useState<SchemaEnums>({
    categories: [],
    risk_levels: [],
    actions: [],
    directions: [],
    parameters: [],
    operators: [],
  });
  const [ruleId, setRuleId] = useState("");
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [action, setAction] = useState("");
  const [direction, setDirection] = useState("");
  const [minHops, setMinHops] = useState("");
  const [maxHops, setMaxHops] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [conditions, setConditions] = useState<Condition[]>([{ parameter: "", operator: "", value: "" }]);

  useEffect(() => {
    fetch("/api/schema/enums")
      .then((r) => r.json())
      .then((data) => {
        setEnums(data);
        if (!editingRule) {
          setCategory(data.categories?.[0] || "");
          setRiskLevel(data.risk_levels?.[0] || "");
          setAction(data.actions?.[0] || "");
        }
      })
      .catch(() => {});
  }, [editingRule]);

  useEffect(() => {
    if (editingRule) {
      setRuleId((editingRule.rule_id as string) || "");
      setCategory((editingRule.category as string) || "");
      setName((editingRule.name as string) || "");
      setRiskLevel((editingRule.risk_level as string) || "");
      setAction((editingRule.action as string) || "");
      setDirection((editingRule.direction as string) || "");
      setMinHops(editingRule.min_hops ? String(editingRule.min_hops) : "");
      setMaxHops(editingRule.max_hops ? String(editingRule.max_hops) : "");
      setDescription((editingRule.description as string) || "");
      setReference((editingRule.reference as string) || "");
      const conds = (editingRule.conditions as Condition[]) || [];
      setConditions(
        conds.length > 0
          ? conds.map((c) => ({ parameter: c.parameter, operator: c.operator, value: formatValue(c.value) }))
          : [{ parameter: "", operator: "", value: "" }]
      );
    } else {
      setRuleId("");
      setName("");
      setDirection("");
      setMinHops("");
      setMaxHops("");
      setDescription("");
      setReference("");
      setConditions([{ parameter: "", operator: "", value: "" }]);
    }
  }, [editingRule, open]);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const rule: Record<string, unknown> = {
        rule_id: ruleId,
        category,
        name,
        risk_level: riskLevel,
        action,
      };
      if (direction) rule.direction = direction;
      if (minHops) rule.min_hops = parseInt(minHops);
      if (maxHops) rule.max_hops = parseInt(maxHops);
      if (description) rule.description = description;
      if (reference) rule.reference = reference;

      const parsedConditions = conditions
        .filter((c) => c.parameter && c.operator && c.value !== "")
        .map((c) => ({ parameter: c.parameter, operator: c.operator, value: parseValue(c.value) }));
      if (parsedConditions.length > 0) rule.conditions = parsedConditions;

      try {
        let res: Response;
        if (editingRule) {
          res = await fetch(`/api/rulesets/${rulesetId}/rules/${editingRule.rule_id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rule),
          });
        } else {
          res = await fetch(`/api/rulesets/${rulesetId}/rules`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rule),
          });
        }
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail);
        }
        showToast(`Rule ${editingRule ? "updated" : "added"}: ${ruleId}`, "success");
        onClose();
        onSaved();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    },
    [ruleId, category, name, riskLevel, action, direction, minHops, maxHops, description, reference, conditions, editingRule, rulesetId, onClose, onSaved]
  );

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-xxl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingRule ? `Edit Rule: ${editingRule.rule_id}` : "Add New Rule"}</h3>
          <button className="btn-icon" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSave} className="modal-body">
          <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
            <div style={{ flex: 1 }}>
              <label className="label">Rule ID</label>
              <input className="input" value={ruleId} onChange={(e) => setRuleId(e.target.value)} disabled={!!editingRule} placeholder="e.g. DEP-001" required />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Category</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} required>
                {enums.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" required />
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
            <div style={{ flex: 1 }}>
              <label className="label">Risk Level</label>
              <select className="input" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)} required>
                {enums.risk_levels.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Action</label>
              <select className="input" value={action} onChange={(e) => setAction(e.target.value)} required>
                {enums.actions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Direction</label>
              <select className="input" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="">Any</option>
                {enums.directions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ flex: 0.5 }}>
              <label className="label">Min Hops</label>
              <input className="input" type="number" value={minHops} onChange={(e) => setMinHops(e.target.value)} min={1} max={10} placeholder="-" />
            </div>
            <div style={{ flex: 0.5 }}>
              <label className="label">Max Hops</label>
              <input className="input" type="number" value={maxHops} onChange={(e) => setMaxHops(e.target.value)} min={1} max={10} placeholder="-" />
            </div>
          </div>

          <div style={{ marginBottom: "var(--sp-3)" }}>
            <label className="label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>

          <div style={{ marginBottom: "var(--sp-3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-2)" }}>
              <label className="label" style={{ marginBottom: 0 }}>Conditions (AND logic)</label>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setConditions([...conditions, { parameter: "", operator: "", value: "" }])}
                style={{ color: "var(--success)" }}
              >
                + Add Condition
              </button>
            </div>
            {conditions.map((cond, i) => (
              <div key={i} style={{ display: "flex", gap: "var(--sp-2)", marginBottom: "var(--sp-2)", alignItems: "flex-end" }}>
                <div style={{ flex: 3 }}>
                  <select
                    className="input input-sm"
                    value={cond.parameter}
                    onChange={(e) => {
                      const c = [...conditions];
                      c[i].parameter = e.target.value;
                      setConditions(c);
                    }}
                  >
                    <option value="">Select...</option>
                    {enums.parameters.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <select
                    className="input input-sm"
                    value={cond.operator}
                    onChange={(e) => {
                      const c = [...conditions];
                      c[i].operator = e.target.value;
                      setConditions(c);
                    }}
                  >
                    <option value="">Op</option>
                    {enums.operators.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{ flex: 3 }}>
                  <input
                    className="input input-sm"
                    value={cond.value}
                    onChange={(e) => {
                      const c = [...conditions];
                      c[i].value = e.target.value;
                      setConditions(c);
                    }}
                    placeholder='Value (e.g. Sanctions or ["a","b"])'
                  />
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  x
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: "var(--sp-4)" }}>
            <label className="label">Reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. MAS Notice PSN02 Section 6" />
          </div>

          <button type="submit" className="btn btn-md btn-primary" style={{ width: "100%" }}>
            Save Rule
          </button>
        </form>
      </div>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return JSON.stringify(v);
  return String(v);
}

function parseValue(str: string): unknown {
  str = str.trim();
  if (!str) return "";
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
