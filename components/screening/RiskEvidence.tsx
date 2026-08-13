"use client";

/**
 * Risk Evidence — the fund-path evidence module for KYA / KYT reports.
 *
 * Design: hits are grouped by rule into collapsible cards (rule name + risk
 * badge + path count). Each path renders as a horizontal money-flow strip
 * (opponent → … → target for inflow; target → … → opponent for outflow) with
 * per-edge amounts, the subject-adjacent edge amount and its share of the
 * subject's total volume spelled out (占比 = 相接边金额 ÷ 总量), consistent
 * with the fund-attribution score. Replaces the old Rules-Triggered table and
 * flat entity list.
 */
import { useState, Suspense, lazy, useMemo } from "react";
import { shortenAddr } from "@/lib/utils";
import { riskPillClass, riskLabel, riskSortRank } from "@/lib/risk-ui";
import { hitsToEntities } from "@/lib/parse-evidence-flow";
import { edgeOfHit } from "@/lib/risk-score";
import type { WidthHit, WidthPathNode } from "@/lib/width-api";

const FlowGraph = lazy(() => import("./FlowGraph"));

const PATHS_PREVIEW = 3;

function explorerUrl(chain: string, address: string): string {
  return chain === "Ethereum"
    ? `https://etherscan.io/address/${address}`
    : `https://tronscan.org/#/address/${address}`;
}

function fmtAmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
}

function nodeTags(n: WidthPathNode): string[] {
  const out: string[] = [];
  for (const t of n.tags || []) {
    const c = t.primary_category || t.secondary_category;
    if (c && !out.includes(c)) out.push(c);
  }
  return out.slice(0, 2);
}

/** KYT anchoring info: KYT_IN rules trace the tx's FROM address, KYT_OUT the TO. */
export interface KytAnchors {
  from: string;
  to: string;
}

/** KYT side of a hit — from the rule-code prefix (pathFlow is unreliable:
 *  the API reports "inflow" on KYT_OUT hits too). */
function kytSideOf(hit: WidthHit): "in" | "out" {
  return String(hit.ruleCode || "").startsWith("KYT_OUT") ? "out" : "in";
}

