import { describe, it, expect } from "vitest";
import { buildGraphData } from "@/lib/parse-evidence-flow";

const target = { address: "TARGET", tags: [] as Record<string, unknown>[] };

function makeEntity(
  address: string,
  tag: string,
  nextHop: string,
  amount: string,
  matchedRules: string[] = [],
) {
  return {
    address,
    min_deep: 1,
    tag: {
      primary_category: "Public Freezing Action",
      quaternary_category: tag,
      risk_level: "high",
    },
    matched_rules: matchedRules,
    evidence_paths: [
      { path_index: 0, deep: 1, flow: `[${address} (${tag})] --(${amount})--> [${nextHop} (intermediate)]` },
    ],
  };
}

describe("buildGraphData cluster aggregation", () => {
  it("aggregates 3+ same-tag risk sources sharing one next hop", () => {
    const entities = [
      makeEntity("A1", "blacklisted-address", "MID", "100 USD", ["R1"]),
      makeEntity("A2", "blacklisted-address", "MID", "200 USD", ["R1", "R2"]),
      makeEntity("A3", "blacklisted-address", "MID", "300 USD", ["R2"]),
    ];

    const { nodes, edges } = buildGraphData(entities, target);

    const cluster = nodes.find((n) => n.isCluster);
    expect(cluster).toBeDefined();
    expect(cluster!.memberCount).toBe(3);
    expect(cluster!.tags).toEqual(["blacklisted-address"]);
    expect(cluster!.members?.map((m) => m.address)).toEqual(["A1", "A2", "A3"]);
    expect(new Set(cluster!.matchedRules)).toEqual(new Set(["R1", "R2"]));

    // Original member nodes are gone
    expect(nodes.find((n) => n.id === "A1")).toBeUndefined();
    expect(nodes.find((n) => n.id === "A2")).toBeUndefined();
    expect(nodes.find((n) => n.id === "A3")).toBeUndefined();

    // One aggregated edge from cluster to MID with summed amount
    const outEdges = edges.filter((e) => e.source === cluster!.id);
    expect(outEdges).toHaveLength(1);
    expect(outEdges[0].target).toBe("MID");
    expect(outEdges[0].amount).toBe("600 USD");
  });

  it("does not aggregate when fewer than 3 nodes share the key", () => {
    const entities = [
      makeEntity("A1", "blacklisted-address", "MID", "100 USD"),
      makeEntity("A2", "blacklisted-address", "MID", "200 USD"),
    ];

    const { nodes } = buildGraphData(entities, target);

    expect(nodes.find((n) => n.isCluster)).toBeUndefined();
    expect(nodes.find((n) => n.id === "A1")).toBeDefined();
    expect(nodes.find((n) => n.id === "A2")).toBeDefined();
  });

  it("does not aggregate when next hops differ", () => {
    const entities = [
      makeEntity("A1", "blacklisted-address", "MID1", "100 USD"),
      makeEntity("A2", "blacklisted-address", "MID2", "200 USD"),
      makeEntity("A3", "blacklisted-address", "MID3", "300 USD"),
    ];

    const { nodes } = buildGraphData(entities, target);

    expect(nodes.find((n) => n.isCluster)).toBeUndefined();
    expect(nodes.filter((n) => n.isRiskSource && !n.isCluster)).toHaveLength(3);
  });

  it("drops the aggregated amount when a member amount is not parseable as USD", () => {
    const entities = [
      makeEntity("A1", "blacklisted-address", "MID", "100 USD"),
      makeEntity("A2", "blacklisted-address", "MID", "200 EUR"),
      makeEntity("A3", "blacklisted-address", "MID", "300 USD"),
    ];

    const { nodes, edges } = buildGraphData(entities, target);
    const cluster = nodes.find((n) => n.isCluster)!;
    const out = edges.find((e) => e.source === cluster.id)!;
    expect(out.amount).toBeUndefined();
    // Original amounts are preserved on members
    expect(cluster.members?.map((m) => m.amount)).toEqual(["100 USD", "200 EUR", "300 USD"]);
  });
});
