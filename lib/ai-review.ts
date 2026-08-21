/**
 * AI reviewer — shared, dependency-free logic (safe to import on the client).
 *
 * Purpose: the fund-attribution SCORE can be low (small tainted proportion) even
 * when the address itself is flagged or had a DIRECT interaction with a
 * high-risk entity (sanctions / freeze / hacker). This module extracts those
 * direct/self high-risk findings deterministically — so a red flag never
 * depends on the LLM — and packages a compact input for the DeepSeek review.
 */

/** A path node on a hit (subset of WidthPathNode). */
interface HitNode {
  address?: string;
  amount?: number;
  deep?: number;
  tags?: { primary_category?: string; secondary_category?: string; tertiary_category?: string; risk_level?: string }[];
}
/** A hit (subset of WidthHit). */
export interface ReviewHit {
  ruleCode?: string;
  ruleName?: string;
  category?: string;
  riskLevel?: string;
  pathFlow?: string;
  hops?: number;
  opponentAddress?: string;
  maxAmount?: number;
  pathNodes?: HitNode[];
}

export interface RiskFinding {
  rule: string;
  ruleName: string;
  category: string;
  severity: string;
  /** self = the subject itself is flagged · direct = 1-hop counterparty · indirect = 2+ hops */
  kind: "self" | "direct" | "indirect";
  hops: number;
  opponent: string;
  tags: string[];
  amount: number;
}

export interface ReviewInput {
  type: "kya" | "kyt";
  subject: string;
  chain: string;
  score: number | null;
  verdict: string | null;
  selfHit: boolean;
  selfHitLevel: string | null;
  subjectTags: string[];
  /** Self + direct high-risk hits — the ones a low score might under-weight. */
  findings: RiskFinding[];
  /** Rolled-up indirect (2+ hop) exposure counts. */
  indirectSummary: { category: string; severity: string; count: number }[];
  overview: { inTotal?: number; outTotal?: number; balance?: number } | null;
}

export interface AiReviewResult {
  /** alert = a direct/self high-risk interaction the score may under-state. */
  flag: "clear" | "caution" | "alert";
  headline: string;
  reasons: string[];
  recommendation: string;
  model?: string;
  /** Present when the model reply could not be parsed as JSON. */
  raw?: string;
}

const HIGH_SEV = new Set(["critical", "high"]);

export function severityKind(h: ReviewHit): "self" | "direct" | "indirect" {
  if (String(h.pathFlow) === "self" || String(h.ruleCode || "").includes("SELFHIT") || (h.hops ?? 99) <= 0) return "self";
  if ((h.hops ?? 99) <= 1) return "direct";
  return "indirect";
}

function opponentTags(h: ReviewHit): string[] {
  const nodes = h.pathNodes || [];
  const opp = nodes.find((n) => n.address === h.opponentAddress) || nodes[0];
  const out: string[] = [];
  for (const t of opp?.tags || []) {
    const parts = [t.primary_category, t.secondary_category, t.tertiary_category].filter(Boolean) as string[];
    const label = parts.join(" / ");
    if (label && !out.includes(label)) out.push(label);
  }
  return out.slice(0, 3);
}

interface ScoreLike { score?: number | null; verdict?: string | null; selfHit?: boolean; selfHitLevel?: string | null }
interface TagLike { primaryCategory?: string; tertiaryCategory?: string; riskLevel?: string }
interface ResultLike {
  address?: string;
  transaction?: string;
  chain?: string;
  hits?: ReviewHit[];
  score?: ScoreLike | null;
  subjectTags?: TagLike[];
  fromTags?: TagLike[];
  scoreOverview?: { inTotal?: number; outTotal?: number; balance?: number } | null;
}

/** Build the compact AI-review input from a KYA/KYT screening result. Pure. */
export function extractReviewInput(type: "kya" | "kyt", result: ResultLike): ReviewInput {
  const hits = result.hits || [];
  const findings: RiskFinding[] = [];
  const indirect = new Map<string, { category: string; severity: string; count: number }>();

  for (const h of hits) {
    const kind = severityKind(h);
    const sev = String(h.riskLevel || "").toLowerCase();
    if ((kind === "self" || kind === "direct") && HIGH_SEV.has(sev)) {
      findings.push({
        rule: String(h.ruleCode || ""),
        ruleName: String(h.ruleName || h.ruleCode || ""),
        category: String(h.category || ""),
        severity: sev,
        kind,
        hops: Number(h.hops ?? 0),
        opponent: String(h.opponentAddress || ""),
        tags: opponentTags(h),
        amount: Number(h.maxAmount ?? 0),
      });
    } else {
      const key = `${h.category}|${sev}`;
      const e = indirect.get(key) || { category: String(h.category || ""), severity: sev, count: 0 };
      e.count++;
      indirect.set(key, e);
    }
  }
  // Severity-first, self before direct, larger amount first.
  const rank: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
  findings.sort(
    (a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0)
      || (a.kind === "self" ? -1 : 0) - (b.kind === "self" ? -1 : 0)
      || b.amount - a.amount,
  );

  const s = result.score || null;
  const tagList = (result.subjectTags || result.fromTags || []).map(
    (t) => [t.primaryCategory, t.tertiaryCategory, t.riskLevel].filter(Boolean).join(" / "),
  ).filter(Boolean);

  return {
    type,
    subject: type === "kya" ? String(result.address || "") : String(result.transaction || ""),
    chain: String(result.chain || ""),
    score: s?.score ?? null,
    verdict: s?.verdict ?? null,
    selfHit: !!s?.selfHit,
    selfHitLevel: s?.selfHitLevel ?? null,
    subjectTags: tagList,
    findings,
    indirectSummary: [...indirect.values()].sort((a, b) => b.count - a.count),
    overview: result.scoreOverview
      ? { inTotal: result.scoreOverview.inTotal, outTotal: result.scoreOverview.outTotal, balance: result.scoreOverview.balance }
      : null,
  };
}

/** Deterministic flag independent of the LLM: any self/direct high-risk finding = alert. */
export function deterministicFlag(input: ReviewInput): "clear" | "caution" | "alert" {
  if (input.selfHit) return "alert";
  if (input.findings.some((f) => f.kind === "self" || f.kind === "direct")) return "alert";
  if (input.indirectSummary.some((s) => s.severity === "critical" || s.severity === "high")) return "caution";
  return "clear";
}