/* ── one horizontal path strip ── */
function PathStrip({ hit, chain, targetAddress, totalIn, totalOut, kytAnchors }: {
  hit: WidthHit;
  chain: string;
  targetAddress?: string;
  totalIn: number | null;
  totalOut: number | null;
  kytAnchors?: KytAnchors;
}) {
  const inflow = hit.pathFlow === "inflow";
  const side = kytAnchors ? kytSideOf(hit) : (inflow ? "in" : "out");
  const nodes = [...(hit.pathNodes || [])].sort((a, b) => a.deep - b.deep);
  const edge = edgeOfHit(hit);
  const denom = side === "in" ? totalIn : totalOut;
  const ratio = denom && edge.amount > 0 ? Math.min(edge.amount / denom, 1) : null;
  const opponent =
    hit.opponentAddress ||
    (inflow ? nodes[0]?.address : nodes[nodes.length - 1]?.address) ||
    "";

  return (
    <div style={{ padding: "var(--sp-3) 0", borderTop: "1px solid var(--border-subtle)" }}>
      {/* chips row */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap", marginBottom: 4 }}>
        <span className="badge" style={{ color: inflow ? "var(--primary-500)" : "var(--risk-medium)", fontWeight: 700 }}>
          {inflow ? "↓ 流入" : "↑ 流出"}
        </span>
        {kytAnchors && (
          <span className="badge" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>
            溯源 {side === "in" ? "from" : "to"} · {shortenAddr(side === "in" ? kytAnchors.from : kytAnchors.to)}
          </span>
        )}
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{hit.hops} 跳</span>
        <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--mono)", fontWeight: 700 }}>{fmtAmt(edge.amount)}</span>
        {ratio != null && (
          <span className="badge" style={{ color: "var(--risk-medium)", border: "1px solid color-mix(in srgb, var(--risk-medium) 45%, transparent)", fontWeight: 700 }}>
            占比 {(ratio * 100).toFixed(ratio < 0.001 ? 2 : 1)}%
          </span>
        )}
        {hit.category && (
          <span className={`risk-pill ${riskPillClass(hit.riskLevel)}`} style={{ fontSize: "0.65rem" }}>
            {hit.category}
          </span>
        )}
      </div>

      {/* ratio explanation */}
      {ratio != null && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--risk-medium)", marginBottom: "var(--sp-2)" }}>
          占比 {(ratio * 100).toFixed(ratio < 0.001 ? 2 : 1)}% = 与目标相接的转账 {fmtAmt(edge.amount)} ÷ 目标总{inflow ? "入金" : "出金"} {fmtAmt(denom!)}
        </div>
      )}

      {/* node flow strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
        {nodes.map((n, i) => {
          const isOpp = n.address === opponent;
          const anchorAddr = kytAnchors ? (side === "in" ? kytAnchors.from : kytAnchors.to) : targetAddress;
          const isTarget = anchorAddr && n.address === anchorAddr;
          const anchorLabel = kytAnchors ? (side === "in" ? "from(付款方)" : "to(收款方)") : "目标";
          const tags = isOpp ? nodeTags(n) : [];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {i > 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 var(--sp-2)", minWidth: 72 }}>
                  <span style={{ fontSize: "0.65rem", fontFamily: "var(--mono)", color: "var(--success)", fontWeight: 700 }}>
                    {fmtAmt(n.amount)}
                  </span>
                  <span style={{ color: "var(--text-tertiary)", fontSize: "0.7rem", letterSpacing: "-1px" }}>┄┄▶</span>
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <a
                  href={explorerUrl(chain, n.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block", padding: "7px 12px", borderRadius: 8,
                    fontFamily: "var(--mono)", fontSize: "0.7rem", textDecoration: "none",
                    background: isOpp ? "color-mix(in srgb, var(--danger) 10%, transparent)" : "var(--surface-2)",
                    border: `1.5px solid ${isOpp ? "var(--danger)" : isTarget ? "var(--primary-500)" : "var(--border-default)"}`,
                    color: isOpp ? "var(--danger)" : "var(--text-primary)",
                    fontWeight: isOpp || isTarget ? 700 : 500,
                  }}
                  title={n.address}
                >
                  {shortenAddr(n.address)}
                </a>
                {(isOpp && tags.length > 0) || isTarget ? (
                  <div style={{ fontSize: "0.62rem", color: isOpp ? "var(--danger)" : "var(--text-tertiary)", marginTop: 2 }}>
                    {isOpp ? `· ${tags.join(" · ")}` : anchorLabel}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── rule group card ── */
function RuleCard({ ruleName, riskLevel, hits, chain, targetAddress, totalIn, totalOut, defaultOpen, kytAnchors }: {
  ruleName: string;
  riskLevel: string;
  hits: WidthHit[];
  chain: string;
  targetAddress?: string;
  totalIn: number | null;
  totalOut: number | null;
  defaultOpen: boolean;
  kytAnchors?: KytAnchors;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? hits : hits.slice(0, PATHS_PREVIEW);

  return (
    <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface-1)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "var(--sp-3)",
          padding: "var(--sp-3) var(--sp-4)", background: "transparent", border: "none",
          cursor: "pointer", color: "var(--text-primary)", textAlign: "left",
        }}
      >
        <span style={{ color: "var(--text-tertiary)", fontSize: "0.7rem", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: "var(--text-sm)", display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
          {kytAnchors && (
            <span className="badge" style={{
              flexShrink: 0, fontWeight: 700, fontSize: "0.62rem",
              color: hits[0] && kytSideOf(hits[0]) === "out" ? "var(--risk-medium)" : "var(--primary-500)",
              border: `1px solid ${hits[0] && kytSideOf(hits[0]) === "out" ? "var(--risk-medium)" : "var(--primary-500)"}`,
            }}>
              {hits[0] && kytSideOf(hits[0]) === "out" ? "KYT-OUT" : "KYT-IN"}
            </span>
          )}
          {ruleName}
        </span>
        <span className={`risk-pill ${riskPillClass(riskLevel)}`}>{riskLabel(riskLevel)}</span>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>×{hits.length} 条路径</span>
      </button>
      {open && (
        <div style={{ padding: "0 var(--sp-4) var(--sp-3)" }}>
          {shown.map((h, i) => (
            <PathStrip key={i} hit={h} chain={chain} targetAddress={targetAddress} totalIn={totalIn} totalOut={totalOut} kytAnchors={kytAnchors} />
          ))}
          {hits.length > PATHS_PREVIEW && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              style={{ marginTop: "var(--sp-2)", background: "transparent", border: "1px dashed var(--border-strong, var(--border-default))", borderRadius: 8, padding: "6px 14px", color: "var(--primary-500)", fontSize: "var(--text-xs)", cursor: "pointer" }}
            >
              展开全部 {hits.length} 条路径
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── main module ── */
export default function RiskEvidence({ hits, chain, targetAddress, totalIn, totalOut, scenario, kytAnchors }: {
  hits: WidthHit[];
  chain: string;
  targetAddress?: string;
  totalIn: number | null;
  totalOut: number | null;
  scenario?: string;
  kytAnchors?: KytAnchors;
}) {
  const [view, setView] = useState<"list" | "graph">("list");

  const groups = useMemo(() => {
    const map = new Map<string, { ruleName: string; riskLevel: string; hits: WidthHit[] }>();
    for (const h of hits) {
      const g = map.get(h.ruleCode) || { ruleName: h.ruleName || h.ruleCode, riskLevel: h.riskLevel, hits: [] };
      g.hits.push(h);
      map.set(h.ruleCode, g);
    }
    // per-rule: biggest subject-adjacent edge first
    for (const g of map.values()) g.hits.sort((a, b) => edgeOfHit(b).amount - edgeOfHit(a).amount);
    return [...map.values()].sort(
      (a, b) => riskSortRank(a.riskLevel) - riskSortRank(b.riskLevel) || b.hits.length - a.hits.length,
    );
  }, [hits]);

  const entities = useMemo(() => hitsToEntities(hits), [hits]);
  const target = { address: targetAddress || "", chain, tags: [] };

  return (
    <div className="report-section">
      <div className="report-section-header">
        <span>Risk Evidence · 触发规则({groups.length})</span>
        {hits.length > 0 && (
          <div className="tab-bar" style={{ width: "auto" }}>
            <button className={`tab-btn ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>List</button>
            <button className={`tab-btn ${view === "graph" ? "active" : ""}`} onClick={() => setView("graph")}>Graph</button>
          </div>
        )}
      </div>

      {hits.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--sp-8)", color: "var(--success)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "var(--sp-2)" }}>✓</div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>No rules triggered — subject appears clean.</div>
        </div>
      ) : view === "graph" ? (
        <Suspense fallback={<div style={{ height: 500, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="spinner spinner-lg" /></div>}>
          <FlowGraph
            entities={entities as unknown as Record<string, unknown>[]}
            target={target as unknown as Record<string, unknown>}
            scenario={scenario || "all"}
            chain={chain}
          />
        </Suspense>
      ) : kytAnchors ? (
        // KYT: the same rule names exist on both sides — split into IN / OUT sections.
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {([
            ["inflow", `KYT-IN · 付款方资金来源(from ${shortenAddr(kytAnchors.from)})`, "var(--primary-500)"],
            ["outflow", `KYT-OUT · 收款方资金去向(to ${shortenAddr(kytAnchors.to)})`, "var(--risk-medium)"],
          ] as const).map(([flow, label, color]) => {
            const side = groups.filter((g) => (g.hits[0] ? kytSideOf(g.hits[0]) : "in") === (flow === "outflow" ? "out" : "in"));
            if (side.length === 0) return null;
            return (
              <div key={flow} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 800, color, letterSpacing: "0.02em", marginTop: flow === "outflow" ? "var(--sp-2)" : 0 }}>
                  {label}
                  <span style={{ fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 8 }}>{side.length} 组规则</span>
                </div>
                {side.map((g, i) => (
                  <RuleCard
                    key={i}
                    ruleName={g.ruleName}
                    riskLevel={g.riskLevel}
                    hits={g.hits}
                    chain={chain}
                    targetAddress={targetAddress}
                    totalIn={totalIn}
                    totalOut={totalOut}
                    defaultOpen={flow === "inflow" && i === 0}
                    kytAnchors={kytAnchors}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {groups.map((g, i) => (
            <RuleCard
              key={i}
              ruleName={g.ruleName}
              riskLevel={g.riskLevel}
              hits={g.hits}
              chain={chain}
              targetAddress={targetAddress}
              totalIn={totalIn}
              totalOut={totalOut}
              defaultOpen={i === 0}
              kytAnchors={kytAnchors}
            />
          ))}
        </div>
      )}
    </div>
  );
}
