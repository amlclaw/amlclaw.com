"use client";

import { humanizeCondition, renderMarkdown } from "@/lib/utils";

interface RuleCondition {
  parameter: string;
  operator: string;
  value: unknown;
  unit?: string;
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
  conditions?: RuleCondition[];
}

interface RuleCardProps {
  rule: Rule;
  editable: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const actionColors: Record<string, { bg: string; color: string }> = {
  Freeze: { bg: "var(--danger-dim)", color: "var(--danger)" },
  Reject: { bg: "var(--danger-dim)", color: "var(--danger)" },
  EDD: { bg: "rgba(249,115,22,0.12)", color: "var(--risk-high)" },
  Review: { bg: "var(--warning-dim)", color: "var(--warning)" },
  Warning: { bg: "var(--warning-dim)", color: "var(--warning)" },
  Allow: { bg: "var(--success-dim)", color: "var(--success)" },
  Whitelist: { bg: "var(--success-dim)", color: "var(--success)" },
};

export default function RuleCard({ rule, editable, onEdit, onDelete }: RuleCardProps) {
  const riskClass = rule.risk_level.toLowerCase();
  const ac = actionColors[rule.action] || { bg: "var(--surface-3)", color: "var(--text-secondary)" };

  return (
    <div className="rule-card">
      {/* Header */}
      <div className="rule-card-header">
        <span className={`risk-pill ${riskClass}`}>{rule.risk_level}</span>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, flex: 1 }}>
          {rule.name}
        </span>
        <span className="badge badge-neutral">{rule.category}</span>
        <span
          className="action-pill"
          style={{ background: ac.bg, color: ac.color, border: `1px solid ${ac.color}22` }}
        >
          {rule.action}
        </span>
      </div>

      {/* Body: conditions */}
      <div className="rule-card-body">
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginBottom: "var(--sp-2)" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
            {rule.rule_id}
          </span>
          {rule.direction && (
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
              Direction: <strong style={{ color: "var(--text-secondary)" }}>{rule.direction}</strong>
            </span>
          )}
          {(rule.min_hops || rule.max_hops) && (
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
              Hops: <strong style={{ color: "var(--text-secondary)" }}>
                {rule.min_hops || 1}&ndash;{rule.max_hops || "\u221E"}
              </strong>
            </span>
          )}
        </div>

        {rule.conditions && rule.conditions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {rule.conditions.map((cond, i) => (
              <div
                key={i}
                style={{ fontSize: "var(--text-xs)", lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(
                    (i > 0 ? "AND " : "") + humanizeCondition(cond)
                  ),
                }}
              />
            ))}
          </div>
        )}

        {rule.description && (
          <div style={{ marginTop: "var(--sp-2)", fontSize: "0.7rem", color: "var(--text-tertiary)", fontStyle: "italic" }}>
            {rule.description}
          </div>
        )}
      </div>

      {/* Footer */}
      {editable && (
        <div className="rule-card-footer">
          <button className="btn btn-sm btn-secondary" onClick={onEdit}>Edit</button>
          <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete</button>
        </div>
      )}
    </div>
  );
}
