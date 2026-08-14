/**
 * Unit tests for lib/risk-score.ts — since v3.1 the fund score is computed
 * server-side by the width.info engine, so this module only hosts the typed
 * shapes and the `edgeOfHit` display helper used by Risk Evidence.
 */
import { describe, it, expect } from "vitest";
import { edgeOfHit } from "@/lib/risk-score";
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

  it("single-node paths fall back to opponentAddress + maxAmount", () => {
    const e = edgeOfHit(hit({ opponentAddress: "TOpp", maxAmount: 120, pathNodes: [] }));
    expect(e.amount).toBe(120);
    expect(e.neighbor).toBe("TOpp");
  });
});
