/**
 * Unit tests for lib/risk-score.ts — the fund-attribution scoring rule engine.
 * Contribution = base(direction, hop bucket) × severity weight × fund ratio.
 * Invariants: money counted once (path count never inflates the score), each
 * edge claimed by its highest-rate cell, denominator caps, KYT counterparty
 * anchoring (+1 hop shift), SELFHIT override, band config.
 */
import { describe, it, expect } from "vitest";
import {
  scoreFromHits,
  detectSelfHit,
  edgeOfHit,
  scoreVerdict,
  DEFAULT_SCORING,
  type ScoringConfig,
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
function inflowHit(entry: number, neighbor: string, hops = 1, level = "critical", opponent = "TOpp"): WidthHit {
  const nodes = [{ address: opponent, amount: 0, deep: 0, tags: [] }];
  if (hops > 1) nodes.push({ address: neighbor, amount: entry * 2, deep: 1, tags: [] });
  nodes.push({ address: SUBJECT, amount: entry, deep: hops, tags: [] });
  if (hops === 1) nodes[0].address = neighbor;
  return hit({ hops, riskLevel: level, opponentAddress: opponent, pathNodes: nodes, pathFlow: "inflow" });
}

/** outflow path: subject(deep0) → neighbor(deep1, amount = exit edge) → … */
function outflowHit(exit: number, neighbor: string, hops = 1, level = "critical"): WidthHit {
  return hit({
    hops,
    riskLevel: level,
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
});

describe("rule engine — matrix cells", () => {
  it("direct critical inflow: 80 × 1.0 × ratio", () => {
    const s = scoreFromHits([inflowHit(100, "TN1", 1, "critical")], 1000, null);
    expect(s.score).toBeCloseTo(80 * 0.1, 1);
    expect(s.components).toHaveLength(1);
    expect(s.components[0]).toMatchObject({ direction: "in", hopBucket: "direct", severity: "critical", base: 80, weight: 1 });
  });

  it("severity weights scale the same money differently", () => {
    const sHigh = scoreFromHits([inflowHit(100, "TN1", 1, "high")], 1000, null);
    const sMed = scoreFromHits([inflowHit(100, "TN1", 1, "medium")], 1000, null);
    expect(sHigh.score).toBeCloseTo(80 * 0.8 * 0.1, 1); // 6.4
    expect(sMed.score).toBeCloseTo(80 * 0.6 * 0.1, 1); // 4.8
  });

  it("hop buckets use their own bases (2 hop = 50, 3 hop = 40)", () => {
    const s2 = scoreFromHits([inflowHit(100, "TN1", 2)], 1000, null);
    const s3 = scoreFromHits([inflowHit(100, "TN1", 3)], 1000, null);
    expect(s2.score).toBeCloseTo(50 * 0.1, 1);
    expect(s3.score).toBeCloseTo(40 * 0.1, 1);
  });

  it("CFT: direct outflow uses base 80, deep outflow nearly nothing", () => {
    const direct = scoreFromHits([outflowHit(500, "TOut", 1)], null, 1000);
    const deep = scoreFromHits([outflowHit(500, "TOut3", 3)], null, 1000);
    expect(direct.score).toBeCloseTo(80 * 0.5, 1); // 40
    expect(deep.score).toBeCloseTo(5 * 0.5, 1); // 2.5
  });
});

describe("rule engine — money counted once", () => {
  it("601 paths over the same edge count once", () => {
    const hits = Array.from({ length: 601 }, (_, i) => inflowHit(60, "TSameNbr", 3, "critical", `TOpp${i}`));
    const s = scoreFromHits(hits, 6000, null);
    expect(s.riskyEdges).toBe(1);
    expect(s.score).toBeCloseTo(40 * 0.01, 1);
  });

  it("same edge hit at multiple severities/hops → claimed by highest-rate cell only", () => {
    // direct critical (rate 80) beats hop3 medium (rate 24)
    const s = scoreFromHits(
      [inflowHit(100, "TNbr", 3, "medium"), inflowHit(100, "TNbr", 1, "critical")],
      1000, null,
    );
    expect(s.components).toHaveLength(1);
    expect(s.components[0].hopBucket).toBe("direct");
    expect(s.score).toBeCloseTo(8, 1);
  });

  it("denominator cap: high-rate cells claim the denominator first, ratios ≤ 100%", () => {
    const s = scoreFromHits(
      [inflowHit(800, "TN1", 1, "critical"), inflowHit(900, "TN2", 3, "critical")],
      1000, null,
    );
    // direct claims 800, hop3 gets the remaining 200 (rawAmount keeps the 900)
    expect(s.components.find((c) => c.hopBucket === "direct")!.amount).toBe(800);
    const hop3 = s.components.find((c) => c.hopBucket === "hop3")!;
    expect(hop3.amount).toBe(200);
    expect(hop3.rawAmount).toBe(900);
    expect(s.score).toBeCloseTo(80 * 0.8 + 40 * 0.2, 1); // 72
  });

  it("fully crowded-out cells stay visible with amount 0 and their rawAmount", () => {
    // top cell's raw already exceeds the denominator → second cell counted 0
    const s = scoreFromHits(
      [inflowHit(5000, "TN1", 1, "critical"), inflowHit(900, "TN2", 3, "high")],
      1000, null,
    );
    const hop3 = s.components.find((c) => c.hopBucket === "hop3")!;
    expect(hop3.amount).toBe(0);
    expect(hop3.rawAmount).toBe(900);
    expect(s.score).toBe(80); // only the direct-critical cell scores
  });

  it("rate tie-break is deterministic: higher severity claims the money first", () => {
    // hop2·high (50×0.8=40) ties hop3·critical (40×1.0=40) → critical wins
    const s = scoreFromHits(
      [inflowHit(600, "TN1", 2, "high"), inflowHit(700, "TN2", 3, "critical")],
      1000, null,
    );
    const first = s.components[0];
    expect(first.severity).toBe("critical");
    expect(first.amount).toBe(700);
    expect(s.components.find((c) => c.severity === "high")!.amount).toBe(300);
  });

  it("total clamped at 100 when both directions max out", () => {
    const s = scoreFromHits(
      [inflowHit(1000, "TN1", 1, "critical"), outflowHit(1000, "TOut", 1, "critical")],
      1000, 1000,
    );
    expect(s.score).toBe(100);
  });
});

describe("KYT counterparty anchoring", () => {
  it("hops shift +1: sender-anchored hops=1 lands in hop2 bucket", () => {
    const s = scoreFromHits([inflowHit(5000, "TSender", 1)], 7000, null, { counterpartyAnchored: true });
    expect(s.components[0].hopBucket).toBe("hop2");
    expect(s.score).toBeCloseTo(50 * Math.min(5000 / 7000, 1), 1); // ~35.7
  });

  it("counterpartyFlagged fills the direct-critical cell with the full tx", () => {
    const s = scoreFromHits([], 7000, null, { counterpartyAnchored: true, counterpartyFlagged: true });
    expect(s.score).toBe(80);
    expect(s.verdict).toBe("block");
    expect(s.selfHit).toBe(false);
  });
});

describe("overrides, degradation, custom config", () => {
  it("KYA SELFHIT overrides to selfHitScore", () => {
    const s = scoreFromHits([], 1000, 1000, { selfHit: true });
    expect(s.score).toBe(100);
    expect(s.verdict).toBe("block");
  });

  it("degrades to null score without denominators", () => {
    const s = scoreFromHits([inflowHit(100, "TN1", 1)], null, null);
    expect(s.score).toBeNull();
    expect(s.verdict).toBeNull();
    expect(s.directAmount).toBe(100); // amounts still reported
  });

  it("custom config: zeroing medium weight silences medium money", () => {
    const cfg: ScoringConfig = {
      ...DEFAULT_SCORING,
      severityWeights: { ...DEFAULT_SCORING.severityWeights, medium: 0 },
    };
    const s = scoreFromHits([inflowHit(500, "TN1", 1, "medium")], 1000, null, { config: cfg });
    expect(s.score).toBe(0);
    expect(s.verdict).toBe("accept");
  });

  it("custom bands move verdicts", () => {
    expect(scoreVerdict(25)).toBe("review");
    expect(scoreVerdict(25, { review: 30, edd: 60, block: 90 })).toBe("accept");
  });
});

describe("selfhit detection", () => {
  it("detects SELFHIT rule codes and sanction identifications", () => {
    expect(detectSelfHit([hit({ ruleCode: "KYT_IN_SANCTION_SELFHIT" })])).toBe(true);
    expect(detectSelfHit([], [{ category: "Sanctions" }])).toBe(true);
    expect(detectSelfHit([hit({})], [{ category: "Exchange" }])).toBe(false);
  });
});
