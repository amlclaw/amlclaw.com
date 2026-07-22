/**
 * Unit tests for hitsToEntities — v3 hit → legacy entity adaptation
 */
import { describe, it, expect } from "vitest";
import { hitsToEntities, parseFlowString } from "@/lib/parse-evidence-flow";
import type { WidthHit } from "@/lib/width-api";

function makeHit(overrides: Partial<WidthHit> = {}): WidthHit {
  return {
    ruleCode: "KYA_SANCTION_EXPOSURE",
    ruleName: "Exposure to sanctioned address",
    category: "Sanctions",
    riskLevel: "critical",
    action: "block",
    direction: "",
    pathFlow: "inflow",
    hops: 1,
    opponentAddress: "TOpponent",
    maxAmount: 5000,
    pathNodes: [
      {
        address: "TOpponent",
        amount: 0,
        deep: 0,
        tags: [
          { primary_category: "Sanctions", secondary_category: "OFAC", risk_level: "high" },
          { primary_category: "Other Entities", risk_level: "low" },
        ],
      },
      { address: "TTarget", amount: 5000, deep: 1, tags: [] },
    ],
    ...overrides,
  };
}

describe("hitsToEntities", () => {
  it("maps a hit to a legacy entity", () => {
    const [entity] = hitsToEntities([makeHit()]);
    expect(entity.address).toBe("TOpponent");
    expect(entity.matched_rules).toEqual(["KYA_SANCTION_EXPOSURE"]);
    expect(entity.matched_rules_detail[0]).toMatchObject({
      rule_id: "KYA_SANCTION_EXPOSURE",
      risk_level: "critical",
      action: "block",
    });
    expect(entity.min_deep).toBe(1);
    expect(entity.evidence_paths).toHaveLength(1);
  });

  it("prefers the tag matching the hit category", () => {
    const [entity] = hitsToEntities([makeHit()]);
    expect(entity.tag?.primary_category).toBe("Sanctions");
    expect(entity.tag?.secondary_category).toBe("OFAC");
  });

  it("builds a parseable inflow flow string opponent → target", () => {
    const [entity] = hitsToEntities([makeHit()]);
    const steps = parseFlowString(entity.evidence_paths[0].flow);
    expect(steps.map((s) => s.address)).toEqual(["TOpponent", "TTarget"]);
    // Edge amount lives on the first step (edge into next node)
    expect(steps[0].amount).toContain("5000");
  });

  it("reverses outflow paths so flow reads target → opponent", () => {
    const hit = makeHit({
      pathFlow: "outflow",
      pathNodes: [
        { address: "TOpponent", amount: 0, deep: 0, tags: [] },
        { address: "TTarget", amount: 3000, deep: 1, tags: [] },
      ],
    });
    const [entity] = hitsToEntities([hit]);
    const steps = parseFlowString(entity.evidence_paths[0].flow);
    expect(steps.map((s) => s.address)).toEqual(["TTarget", "TOpponent"]);
  });

  it("merges hits sharing the same opponent", () => {
    const entities = hitsToEntities([
      makeHit(),
      makeHit({ ruleCode: "KYA_CYBERCRIME", ruleName: "Cybercrime", riskLevel: "high", hops: 2 }),
    ]);
    expect(entities).toHaveLength(1);
    expect(entities[0].matched_rules).toEqual(["KYA_SANCTION_EXPOSURE", "KYA_CYBERCRIME"]);
    expect(entities[0].min_deep).toBe(1);
  });

  it("handles hits with empty pathNodes", () => {
    const [entity] = hitsToEntities([makeHit({ pathNodes: [] })]);
    expect(entity.address).toBe("TOpponent");
    expect(entity.evidence_paths[0].flow).toContain("TOpponent");
  });
});
