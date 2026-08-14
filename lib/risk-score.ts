/**
 * Fund-score types & display helpers ("资金占比评分").
 *
 * Since v3.1 the fund-attribution score is computed SERVER-SIDE by the
 * width.info engine (see `score` / `inScore` / `outScore` in the KYA/KYT
 * responses) — AMLClaw no longer computes it locally. This module only hosts:
 *   - the `FundScore` / `ScoreComponent` shapes the width API returns
 *     (used as the typed view of `result.score`), and
 *   - `edgeOfHit`, a pure display helper used by the Risk Evidence module to
 *     extract the subject-adjacent edge amount of a hit path.
 */
import type { WidthHit } from "./width-api";

export type Verdict = "accept" | "review" | "edd" | "block";

type HopBucket = "direct" | "hop2" | "hop3";

export interface RiskyEdge {
  /** Address adjacent to the subject on this path (direct counterparty of the edge). */
  neighbor: string;
  amount: number;
}

export interface ScoreComponent {
  direction: "in" | "out";
  hopBucket: HopBucket;
  severity: string;
  base: number;
  weight: number;
  /** Deduped, money-disjoint amount claimed by this cell (after caps). */
  amount: number;
  /** Deduped amount attributed to this cell BEFORE denominator capping. A cell
   *  with rawAmount > 0 but amount 0 was fully crowded out by higher-priority
   *  cells (money is counted once). */
  rawAmount: number;
  ratio: number;
  points: number;
}

export interface FundScore {
  /** null when denominators are unavailable. */
  score: number | null;
  verdict: Verdict | null;
  selfHit: boolean;
  /** Severity of the subject's own flag when selfHit (critical/high/…). */
  selfHitLevel?: string | null;
  counterpartyFlagged: boolean;
  /** Per-cell breakdown: base × weight × ratio = points, individually verifiable. */
  components: ScoreComponent[];
  // Direction summaries (direct-in / other-in / out) for compact display.
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
