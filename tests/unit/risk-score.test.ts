/**
 * Unit tests for lib/risk-score.ts — fund attribution + score.
 * Core invariants: money counted once (path count never inflates the score),
 * severity precedence (direct claims an edge before indirect), denominator
 * caps, SELFHIT override, verdict bands.
 */
import { describe, it, expect } from "vitest";
import {
  attributeFunds,
  computeFundScore,
  detectSelfHit,
  edgeOfHit,
  scoreVerdict,
} from "@/lib/risk-score";
import type { WidthHit } from "@/lib/width-api";

const SUBJECT = "TSubjectAddr";

function hit(over: Partial<WidthHit>): WidthHit {
  return {
    ruleCode: "KYA_SANCTION_EXPOSURE",
    ruleName: "Exposure to sanctioned address",
    category: "Sanctions",
    riskLevel: "critical",
    action: "block",
    direction: "",
    pathFlow: "inflow",
    hops: 1,
    opponentAddress: "TOpponent1",
    maxAmount: 0,
    pathNodes: [],
    ...over,
  };
}

/** inflow path: opponent(deep0) → … → subject(maxDeep, amount = entry edge) */
function inflowHit(entry: number, neighbor: string, hops = 1, opponent = "TOpp"): WidthHit {
  const nodes = [{ address: opponent, amount: 0, deep: 0, tags: [] }];
  if (hops > 1) nodes.push({ address: neighbor, amount: entry * 2, deep: 1, tags: [] });
  nodes.push({ address: SUBJECT, amount: entry, deep: hops, tags: [] });
  // for hops=1 the neighbor IS the opponent
  if (hops === 1) nodes[0].address = neighbor;
  return hit({ hops, opponentAddress: opponent, pathNodes: nodes, pathFlow: "inflow" });
}

/** outflow path: subject(deep0) → neighbor(deep1, amount = exit edge) → … */
function outflowHit(exit: number, neighbor: string, hops = 1): WidthHit {
  return hit({
    hops,
    pathFlow: "outflow",
    pathNodes: [
      { address: SUBJECT, amount: 0, deep: 0, tags: [] },
      { address: neighbor, amount: exit, deep: 1, tags: [] },
    ],
  });
}

describe("edgeOfHit", () => {
  it("inflow: entry edge = subject (max-deep) node amount", () => {
    const e = edgeOfHit(inflowHit(500, "TNbr", 3));
    expect(e.amount).toBe(500);
    expect(e.neighbor).toBe("TNbr");
  });
  it("outflow: exit edge = deep-1 node amount", () => {
    const e = edgeOfHit(outflowHit(700, "TNext"));
    expect(e.amount).toBe(700);
    expect(e.neighbor).toBe("TNext");
  });
  it("falls back to maxAmount when pathNodes are missing", () => {
    const e = edgeOfHit(hit({ pathNodes: [], maxAmount: 123 }));
    expect(e.amount).toBe(123);
  });
});

describe("attributeFunds — money counted once", () => {
  it("many paths over the same entry edge count once (no path inflation)", () => {
    // 601-paths-on-60-USDT scenario: same edge, many hits
    const hits = Array.from({ length: 601 }, (_, i) =>
      inflowHit(60, "TSameNbr", 3, `TOpp${i}`),
    );
    const a = attributeFunds(hits, false);
    expect(a.indirectAmount).toBe(60);
    expect(a.indirectEdges).toHaveLength(1);
    expect(a.hitPaths).toBe(601);
  });

  it("distinct edges add up", () => {
    const a = attributeFunds(
      [inflowHit(100, "TN1", 2), inflowHit(200, "TN2", 3)],
      false,
    );
    expect(a.indirectAmount).toBe(300);
  });

  it("severity precedence: direct claims the edge, indirect never re-counts it", () => {
    const a = attributeFunds(
      [inflowHit(100, "TNbr", 1), inflowHit(100, "TNbr", 3)],
      false,
    );
    expect(a.directAmount).toBe(100);
    expect(a.indirectAmount).toBe(0);
  });

  it("outflow edges dedupe independently", () => {
    const a = attributeFunds(
      [outflowHit(400, "TOut1"), outflowHit(400, "TOut1"), outflowHit(50, "TOut2")],
      false,
    );
    expect(a.outflowAmount).toBe(450);
  });
});

describe("computeFundScore", () => {
  it("weighted sum with disjoint buckets", () => {
    const a = attributeFunds(
      [inflowHit(100, "TN1", 1), inflowHit(300, "TN2", 3), outflowHit(200, "TO1")],
      false,
    );
    const s = computeFundScore(a, 1000, 500);
    expect(s.r1).toBeCloseTo(0.1);
    expect(s.r2).toBeCloseTo(0.3);
    expect(s.rOut).toBeCloseTo(0.4);
    expect(s.score).toBeCloseTo(80 * 0.1 + 40 * 0.3 + 10 * 0.4); // 24
    expect(s.verdict).toBe("review");
  });

  it("amounts capped at denominators — ratio never exceeds 100%", () => {
    const a = attributeFunds([inflowHit(5000, "TN1", 1)], false);
    const s = computeFundScore(a, 1000, null);
    expect(s.r1).toBe(1);
    expect(s.score).toBe(80);
    expect(s.verdict).toBe("block");
  });

  it("SELFHIT overrides to 100 regardless of ratios", () => {
    const s = computeFundScore(attributeFunds([], true), 1000, 1000);
    expect(s.score).toBe(100);
    expect(s.verdict).toBe("block");
  });

  it("degrades to null score when no denominators available", () => {
    const a = attributeFunds([inflowHit(100, "TN1", 1)], false);
    const s = computeFundScore(a, null, null);
    expect(s.score).toBeNull();
    expect(s.verdict).toBeNull();
    expect(s.directAmount).toBe(100); // amounts still reported
  });
});

describe("verdict bands + selfhit detection", () => {
  it("bands", () => {
    expect(scoreVerdict(0)).toBe("accept");
    expect(scoreVerdict(19.9)).toBe("accept");
    expect(scoreVerdict(20)).toBe("review");
    expect(scoreVerdict(50)).toBe("edd");
    expect(scoreVerdict(80)).toBe("block");
  });
  it("detects SELFHIT rule codes and sanction identifications", () => {
    expect(detectSelfHit([hit({ ruleCode: "KYT_IN_SANCTION_SELFHIT" })])).toBe(true);
    expect(detectSelfHit([], [{ category: "Sanctions" }])).toBe(true);
    expect(detectSelfHit([hit({})], [{ category: "Exchange" }])).toBe(false);
  });
});
