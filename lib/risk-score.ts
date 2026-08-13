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

/** Legacy weights kept for reference; the live engine uses ScoringConfig. */
export const SCORE_WEIGHTS = { direct: 80, indirect: 40, outflow: 10 } as const;

// ---------------------------------------------------------------------------
// Scoring rule engine config: contribution =
//   base(direction, hop bucket) × severityWeight(rule level) × fund ratio
// Money is still counted once — every subject-adjacent edge is claimed by the
// single highest-rate cell that hit it. Total is clamped to 100.
// ---------------------------------------------------------------------------

export interface ScoringConfig {
  inBases: { direct: number; hop2: number; hop3: number };
  outBases: { direct: number; hop2: number; hop3: number };
  severityWeights: { critical: number; high: number; medium: number; low: number };
  selfHitScore: number;
  bands: { review: number; edd: number; block: number };
}

export const DEFAULT_SCORING: ScoringConfig = {
  inBases: { direct: 80, hop2: 50, hop3: 40 },
  outBases: { direct: 80, hop2: 10, hop3: 5 },
  severityWeights: { critical: 1, high: 0.8, medium: 0.6, low: 0.3 },
  selfHitScore: 100,
  bands: { review: 20, edd: 50, block: 80 },
};

export type Verdict = "accept" | "review" | "edd" | "block";

export function scoreVerdict(score: number, bands = DEFAULT_SCORING.bands): Verdict {
  if (score >= bands.block) return "block";
  if (score >= bands.edd) return "edd";
  if (score >= bands.review) return "review";
  return "accept";
}

type HopBucket = "direct" | "hop2" | "hop3";

function hopBucket(hops: number): HopBucket {
  if (hops <= 1) return "direct";
  if (hops === 2) return "hop2";
  return "hop3";
}

