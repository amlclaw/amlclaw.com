/**
 * Fund-attribution risk score ("资金占比评分").
 *
 * Principle: money is counted once — paths are evidence, not score.
 * A screen returns many hit paths; multiple paths often carry the SAME funds
 * into the subject. We therefore attribute risk at the level of the EDGE that
 * touches the subject (the entry edge for inflow paths / exit edge for
 * outflow paths), dedupe edges, and convert to ratios of total volume.
 *
 * Formula (agreed 2026-08):
 *   - SELFHIT (subject itself sanctioned/frozen)  -> score 100 (override)
 *   - otherwise  score = 80*r1 + 40*r2 + 10*rOut
 *       r1   = direct (<=1 hop) risky inflow  / total inflow
 *       r2   = indirect (2+ hop) risky inflow / total inflow
 *       rOut = risky outflow                  / total outflow
 *     Buckets are money-disjoint (severity precedence: direct claims an edge
 *     first; an edge claimed by direct is never re-counted as indirect), so
 *     the weighted sum is naturally bounded.
 *
 * Bands: 0-20 accept · 20-50 review · 50-80 edd (enhanced due diligence) ·
 *        80-100 block.
 */
import type { WidthHit } from "./width-api";

export const SCORE_WEIGHTS = { direct: 80, indirect: 40, outflow: 10 } as const;

export type Verdict = "accept" | "review" | "edd" | "block";

export function scoreVerdict(score: number): Verdict {
  if (score >= 80) return "block";
  if (score >= 50) return "edd";
  if (score >= 20) return "review";
  return "accept";
}

export interface RiskyEdge {
  /** Address adjacent to the subject on this path (direct counterparty of the edge). */
  neighbor: string;
  amount: number;
}

export interface FundAttribution {
  selfHit: boolean;
  directAmount: number;
  indirectAmount: number;
  outflowAmount: number;
  directEdges: RiskyEdge[];
  indirectEdges: RiskyEdge[];
  outflowEdges: RiskyEdge[];
  /** Total hit paths that were folded into the edges above. */
  hitPaths: number;
}

/**
 * Extract the edge where a hit path touches the subject.
 * Path nodes are ordered by `deep`: inflow paths run opponent(deep 0) → …
 * → subject(max deep), where each node's `amount` is the edge INTO that node —
 * so the subject node's amount is the entry edge. Outflow paths run
 * subject(deep 0) → … → opponent, so the deep-1 node's amount is the exit edge.
 */
export function edgeOfHit(hit: WidthHit): RiskyEdge {
  const nodes = [...(hit.pathNodes || [])].sort((a, b) => a.deep - b.deep);
  const inflow = hit.pathFlow === "inflow";
  if (nodes.length >= 2) {
    if (inflow) {
      const subject = nodes[nodes.length - 1];
      const neighbor = nodes[nodes.length - 2];
      return {
        neighbor: neighbor.address || hit.opponentAddress || "?",
        amount: subject.amount || hit.maxAmount || 0,
      };
    }
    const next = nodes[1];
    return { neighbor: next.address || hit.opponentAddress || "?", amount: next.amount || hit.maxAmount || 0 };
  }
  return { neighbor: hit.opponentAddress || "?", amount: hit.maxAmount || 0 };
}

function edgeKey(e: RiskyEdge): string {
  return `${e.neighbor}|${e.amount.toFixed(6)}`;
}

/**
 * Fold hit paths into money-disjoint buckets of subject-adjacent edges.
 * Severity precedence: direct (<=1 hop) inflow claims an edge first; an edge
 * already claimed by direct is not re-counted as indirect.
 */
