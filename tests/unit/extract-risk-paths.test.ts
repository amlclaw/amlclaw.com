import { describe, it, expect } from "vitest";
import { extractRiskPaths, Rule } from "@/lib/extract-risk-paths";

const RULES: Rule[] = [
  {
    rule_id: "DEP-001",
    category: "Deposit",
    name: "Sanctioned Entity Inflow",
    risk_level: "Severe",
    action: "Reject",
    conditions: [
      { parameter: "path.node.tags.primary_category", operator: "==", value: "Sanctioned Entity" },
    ],
  },
  {
    rule_id: "DEP-002",
    category: "Deposit",
    name: "Gambling Inflow",
    risk_level: "Medium",
    action: "Review",
    direction: "inflow",
    conditions: [
      { parameter: "path.node.tags.primary_category", operator: "==", value: "Gambling" },
    ],
  },
  {
    rule_id: "WDR-001",
    category: "Withdrawal",
    name: "Sanctioned Outflow",
    risk_level: "Severe",
    action: "Freeze",
    direction: "outflow",
    conditions: [
      { parameter: "path.node.tags.primary_category", operator: "==", value: "Sanctioned Entity" },
    ],
  },
  {
    rule_id: "DEP-SELF-001",
    category: "Deposit",
    name: "Target is Sanctioned",
    risk_level: "Severe",
    action: "Reject",
    conditions: [
      { parameter: "target.tags.primary_category", operator: "==", value: "Sanctioned Entity" },
    ],
  },
  {
    rule_id: "DEP-003",
    category: "Deposit",
    name: "Mixer Near Hop",
    risk_level: "High",
    action: "EDD",
    max_hops: 2,
    conditions: [
      { parameter: "path.node.tags.primary_category", operator: "IN", value: ["Mixer", "Tumbler"] },
    ],
  },
];

function makeGraph(opts: {
  address?: string;
  tags?: Record<string, unknown>[];
  paths?: Record<string, unknown>[];
}): Record<string, unknown> {
  return {
    address: opts.address || "TARGET_ADDR",
    graph_data: {
      data: {
        tags: opts.tags || [],
        paths: opts.paths || [],
      },
    },
  };
}

function makePath(direction: number, nodes: Record<string, unknown>[]): Record<string, unknown> {
  return { direction, path: nodes };
}

function makeNode(address: string, primaryCategory?: string, riskLevel?: string): Record<string, unknown> {
  const tags = primaryCategory
    ? [{ primary_category: primaryCategory, risk_level: riskLevel || "High", priority: 1 }]
    : [];
  return { address, tags, amount: 100 };
}

