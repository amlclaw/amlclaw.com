"use client";

import { useState, Suspense, lazy } from "react";
import { formatTime, shortenAddr, showToast } from "@/lib/utils";
import { hitsToEntities } from "@/lib/parse-evidence-flow";
import { riskPillClass, riskColorVar, riskLabel, recommendation, formatUsd } from "@/lib/risk-ui";
import type { KyaScreenResult, WidthHit } from "@/lib/width-api";

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
            Configure parameters above and click <strong>Start KYA Screening</strong> to begin.
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

function CompletedReport({ job }: { job: Record<string, unknown>; jobId: string | null }) {
  const [evidenceView, setEvidenceView] = useState<"list" | "graph">("list");

  const r = (job.result ?? {}) as unknown as KyaScreenResult;
  const req = (job.request as Record<string, unknown>) || {};
  const hits = r.hits || [];
  const entities = hitsToEntities(hits);
  const target = { address: r.address, chain: r.chain, tags: [] };
  const rec = recommendation(hits.map((h) => h.action));
  const scenario = (req.scenario as string) || "all";

  // Group hits by rule
  const ruleGroups = new Map<string, WidthHit[]>();
  for (const hit of hits) {
    if (!ruleGroups.has(hit.ruleCode)) ruleGroups.set(hit.ruleCode, []);
    ruleGroups.get(hit.ruleCode)!.push(hit);
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
              KYA Address Screening Report
            </div>
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: "var(--sp-1)", display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
              <span>{formatTime(job.completed_at as string)}</span>
              <span>&middot;</span>
              <span>Engine: width.info V3</span>
              <span>&middot;</span>
              <span>Ruleset #{r.rulesetId}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-start" }}>
            <GoMonitorButton chain={r.chain} address={r.address} />
            <RiskBadge level={r.risk} score={r.riskScore} />
          </div>
        </div>

        {/* Risk reason banner */}
        {r.riskReason && (
          <div className={`report-alert ${["critical", "high"].includes(r.risk) ? "report-alert-danger" : "report-alert-success"}`} style={{ marginBottom: "var(--sp-4)" }}>
            {r.riskReason}
          </div>
        )}

        {/* ── 2. Subject Identification ── */}
        <div className="report-section">
          <div className="report-section-header">Subject Identification</div>
          <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
            <tbody>
              <tr>
                <td style={{ color: "var(--text-tertiary)", width: 140, fontWeight: 600 }}>Network</td>
                <td>{r.chain || (req.chain as string) || "-"}</td>
              </tr>
              <tr>
                <td style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Address</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", wordBreak: "break-all" }}>
                  {r.address || (req.address as string) || "-"}
                </td>
              </tr>
              {r.cluster?.name ? (
                <tr>
                  <td style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Cluster</td>
                  <td>{r.cluster.name}{r.cluster.category ? ` (${r.cluster.category})` : ""}</td>
                </tr>
              ) : null}
              {r.addressType ? (
                <tr>
                  <td style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Address Type</td>
                  <td>{r.addressType}</td>
                </tr>
              ) : null}
              <tr>
                <td style={{ color: "var(--text-tertiary)", fontWeight: 600 }}>Identity Check</td>
                <td>
                  <span className={`badge ${r.addressIdentifications?.length ? "badge-danger" : "badge-success"}`}>
                    {r.addressIdentifications?.length ? "FLAGS DETECTED" : "CLEAN"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── 3. Address Identifications ── */}
        {r.addressIdentifications?.length > 0 && (
          <div className="report-section">
            <div className="report-section-header">Address Identifications</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Name</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {r.addressIdentifications.map((id, i) => (
                  <tr key={i}>
                    <td><span className="pill-severe">{id.category}</span></td>
                    <td>{id.name}</td>
                    <td style={{ color: "var(--text-tertiary)" }}>{id.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 4. Key Risk Indicators ── */}
        <div className="report-section">
          <div className="report-section-header">Key Risk Indicators (KRI)</div>
          <div className="report-kri-grid">
            <KriCard value={r.riskScore === 0 ? "Clean" : riskLabel(r.risk)} label="Risk Level" color={r.riskScore === 0 ? "var(--success)" : riskColorVar(r.risk)} />
            <KriCard value={`${r.hitPaths}/${r.totalPaths}`} label="Hit Paths" color={r.hitPaths > 0 ? "var(--risk-high)" : "var(--success)"} />
            <KriCard value={`${(r.inflowRiskRate * 100).toFixed(1)}%`} label="Inflow Risk Rate" color={r.inflowRiskRate > 0 ? "var(--risk-high)" : "var(--text-secondary)"} />
            <KriCard value={`${(r.outflowRiskRate * 100).toFixed(1)}%`} label="Outflow Risk Rate" color={r.outflowRiskRate > 0 ? "var(--risk-high)" : "var(--text-secondary)"} />
            <KriCard
              value={rec}
              label="Recommendation"
              color={rec === "Pass" ? "var(--success)" : rec === "Review" ? "var(--risk-medium)" : "var(--danger)"}
            />
          </div>
        </div>

        {/* ── 5. Exposure Breakdown ── */}
        {r.exposures?.length > 0 && (
          <div className="report-section">
            <div className="report-section-header">Exposure Breakdown</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Direction</th>
                  <th>Exposure Amount</th>
                </tr>
              </thead>
              <tbody>
                {r.exposures.map((ex, i) => (
                  <tr key={i}>
                    <td><span className={`pill-${riskPillClass(ex.category === "Sanctions" ? "critical" : "medium")}`}>{ex.category}</span></td>
                    <td>{ex.direction}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>{formatUsd(ex.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 6. Rules Triggered ── */}
        <div className="report-section">
          <div className="report-section-header">Rules Triggered</div>
          {ruleGroups.size > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule Code</th>
                  <th>Risk</th>
                  <th>Name</th>
                  <th>Action</th>
                  <th>Paths</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(ruleGroups.entries()).map(([code, groupHits]) => (
                  <tr key={code}>
                    <td style={{ fontFamily: "var(--mono)" }}>{code}</td>
                    <td>
                      <span className={`risk-pill ${riskPillClass(groupHits[0].riskLevel)}`}>
                        {riskLabel(groupHits[0].riskLevel)}
                      </span>
                    </td>
                    <td>{groupHits[0].ruleName}</td>
                    <td>
                      <span className="action-pill" style={{ background: "var(--surface-3)", border: "1px solid var(--border-default)" }}>
                        {groupHits[0].action}
                      </span>
                    </td>
                    <td>{groupHits.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="report-alert report-alert-success">
              All rules passed — no policy violations detected
            </div>
          )}
        </div>

        {/* ── 7. Risk Evidence ── */}
        <div className="report-section">
          <div className="report-section-header">
            <span>Risk Evidence ({entities.length})</span>
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
              <div style={{ fontSize: "2rem", marginBottom: "var(--sp-2)" }}>{"✓"}</div>
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
              <FlowGraph
                entities={entities as unknown as Record<string, unknown>[]}
                target={target as unknown as Record<string, unknown>}
                scenario={scenario}
                chain={r.chain || "Tron"}
              />
            </Suspense>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {entities.map((entity, idx) => (
                <EntityCard key={idx} entity={entity as unknown as Record<string, unknown>} />
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

export function RiskBadge({ level, score }: { level: string; score?: number }) {
  // riskScore is a fixed mapping of the level (10/60/80/90) with no signal of
  // its own — the level from the user's ruleset is the core. We only use
  // score===0 to detect the "no rule triggered at all" clean state.
  const isClean = score === 0;
  const color = isClean ? "var(--success)" : riskColorVar(level);
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "10px 16px", borderRadius: "var(--radius)",
        fontWeight: 700, fontSize: "var(--text-sm)", minWidth: 80,
        background: "var(--surface-2)", color, border: `1px solid ${color}`,
      }}
    >
      {isClean ? "Clean" : riskLabel(level)}
      <span style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2, opacity: 0.8 }}>
        {isClean ? "No Rules Triggered" : "Risk Level"}
      </span>
    </div>
  );
}

/** One-click add the screened address to Address Monitoring. */
export function GoMonitorButton({ chain, address }: { chain: string; address: string }) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  const add = async () => {
    if (state !== "idle") return;
    setState("saving");
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "address", chain, address }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create monitor");
      }
      setState("done");
      showToast("Address added to monitoring", "success");
    } catch (e) {
      setState("idle");
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  return (
    <button
      className="btn btn-sm btn-secondary"
      onClick={add}
      disabled={state !== "idle"}
      style={{ marginTop: "var(--sp-2)" }}
      title="Watch this address's future transactions — each new tx is KYT-screened"
    >
      {state === "done" ? "✓ Monitoring" : state === "saving" ? "Adding..." : "⏱ Go on Monitoring"}
    </button>
  );
}

export function KriCard({ value, label, color, unit }: { value: string | number; label: string; color: string; unit?: string }) {
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

export function EntityCard({ entity }: { entity: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const addr = (entity.address as string) || "Unknown";
  const tag = entity.tag as Record<string, unknown> | undefined;
  const matchedRules = (entity.matched_rules as string[]) || [];
  const minDeep = entity.min_deep as number;
  const evidencePaths = (entity.evidence_paths as Record<string, unknown>[]) || [];
  const riskLevelRaw = tag?.risk_level ? String(tag.risk_level) : "low";
  const pillCls = riskPillClass(riskLevelRaw);

  return (
    <div className={`report-evidence ${pillCls}`}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span className={`pill-${pillCls}`} style={{ flexShrink: 0 }}>
            {tag?.primary_category ? String(tag.primary_category) : riskLabel(riskLevelRaw)}
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