export function attributeFunds(hits: WidthHit[], selfHit: boolean): FundAttribution {
  const direct = new Map<string, RiskyEdge>();
  const indirect = new Map<string, RiskyEdge>();
  const outflow = new Map<string, RiskyEdge>();

  const inflowHits = hits
    .filter((h) => h.pathFlow === "inflow")
    .sort((a, b) => (a.hops || 0) - (b.hops || 0));
  for (const h of inflowHits) {
    const e = edgeOfHit(h);
    if (e.amount <= 0) continue;
    const key = edgeKey(e);
    if ((h.hops || 0) <= 1) {
      direct.set(key, e);
      indirect.delete(key);
    } else if (!direct.has(key)) {
      indirect.set(key, e);
    }
  }
  for (const h of hits.filter((h) => h.pathFlow === "outflow")) {
    const e = edgeOfHit(h);
    if (e.amount > 0) outflow.set(edgeKey(e), e);
  }

  const sum = (m: Map<string, RiskyEdge>) =>
    [...m.values()].reduce((a, e) => a + e.amount, 0);

  return {
    selfHit,
    directAmount: sum(direct),
    indirectAmount: sum(indirect),
    outflowAmount: sum(outflow),
    directEdges: [...direct.values()],
    indirectEdges: [...indirect.values()],
    outflowEdges: [...outflow.values()],
    hitPaths: hits.length,
  };
}

export interface FundScore {
  /** null when denominators are unavailable (chain data fetch failed). */
  score: number | null;
  verdict: Verdict | null;
  selfHit: boolean;
  r1: number;
  r2: number;
  rOut: number;
  directAmount: number;
  indirectAmount: number;
  outflowAmount: number;
  totalIn: number | null;
  totalOut: number | null;
  hitPaths: number;
  riskyEdges: number;
  weights: typeof SCORE_WEIGHTS;
}

/**
 * Convert attribution into the score. `totalIn` / `totalOut` are the
 * denominators: full inflow/outflow volume for KYA, the transaction amount for
 * KYT. Pass null when unknown — the score degrades to null (amounts still
 * reported).
 */
export function computeFundScore(
  attr: FundAttribution,
  totalIn: number | null,
  totalOut: number | null,
): FundScore {
  // Cap amounts at the denominators; keep buckets disjoint (direct first).
  const directAmount = totalIn != null ? Math.min(attr.directAmount, totalIn) : attr.directAmount;
  const indirectAmount = totalIn != null
    ? Math.min(attr.indirectAmount, Math.max(0, totalIn - directAmount))
    : attr.indirectAmount;
  const outflowAmount = totalOut != null ? Math.min(attr.outflowAmount, totalOut) : attr.outflowAmount;

  const r1 = totalIn ? Math.min(directAmount / totalIn, 1) : 0;
  const r2 = totalIn ? Math.min(indirectAmount / totalIn, 1) : 0;
  const rOut = totalOut ? Math.min(outflowAmount / totalOut, 1) : 0;

  let score: number | null = null;
  if (attr.selfHit) {
    score = 100;
  } else if (totalIn != null || totalOut != null) {
    score = Math.round(
      (SCORE_WEIGHTS.direct * r1 + SCORE_WEIGHTS.indirect * r2 + SCORE_WEIGHTS.outflow * rOut) * 10,
    ) / 10;
  }

  return {
    score,
    verdict: score == null ? null : scoreVerdict(score),
    selfHit: attr.selfHit,
    r1, r2, rOut,
    directAmount, indirectAmount, outflowAmount,
    totalIn, totalOut,
    hitPaths: attr.hitPaths,
    riskyEdges: attr.directEdges.length + attr.indirectEdges.length + attr.outflowEdges.length,
    weights: SCORE_WEIGHTS,
  };
}

/** SELFHIT detection: an identification on the address itself, or a *_SELFHIT rule. */
export function detectSelfHit(
  hits: WidthHit[],
  addressIdentifications?: { category: string }[],
): boolean {
  if (hits.some((h) => h.ruleCode.includes("SELFHIT"))) return true;
  return (addressIdentifications || []).some((i) =>
    /sanction|freeze/i.test(i.category || ""),
  );
}