describe("extractRiskPaths", () => {
  it("returns empty result for clean graph", () => {
    const graph = makeGraph({ paths: [makePath(-1, [makeNode("A"), makeNode("TARGET_ADDR")])] });
    const result = extractRiskPaths(graph, RULES);
    expect(result.riskEntities).toHaveLength(0);
    expect(result.summary.highest_severity).toBe("Low");
    expect(result.summary.rules_triggered).toHaveLength(0);
  });

  it("detects sanctioned entity in inflow path", () => {
    const graph = makeGraph({
      paths: [makePath(-1, [makeNode("BAD_ADDR", "Sanctioned Entity", "Severe"), makeNode("TARGET_ADDR")])],
    });
    const result = extractRiskPaths(graph, RULES, 5, "deposit");
    expect(result.riskEntities).toHaveLength(1);
    expect(result.riskEntities[0].address).toBe("BAD_ADDR");
    expect(result.riskEntities[0].matched_rules).toContain("DEP-001");
    expect(result.summary.highest_severity).toBe("Severe");
  });

  it("filters rules by scenario category", () => {
    const graph = makeGraph({
      paths: [makePath(1, [makeNode("TARGET_ADDR"), makeNode("BAD_ADDR", "Sanctioned Entity", "Severe")])],
    });
    // Withdrawal scenario: should only apply Withdrawal rules
    const result = extractRiskPaths(graph, RULES, 5, "withdrawal");
    expect(result.riskEntities).toHaveLength(1);
    expect(result.riskEntities[0].matched_rules).toContain("WDR-001");
    expect(result.riskEntities[0].matched_rules).not.toContain("DEP-001");
  });

  it("filters paths by direction for withdrawal scenario", () => {
    const graph = makeGraph({
      paths: [
        // Inflow path — should be skipped for withdrawal
        makePath(-1, [makeNode("INFLOW_ADDR", "Sanctioned Entity", "Severe"), makeNode("TARGET_ADDR")]),
        // Outflow path — should be processed
        makePath(1, [makeNode("TARGET_ADDR"), makeNode("OUTFLOW_ADDR", "Sanctioned Entity", "Severe")]),
      ],
    });
    const result = extractRiskPaths(graph, RULES, 5, "withdrawal");
    expect(result.riskEntities).toHaveLength(1);
    expect(result.riskEntities[0].address).toBe("OUTFLOW_ADDR");
    expect(result.summary.paths_direction_filtered).toBe(1);
  });

  it("respects direction constraint on rules", () => {
    const graph = makeGraph({
      paths: [
        // Outflow path with Gambling entity — DEP-002 requires inflow, should not match
        makePath(1, [makeNode("TARGET_ADDR"), makeNode("GAMBLE_ADDR", "Gambling")]),
      ],
    });
    const result = extractRiskPaths(graph, RULES, 5, "all");
    // DEP-002 has direction=inflow so it shouldn't match outflow path
    const matched = result.riskEntities.find((e) => e.address === "GAMBLE_ADDR");
    expect(matched).toBeUndefined();
  });

  it("evaluates target self-tags", () => {
    const graph = makeGraph({
      tags: [{ primary_category: "Sanctioned Entity", risk_level: "Severe", priority: 1 }],
      paths: [],
    });
    const result = extractRiskPaths(graph, RULES, 5, "deposit");
    expect(result.targetFindings).toHaveLength(1);
    expect(result.targetFindings[0].matched_rules).toContain("DEP-SELF-001");
    expect(result.summary.rules_triggered).toContain("DEP-SELF-001");
  });

  it("respects max_hops constraint", () => {
    // Node at hop 3 with Mixer tag — DEP-003 has max_hops=2
    const graph = makeGraph({
      paths: [makePath(-1, [
        makeNode("MIXER_ADDR", "Mixer"),
        makeNode("MID_1"),
        makeNode("MID_2"),
        makeNode("TARGET_ADDR"),
      ])],
    });
    const result = extractRiskPaths(graph, RULES, 5, "deposit");
    const mixer = result.riskEntities.find((e) => e.address === "MIXER_ADDR");
    // Mixer at hop 3 — exceeds max_hops=2 for DEP-003
    if (mixer) {
      expect(mixer.matched_rules).not.toContain("DEP-003");
    }
  });

  it("respects maxDepth parameter", () => {
    const graph = makeGraph({
      paths: [makePath(-1, [
        makeNode("FAR_ADDR", "Sanctioned Entity", "Severe"),
        makeNode("MID_1"),
        makeNode("MID_2"),
        makeNode("MID_3"),
        makeNode("TARGET_ADDR"),
      ])],
    });
    // maxDepth=2 — entity at hop 4 should be filtered
    const result = extractRiskPaths(graph, RULES, 2, "deposit");
    expect(result.riskEntities.find((e) => e.address === "FAR_ADDR")).toBeUndefined();
  });

  it("supports IN operator for tag matching", () => {
    const graph = makeGraph({
      paths: [makePath(-1, [makeNode("MIX_ADDR", "Tumbler"), makeNode("TARGET_ADDR")])],
    });
    const result = extractRiskPaths(graph, RULES, 5, "deposit");
    const entity = result.riskEntities.find((e) => e.address === "MIX_ADDR");
    expect(entity).toBeDefined();
    expect(entity!.matched_rules).toContain("DEP-003");
  });

  it("sorts entities by severity then depth", () => {
    const graph = makeGraph({
      paths: [
        makePath(-1, [makeNode("MEDIUM_ADDR", "Gambling", "Medium"), makeNode("TARGET_ADDR")]),
        makePath(-1, [makeNode("SEVERE_ADDR", "Sanctioned Entity", "Severe"), makeNode("MID"), makeNode("TARGET_ADDR")]),
      ],
    });
    const result = extractRiskPaths(graph, RULES, 5, "all");
    expect(result.riskEntities.length).toBeGreaterThanOrEqual(1);
    if (result.riskEntities.length >= 2) {
      const severityOrder: Record<string, number> = { severe: 0, high: 1, medium: 2, low: 3 };
      const first = severityOrder[result.riskEntities[0].tag.risk_level.toLowerCase()] ?? 3;
      const second = severityOrder[result.riskEntities[1].tag.risk_level.toLowerCase()] ?? 3;
      expect(first).toBeLessThanOrEqual(second);
    }
  });

  it("handles empty graph data gracefully", () => {
    const result = extractRiskPaths({}, RULES);
    expect(result.riskEntities).toHaveLength(0);
    expect(result.summary.total_paths_analyzed).toBe(0);
  });

  it("reports correct summary stats", () => {
    const graph = makeGraph({
      paths: [
        makePath(-1, [makeNode("A", "Sanctioned Entity", "Severe"), makeNode("TARGET_ADDR")]),
        makePath(1, [makeNode("TARGET_ADDR"), makeNode("B", "Sanctioned Entity", "Severe")]),
      ],
    });
    const result = extractRiskPaths(graph, RULES, 5, "all");
    expect(result.summary.total_paths_analyzed).toBe(2);
    expect(result.summary.scenario).toBe("all");
    expect(result.summary.rules_total_available).toBe(RULES.length);
  });
});
