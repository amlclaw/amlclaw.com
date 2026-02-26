"use client";

import { useState, Suspense, lazy } from "react";
import { formatTime, shortenAddr } from "@/lib/utils";

const FlowGraph = lazy(() => import("./FlowGraph"));

interface ScreeningResultProps {
  job: Record<string, unknown> | null;
  jobId: string | null;
  loading: boolean;
  progress: string;
}

export default function ScreeningResult({ job, jobId, loading, progress }: ScreeningResultProps) {
  if (loading) {
    return (
      <ResultContainer>
        <div style={{ padding: "var(--sp-10) var(--sp-6)", textAlign: "center" }}>
          <div className="spinner spinner-lg" style={{ margin: "0 auto var(--sp-4)" }} />
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--sp-2)" }}>
            {progress || "Processing..."}
          </div>
        </div>
      </ResultContainer>
    );
  }

  if (!job) {
    return (
      <ResultContainer>
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "var(--sp-16) var(--sp-5)", textAlign: "center",
          }}
        >
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z" />
          </svg>
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginTop: "var(--sp-4)" }}>
            Configure parameters above and click <strong>Start Screening</strong> to begin.
          </p>
        </div>
      </ResultContainer>
    );
  }

  if (job.status === "error") {
    return (
      <ResultContainer>
        <div style={{ padding: "var(--sp-10) var(--sp-6)", textAlign: "center" }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "var(--danger-dim)", color: "var(--danger)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto var(--sp-4)", fontSize: "var(--text-xl)", fontWeight: 700,
            }}
          >
            !
          </div>
          <div style={{ color: "var(--danger)", fontSize: "var(--text-sm)", maxWidth: 500, margin: "0 auto", wordBreak: "break-word" }}>
            {(job.error as string) || "Unknown error"}
          </div>
        </div>
      </ResultContainer>
    );
  }

  return <CompletedReport job={job} jobId={jobId} />;
}