function severityWeight(level: string, cfg: ScoringConfig): number {
  const l = String(level || "").toLowerCase() as keyof ScoringConfig["severityWeights"];
  return cfg.severityWeights[l] ?? cfg.severityWeights.low;
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

export interface ScoreComponent {
  direction: "in" | "out";
  hopBucket: HopBucket;
  severity: string;
  base: number;
  weight: number;
  /** Deduped, money-disjoint amount claimed by this cell. */
  amount: number;
  ratio: number;
  points: number;
}

export interface FundScore {
  /** null when denominators are unavailable (chain data fetch failed). */
  score: number | null;
  verdict: Verdict | null;
  selfHit: boolean;
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

export interface ScoreFromHitsOptions {
  config?: ScoringConfig;
  /**
   * KYT mode: paths are anchored at the tx COUNTERPARTY (KYT-IN traces from
   * the sender; hops count from there, NOT from the screened subject) — so
   * every path hop is shifted +1 before bucketing.
   */
  counterpartyAnchored?: boolean;
  /** KYT: a *_SELFHIT rule fired — the counterparty itself is flagged; the
   *  full tx amount lands in the direct bucket (critical). */
  counterpartyFlagged?: boolean;
  /** KYA: the subject itself is sanctioned/frozen → selfHitScore override. */
  selfHit?: boolean;
}

/**
 * The scoring rule engine. Each subject-adjacent edge is claimed ONCE by the
 * single highest-rate cell (base × severity weight) among the hits that
 * produced it; cell amounts are then capped against the direction denominator
 * in rate order, so per-direction ratios never exceed 100%. Total clamped to
 * 100. Money is the unit — paths are evidence, not score.
 */
export function scoreFromHits(
  hits: WidthHit[],
  totalIn: number | null,
  totalOut: number | null,
  opts: ScoreFromHitsOptions = {},
): FundScore {
  const cfg = opts.config ?? DEFAULT_SCORING;
  const hopShift = opts.counterpartyAnchored ? 1 : 0;

  // 1. Fold hits onto edges; each edge remembers its best (highest-rate) cell.
  interface EdgeBest { amount: number; direction: "in" | "out"; bucket: HopBucket; severity: string; rate: number }
  const edges = new Map<string, EdgeBest>();
  for (const h of hits) {
    const e = edgeOfHit(h);
    if (e.amount <= 0) continue;
    const dir: "in" | "out" = h.pathFlow === "outflow" ? "out" : "in";
    const bucket = hopBucket((h.hops || 0) + hopShift);
    const base = (dir === "in" ? cfg.inBases : cfg.outBases)[bucket];
    const w = severityWeight(h.riskLevel, cfg);
    const rate = base * w;
    const key = `${dir}|${e.neighbor}|${e.amount.toFixed(6)}`;
    const prev = edges.get(key);
    if (!prev || rate > prev.rate) {
      edges.set(key, { amount: e.amount, direction: dir, bucket, severity: String(h.riskLevel || "low").toLowerCase(), rate });
    }
  }

  // 2. Aggregate edges into cells.
  const cells = new Map<string, ScoreComponent>();
  for (const e of edges.values()) {
    const base = (e.direction === "in" ? cfg.inBases : cfg.outBases)[e.bucket];
    const w = severityWeight(e.severity, cfg);
    const key = `${e.direction}|${e.bucket}|${e.severity}`;
    const c = cells.get(key) || {
      direction: e.direction, hopBucket: e.bucket, severity: e.severity,
      base, weight: w, amount: 0, ratio: 0, points: 0,
    };
    c.amount += e.amount;
    cells.set(key, c);
  }

  // 2b. KYT counterparty flagged: full tx amount is a direct critical inflow.
  if (opts.counterpartyFlagged && totalIn != null && totalIn > 0) {
    cells.set("in|direct|critical", {
      direction: "in", hopBucket: "direct", severity: "critical",
      base: cfg.inBases.direct, weight: cfg.severityWeights.critical,
      amount: totalIn, ratio: 0, points: 0,
    });
  }

  // 3. Cap cell amounts against the direction denominator, high-rate cells
  //    claiming the denominator first — per-direction ratios sum to <= 100%.
  const byRate = [...cells.values()].sort((a, b) => b.base * b.weight - a.base * a.weight);
  const remaining: Record<"in" | "out", number | null> = { in: totalIn, out: totalOut };
  for (const c of byRate) {
    const rem = remaining[c.direction];
    if (rem != null) {
      c.amount = Math.min(c.amount, Math.max(0, rem));
      remaining[c.direction] = rem - c.amount;
    }
    const denom = c.direction === "in" ? totalIn : totalOut;
    c.ratio = denom ? Math.min(c.amount / denom, 1) : 0;
    c.points = Math.round(c.base * c.weight * c.ratio * 10) / 10;
  }
  const components = byRate.filter((c) => c.amount > 0);

  // 4. Total.
  let score: number | null = null;
  if (opts.selfHit) {
    score = cfg.selfHitScore;
  } else if (totalIn != null || totalOut != null) {
    score = Math.min(100, Math.round(components.reduce((a, c) => a + c.points, 0) * 10) / 10);
  }

  // Direction summaries for compact display.
  const sum = (f: (c: ScoreComponent) => boolean) =>
    components.filter(f).reduce((a, c) => a + c.amount, 0);
  const directAmount = sum((c) => c.direction === "in" && c.hopBucket === "direct");
  const indirectAmount = sum((c) => c.direction === "in" && c.hopBucket !== "direct");
  const outflowAmount = sum((c) => c.direction === "out");

  return {
    score,
    verdict: score == null ? null : scoreVerdict(score, cfg.bands),
    selfHit: !!opts.selfHit,
    counterpartyFlagged: !!opts.counterpartyFlagged,
    components,
    r1: totalIn ? Math.min(directAmount / totalIn, 1) : 0,
    r2: totalIn ? Math.min(indirectAmount / totalIn, 1) : 0,
    rOut: totalOut ? Math.min(outflowAmount / totalOut, 1) : 0,
    directAmount, indirectAmount, outflowAmount,
    totalIn, totalOut,
    hitPaths: hits.length,
    riskyEdges: edges.size,
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
