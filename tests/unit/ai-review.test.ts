/**
 * Unit tests for lib/ai-review.ts — the deterministic direct/self high-risk
 * detection that flags cases a low fund-score would under-weight.
 */
import { describe, it, expect } from "vitest";
import { extractReviewInput, deterministicFlag, severityKind, type ReviewHit } from "@/lib/ai-review";

function node(address: string, deep: number, amount = 0, cat?: string, level = "high") {
  return { address, deep, amount, tags: cat ? [{ primary_category: cat, risk_level: level }] : [] };
}

function makeResult(hits: ReviewHit[], score: Record<string, unknown> | null = { score: 8, verdict: "accept" }) {
  return { address: "TSubject", chain: "Tron", hits, score, scoreOverview: { inTotal: 1000000, outTotal: 900000, balance: 5 } };
}

describe("severityKind", () => {
  it("self for SELFHIT / hops 0 / pathFlow self", () => {
    expect(severityKind({ ruleCode: "KYA_CYBER_SELFHIT", hops: 0 })).toBe("self");
    expect(severityKind({ pathFlow: "self", hops: 0 })).toBe("self");
  });
  it("direct for 1 hop, indirect for 2+", () => {
    expect(severityKind({ hops: 1 })).toBe("direct");
    expect(severityKind({ hops: 3 })).toBe("indirect");
  });
});

describe("extractReviewInput + deterministicFlag", () => {
  it("low score but a DIRECT sanction hit → alert with the finding surfaced", () => {
    const hits: ReviewHit[] = [
      {
        ruleCode: "KYA_SANCTION_EXPOSURE", ruleName: "Exposure to sanctioned address",
        category: "Sanctions", riskLevel: "critical", pathFlow: "inflow", hops: 1,
        opponentAddress: "TSanctioned",
        maxAmount: 5000,
        pathNodes: [node("TSanctioned", 0, 0, "Sanctions"), node("TSubject", 1, 5000)],
      },
    ];
    const input = extractReviewInput("kya", makeResult(hits, { score: 6, verdict: "accept" }));
    expect(input.findings).toHaveLength(1);
    expect(input.findings[0].kind).toBe("direct");
    expect(input.findings[0].category).toBe("Sanctions");
    expect(input.findings[0].tags[0]).toContain("Sanctions");
    expect(deterministicFlag(input)).toBe("alert"); // NOT softened by the low score
  });

  it("self-hit sets selfHit and alert", () => {
    const hits: ReviewHit[] = [
      { ruleCode: "KYA_CYBER_SELFHIT", ruleName: "Address is a cybercrime entity", category: "Cybercrime", riskLevel: "high", pathFlow: "self", hops: 0, opponentAddress: "TSubject", pathNodes: [] },
    ];
    const input = extractReviewInput("kya", makeResult(hits, { score: 80, verdict: "block", selfHit: true, selfHitLevel: "high" }));
    expect(input.selfHit).toBe(true);
    expect(input.findings.some((f) => f.kind === "self")).toBe(true);
    expect(deterministicFlag(input)).toBe("alert");
  });

  it("only indirect exposure → caution, not alert", () => {
    const hits: ReviewHit[] = [
      { ruleCode: "KYA_CYBER_EXPOSURE_H3", category: "Cybercrime", riskLevel: "high", pathFlow: "inflow", hops: 3, opponentAddress: "TFar", pathNodes: [node("TFar", 0, 0, "Cybercrime"), node("TMid", 1), node("TMid2", 2), node("TSubject", 3, 100)] },
    ];
    const input = extractReviewInput("kya", makeResult(hits));
    expect(input.findings).toHaveLength(0);
    expect(input.indirectSummary[0]).toMatchObject({ category: "Cybercrime", severity: "high", count: 1 });
    expect(deterministicFlag(input)).toBe("caution");
  });

  it("clean result → clear", () => {
    const input = extractReviewInput("kya", makeResult([]));
    expect(deterministicFlag(input)).toBe("clear");
  });
});
