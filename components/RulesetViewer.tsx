"use client";

import { useEffect } from "react";

interface Ruleset {
  id: string;
  name: string;
}

interface RulesetViewerProps {
  open: boolean;
  ruleset: Ruleset | null;
  rules: Record<string, unknown>[];
  isBuiltin: boolean;
  onClose: () => void;
  onEditRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
  onAddRule: () => void;
}

export default function RulesetViewer({
  open,
  ruleset,
  rules,
  isBuiltin,
  onClose,
  onEditRule,
  onDeleteRule,
  onAddRule,
}: RulesetViewerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !ruleset) return null;

  const editable = !isBuiltin;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{ruleset.name} &mdash; Rule Set</h3>
          <button className="btn-icon" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  {["Rule ID", "Category", "Name", "Risk", "Action", "Conditions", ...(editable ? ["Actions"] : [])].map(
                    (h) => <th key={h}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => {
                  const conditions = ((r.conditions as Record<string, unknown>[]) || [])
                    .map((c) => `${c.parameter} ${c.operator} ${String(c.value)}`)
                    .join("\n");
                  const riskClass = ((r.risk_level as string) || "").toLowerCase();
                  return (
                    <tr key={r.rule_id as string}>
                      <td style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)" }}>
                        {r.rule_id as string}
                      </td>
                      <td>{r.category as string}</td>
                      <td>{r.name as string}</td>
                      <td>
                        <span className={`risk-pill ${riskClass}`}>{r.risk_level as string}</span>
                      </td>
                      <td>
                        <span className="action-pill" style={{ background: "var(--surface-2)", border: "1px solid var(--border-default)" }}>
                          {r.action as string}
                        </span>
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        {conditions.split("\n").map((c, i) => (
                          <code
                            key={i}
                            style={{
                              display: "block",
                              fontFamily: "var(--mono)",
                              fontSize: "0.7rem",
                              background: "var(--surface-2)",
                              padding: "1px 5px",
                              borderRadius: 3,
                              marginBottom: 2,
                            }}
                          >
                            {c}
                          </code>
                        ))}
                      </td>
                      {editable && (
                        <td>
                          <button className="btn btn-sm btn-secondary" style={{ marginRight: "var(--sp-1)" }} onClick={() => onEditRule(r.rule_id as string)}>
                            Edit
                          </button>
                          <button className="btn btn-sm btn-secondary" onClick={() => onDeleteRule(r.rule_id as string)}>
                            Del
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable && (
            <div style={{ padding: "var(--sp-3) 0", textAlign: "right" }}>
              <button className="btn btn-sm btn-secondary" onClick={onAddRule} style={{ color: "var(--success)" }}>
                + Add Rule
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