function CompletedReport({ job, jobId }: { job: Record<string, unknown>; jobId: string | null }) {
  const [evidenceView, setEvidenceView] = useState<"list" | "graph">("list");

  const r = (job.result as Record<string, unknown>) || {};
  const req = (job.request as Record<string, unknown>) || {};
  const target = (r.target as Record<string, unknown>) || {};
  const summary = (r.summary as Record<string, unknown>) || {};
  const entities = (r.risk_entities as Record<string, unknown>[]) || [];
  const selfMatchedRules = (target.self_matched_rules as string[]) || [];
  const selfTags = (target.tags as Record<string, unknown>[]) || [];
  const triggeredRules = (summary.rules_triggered as string[]) || [];
  const rulesLoaded = (summary.rules_loaded as number) || 0;
  const totalRules = (summary.total_rules as number) || rulesLoaded;
  const categoriesApplied = (summary.categories_applied as string[]) || [];
  const pathsDirection = (summary.paths_direction_filtered as string) || "";

  const overallRisk = computeOverallRisk(summary, entities);
  const riskScore = computeRiskScore(overallRisk);

  const scenario = (r.scenario as string) || (req.scenario as string) || "all";

  // Group entities by triggered rule
  const ruleGroups = new Map<string, Record<string, unknown>[]>();
  for (const entity of entities) {
    const matched = (entity.matched_rules as string[]) || [];
    for (const rid of matched) {
      if (!ruleGroups.has(rid)) ruleGroups.set(rid, []);
      ruleGroups.get(rid)!.push(entity);
    }
  }

  return (
    <ResultContainer>
      <div style={{ padding: "var(--sp-6)" }}>
        {/* ── 1. Report Header ── */}
        <div
          style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            marginBottom: "var(--sp-6)", paddingBottom: "var(--sp-4)",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <div>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 700, letterSpacing: "-0.01em" }}>
              AML Address Screening Report
            </div>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: "var(--sp-1)", display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
              <span>{formatTime(job.completed_at as string)}</span>
              <span>&middot;</span>
              <span>Engine: AMLClaw Web</span>
              <span>&middot;</span>
              <span>Scenario: {scenario}</span>
              {categoriesApplied.length > 0 && (
                <>
                  <span>&middot;</span>
                  <span>Categories: {categoriesApplied.join(", ")}</span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-start" }}>
            {jobId && (
              <a href={`/api/screening/${jobId}/export`} download className="btn btn-sm btn-secondary">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export
              </a>
            )}
            <RiskBadge level={overallRisk} />
          </div>
        </div>

        {/* ── 2. Subject Identification ── */}
        <div className="report-section">
          <div className="report-section-header">Subject Identification</div>
          <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
            <tbody>
              <tr>
                <td style={{ color: "var(--text-tertiary)", width: 140, fontWeight: 600 }}>Network</td>
                <td>{(target.chain as string) || (req.chain as string) || "-"}</td>
              </tr>
              <tr>
                <td style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Address</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", wordBreak: "break-all" }}>
                  {(target.address as string) || (req.address as string) || "-"}
                </td>
              </tr>
              <tr>
                <td style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Validation</td>
                <td>
                  <span className={`badge ${selfTags.length > 0 || selfMatchedRules.length > 0 ? "badge-danger" : "badge-success"}`}>
                    {selfTags.length > 0 || selfMatchedRules.length > 0 ? "FLAGS DETECTED" : "CLEAN"}
                  </span>
                </td>
              </tr>
              <tr>
                <td style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Ruleset</td>
                <td>{(req.ruleset as string) || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── 3. Target Self-Risk Assessment ── */}
        {(selfTags.length > 0 || selfMatchedRules.length > 0) && (
          <div className="report-section">
            <div className="report-section-header">Target Self-Risk Assessment</div>
            <div className="report-alert report-alert-danger">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Address has {selfTags.length} self-tag{selfTags.length !== 1 ? "s" : ""} and {selfMatchedRules.length} self-triggered rule{selfMatchedRules.length !== 1 ? "s" : ""}
            </div>
            {selfTags.length > 0 && (
              <table className="data-table" style={{ marginBottom: "var(--sp-3)" }}>
                <thead>
                  <tr>
                    <th>Primary Category</th>
                    <th>Secondary Category</th>
                    <th>Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {selfTags.map((t, i) => (
                    <tr key={i}>
                      <td><span className={`pill-${((t.risk_level as string) || "low").toLowerCase()}`}>{(t.primary_category as string) || "-"}</span></td>
                      <td>{(t.secondary_category as string) || "-"}</td>
                      <td>{(t.risk_level as string) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {selfMatchedRules.length > 0 && (
              <div style={{ display: "flex", gap: "var(--sp-1)", flexWrap: "wrap" }}>
                {selfMatchedRules.map((rid) => (
                  <code key={rid} style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", background: "var(--surface-2)", padding: "2px 6px", borderRadius: 3, border: "1px solid var(--border-default)" }}>
                    {rid}
                  </code>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 4. Key Risk Indicators ── */}
        <div className="report-section">
          <div className="report-section-header">Key Risk Indicators (KRI)</div>
          <div className="report-kri-grid">
            <KriCard value={riskScore} label="Risk Score" color={riskScoreColor(riskScore)} unit="/100" />
            <KriCard value={overallRisk} label="Risk Level" color={riskLevelColor(overallRisk)} />
            <KriCard value={scenario} label="Scenario" color="var(--text-secondary)" />
            <KriCard value={pathsDirection || "all"} label="Direction" color="var(--text-secondary)" />
            <KriCard value={entities.length} label="Paths Analyzed" color={entities.length > 0 ? "var(--risk-high)" : "var(--success)"} />
            <KriCard
              value={entities.length === 0 ? "Pass" : overallRisk === "Severe" || overallRisk === "High" ? "Reject" : "Review"}
              label="Recommendation"
              color={entities.length === 0 ? "var(--success)" : "var(--danger)"}
            />
          </div>
        </div>

        {/* ── 5. Custom Policy Enforcement ── */}
        <div className="report-section">
          <div className="report-section-header">Custom Policy Enforcement</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: "var(--sp-2)" }}>
            Loaded <strong style={{ color: "var(--text-secondary)" }}>{rulesLoaded || totalRules}</strong> of <strong style={{ color: "var(--text-secondary)" }}>{totalRules}</strong> rules
          </div>
          {triggeredRules.length > 0 ? (
            <>
              <div className="report-alert report-alert-danger">
                {triggeredRules.length} rule{triggeredRules.length !== 1 ? "s" : ""} triggered
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rule ID</th>
                    <th>Risk</th>
                    <th>Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {triggeredRules.map((rid) => {
                    const ruleDetail = findRuleInEntities(rid, entities);
                    return (
                      <tr key={rid}>
                        <td style={{ fontFamily: "var(--mono)" }}>{rid}</td>
                        <td>
                          <span className={`risk-pill ${(ruleDetail.risk_level || "").toLowerCase()}`}>
                            {ruleDetail.risk_level || "-"}
                          </span>
                        </td>
                        <td>{ruleDetail.name || "-"}</td>
                        <td>
                          <span className="action-pill" style={{ background: "var(--surface-3)", border: "1px solid var(--border-default)" }}>
                            {ruleDetail.action || "-"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <div className="report-alert report-alert-success">
              All rules passed — no policy violations detected
            </div>
          )}
        </div>

        {/* ── 6. On-Chain Graph Discovery ── */}
        {entities.length > 0 && (
          <div className="report-section">
            <div className="report-section-header">On-Chain Graph Discovery</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Risk Level</th>
                  <th>Min Depth</th>
                  <th>Entities</th>
                </tr>
              </thead>
              <tbody>
                {groupEntitiesByCategory(entities).map(({ category, riskLevel, minDepth, count }) => (
                  <tr key={category + riskLevel}>
                    <td><span className={`pill-${riskLevel.toLowerCase()}`}>{category}</span></td>
                    <td>{riskLevel}</td>
                    <td>Hop {minDepth}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 7. Detailed Risk Evidence ── */}
        <div className="report-section">
          <div className="report-section-header">
            <span>Detailed Risk Evidence ({entities.length})</span>
            {entities.length > 0 && (
              <div className="tab-bar" style={{ width: "auto" }}>
                <button className={`tab-btn ${evidenceView === "list" ? "active" : ""}`} onClick={() => setEvidenceView("list")}>
                  List
                </button>
                <button className={`tab-btn ${evidenceView === "graph" ? "active" : ""}`} onClick={() => setEvidenceView("graph")}>
                  Graph
                </button>
              </div>
            )}
          </div>

          {entities.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--sp-8)", color: "var(--success)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "var(--sp-2)" }}>{"\u2713"}</div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                No risk entities detected. Address appears clean.
              </div>
            </div>
          ) : evidenceView === "graph" ? (
            <Suspense fallback={
              <div style={{ height: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="spinner spinner-lg" />
              </div>
            }>
              <FlowGraph entities={entities} target={target} scenario={scenario} />
            </Suspense>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {/* Group by rule */}
              {Array.from(ruleGroups.entries()).map(([rid, ruleEntities]) => (
                <div key={rid}>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--sp-2)" }}>
                    Trigger: <code style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", background: "var(--surface-2)", padding: "1px 5px", borderRadius: 3 }}>{rid}</code>
                  </div>
                  {ruleEntities.map((entity, idx) => (
                    <EntityCard key={idx} entity={entity} />
                  ))}
                </div>
              ))}
              {/* Entities with no specific rule grouping */}
              {entities.filter((e) => !((e.matched_rules as string[]) || []).length).map((entity, idx) => (
                <EntityCard key={`ungrouped-${idx}`} entity={entity} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ResultContainer>
  );
}

/* ── Helper Components ── */

function ResultContainer({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ minHeight: 300 }}>{children}</div>;
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    severe: { bg: "rgba(239,68,68,0.15)", color: "var(--risk-severe)", border: "rgba(239,68,68,0.3)" },
    high: { bg: "rgba(249,115,22,0.15)", color: "var(--risk-high)", border: "rgba(249,115,22,0.3)" },
    medium: { bg: "rgba(234,179,8,0.15)", color: "var(--risk-medium)", border: "rgba(234,179,8,0.3)" },
    low: { bg: "rgba(34,197,94,0.15)", color: "var(--risk-low)", border: "rgba(34,197,94,0.3)" },
  };
  const c = colors[level.toLowerCase()] || colors.low;
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "10px 16px", borderRadius: "var(--radius)",
        fontWeight: 700, fontSize: "var(--text-sm)", minWidth: 80,
        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      }}
    >
      {level}
      <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2, opacity: 0.8 }}>
        Risk Level
      </span>
    </div>
  );
}

function KriCard({ value, label, color, unit }: { value: string | number; label: string; color: string; unit?: string }) {
  return (
    <div
      style={{
        background: "var(--surface-2)", padding: 14,
        borderRadius: "var(--radius)", border: "1px solid var(--border-subtle)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, fontFamily: "var(--mono)", color }}>
        {value}{unit && <span style={{ fontSize: "var(--text-xs)", opacity: 0.6 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: "var(--sp-1)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
    </div>
  );
}

function EntityCard({ entity }: { entity: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const addr = (entity.address as string) || "Unknown";
  const tag = entity.tag as Record<string, unknown> | undefined;
  const matchedRules = (entity.matched_rules as string[]) || [];
  const minDeep = entity.min_deep as number;
  const evidencePaths = (entity.evidence_paths as Record<string, unknown>[]) || [];
  const riskLevel = tag?.risk_level ? String(tag.risk_level).toLowerCase() : "low";

  return (
    <div className={`report-evidence ${riskLevel}`}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span className={`pill-${riskLevel}`} style={{ flexShrink: 0 }}>
            {tag?.primary_category ? String(tag.primary_category) : riskLevel}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
            {shortenAddr(addr)}
          </span>
          {typeof tag?.secondary_category === "string" && tag.secondary_category && (
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
              / {tag.secondary_category}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", flexShrink: 0 }}>
          <Badge>Hop {minDeep}</Badge>
          <Badge>{matchedRules.length} rule{matchedRules.length !== 1 ? "s" : ""}</Badge>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: "var(--sp-3)", paddingTop: "var(--sp-2)", borderTop: "1px solid var(--border-subtle)" }}>
          {/* Full address */}
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text-tertiary)", wordBreak: "break-all", marginBottom: "var(--sp-2)" }}>
            {addr}
          </div>

          {/* Tag hierarchy */}
          {tag && (
            <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginBottom: "var(--sp-2)", fontSize: "var(--text-xs)" }}>
              {typeof tag.primary_category === "string" && tag.primary_category ? <span>Primary: <strong>{tag.primary_category}</strong></span> : null}
              {typeof tag.secondary_category === "string" && tag.secondary_category ? <span>Secondary: <strong>{tag.secondary_category}</strong></span> : null}
              {typeof tag.risk_level === "string" && tag.risk_level ? <span>Risk: <strong>{tag.risk_level}</strong></span> : null}
            </div>
          )}

          {/* Matched rules */}
          {matchedRules.length > 0 && (
            <div style={{ marginBottom: "var(--sp-2)" }}>
              <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 3 }}>Matched Rules</div>
              <div style={{ display: "flex", gap: "var(--sp-1)", flexWrap: "wrap" }}>
                {matchedRules.map((rid) => (
                  <code key={rid} style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", background: "var(--surface-1)", padding: "2px 6px", borderRadius: 3, border: "1px solid var(--border-default)" }}>
                    {rid}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Evidence chains */}
          {evidencePaths.length > 0 && (
            <div style={{ padding: "8px 12px", background: "var(--surface-1)", borderRadius: "var(--radius)", border: "1px solid var(--border-default)" }}>
              <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "var(--sp-1)" }}>
                Evidence Chains
              </div>
              {evidencePaths.map((ep, i) => (
                <div key={i} style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--text-tertiary)", marginBottom: 3, wordBreak: "break-all" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Hop {ep.deep as number}:</span> {ep.flow as string}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: "var(--text-xs)", fontFamily: "var(--mono)",
      padding: "2px 8px", borderRadius: "var(--radius-sm)",
      background: "var(--surface-1)", border: "1px solid var(--border-default)",
      color: "var(--text-secondary)",
    }}>
      {children}
    </span>
  );
}

/* ── Helper Functions ── */

function computeOverallRisk(summary: Record<string, unknown>, entities: Record<string, unknown>[]): string {
  if (summary.highest_severity) return summary.highest_severity as string;
  if (entities.length === 0) return "Low";
  if (entities.some((e) => hasSeverity(e, "Severe"))) return "Severe";
  if (entities.some((e) => hasSeverity(e, "High"))) return "High";
  if (entities.some((e) => hasSeverity(e, "Medium"))) return "Medium";
  return "Low";
}

function hasSeverity(entity: Record<string, unknown>, level: string): boolean {
  const tag = entity.tag as Record<string, unknown> | undefined;
  return tag?.risk_level?.toString().toLowerCase() === level.toLowerCase();
}

function computeRiskScore(overallRisk: string): number {
  const scores: Record<string, number> = { severe: 100, high: 85, medium: 50, low: 20 };
  return scores[overallRisk.toLowerCase()] || 20;
}

function riskScoreColor(score: number): string {
  if (score >= 85) return "var(--risk-severe)";
  if (score >= 50) return "var(--risk-high)";
  if (score >= 30) return "var(--risk-medium)";
  return "var(--risk-low)";
}

function riskLevelColor(level: string): string {
  const colors: Record<string, string> = {
    severe: "var(--risk-severe)", high: "var(--risk-high)",
    medium: "var(--risk-medium)", low: "var(--risk-low)",
  };
  return colors[level.toLowerCase()] || "var(--text-secondary)";
}

function findRuleInEntities(ruleId: string, entities: Record<string, unknown>[]): { name: string; risk_level: string; action: string } {
  for (const e of entities) {
    const rules = (e.matched_rules_detail as Record<string, unknown>[]) || [];
    for (const r of rules) {
      if (r.rule_id === ruleId) return { name: (r.name as string) || "", risk_level: (r.risk_level as string) || "", action: (r.action as string) || "" };
    }
  }
  // Fallback: infer from entity tag
  for (const e of entities) {
    const matched = (e.matched_rules as string[]) || [];
    if (matched.includes(ruleId)) {
      const tag = e.tag as Record<string, unknown> | undefined;
      return { name: "", risk_level: (tag?.risk_level as string) || "", action: "" };
    }
  }
  return { name: "", risk_level: "", action: "" };
}

function groupEntitiesByCategory(entities: Record<string, unknown>[]): { category: string; riskLevel: string; minDepth: number; count: number }[] {
  const groups = new Map<string, { riskLevel: string; minDepth: number; count: number }>();
  for (const e of entities) {
    const tag = e.tag as Record<string, unknown> | undefined;
    const cat = (tag?.primary_category as string) || "Unknown";
    const risk = (tag?.risk_level as string) || "Low";
    const depth = (e.min_deep as number) || 0;
    const key = `${cat}|${risk}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.minDepth = Math.min(existing.minDepth, depth);
    } else {
      groups.set(key, { riskLevel: risk, minDepth: depth, count: 1 });
    }
  }
  return Array.from(groups.entries()).map(([key, val]) => ({
    category: key.split("|")[0],
    ...val,
  }));
}
