# FlowGraph Cluster Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse same-tag risk-source nodes that share one downstream target into a single visual cluster on the screening FlowGraph, so 100+ redundant nodes become legible at a glance.

**Architecture:** Pure data transform inside `lib/parse-evidence-flow.ts` runs after the node/edge maps are built. The transform groups eligible nodes by `(tag, single outgoing edge target)`, replaces groups of ≥3 with a synthesized cluster node, and rewrites their outgoing edges into one aggregated edge. The React Flow renderer learns a new `isCluster` flag and renders a stacked-card visual + a cluster member list in the existing DetailPanel.

**Tech Stack:** TypeScript, `@xyflow/react`, `@dagrejs/dagre`, vitest for unit tests.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `lib/parse-evidence-flow.ts` | Add `ClusterMember` type, extend `GraphNode` with cluster fields, add `aggregateRiskClusters()` helper, call it from `buildGraphData()` |
| `tests/unit/parse-evidence-flow.test.ts` | New file: 4 unit tests covering aggregation thresholds, key matching, and scope |
| `components/screening/FlowGraph.tsx` | Render cluster nodes with stacked-card visual + `× N` badge; add cluster mode to `DetailPanel`; bump cluster height in dagre size estimate |

---

### Task 1: Add types and write failing unit tests

**Files:**
- Modify: `lib/parse-evidence-flow.ts` (types only)
- Create: `tests/unit/parse-evidence-flow.test.ts`

- [ ] **Step 1: Extend the `GraphNode` interface and add `ClusterMember`**

Edit `lib/parse-evidence-flow.ts`. Find the `GraphNode` interface and append the new optional fields. Add the `ClusterMember` interface just below `GraphNode`.

```ts
export interface GraphNode {
  id: string;
  address: string;
  tags: string[];
  tagDetail?: {
    primary_category?: string;
    secondary_category?: string;
    tertiary_category?: string;
    quaternary_category?: string;
    risk_level?: string;
  };
  riskLevel?: string;
  isTarget?: boolean;
  isRiskSource?: boolean;
  matchedRules?: string[];
  hopDistance?: number;
  /** True when this node represents a collapsed group of same-kind risk sources. */
  isCluster?: boolean;
  /** Number of original risk-source nodes folded into this cluster. */
  memberCount?: number;
  /** Original member descriptors, ordered by hop distance asc, address asc. */
  members?: ClusterMember[];
}

export interface ClusterMember {
  address: string;
  hopDistance?: number;
  matchedRules?: string[];
  /** Raw outgoing-edge amount string for this member, e.g. "258000 USD". */
  amount?: string;
}
```

- [ ] **Step 2: Create the unit test file**

Create `tests/unit/parse-evidence-flow.test.ts` with the four tests below. They will fail because `buildGraphData` does not yet perform aggregation.

```ts
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
```

- [ ] **Step 3: Run tests, confirm all four fail**

Run: `npm run test:unit -- parse-evidence-flow`
Expected: 4 failing assertions in `parse-evidence-flow.test.ts`. The pre-existing test file `extract-risk-paths.test.ts` should still pass.

- [ ] **Step 4: Commit the failing tests + types**

```bash
git add lib/parse-evidence-flow.ts tests/unit/parse-evidence-flow.test.ts
git commit -m "test: add cluster aggregation tests + GraphNode cluster fields"
```

---

### Task 2: Implement `aggregateRiskClusters` and integrate into `buildGraphData`

**Files:**
- Modify: `lib/parse-evidence-flow.ts`

- [ ] **Step 1: Add the aggregation function**

Append below `buildGraphData` in `lib/parse-evidence-flow.ts`:

```ts
const RISK_ORDER = ["severe", "high", "medium", "low"];

function rankRisk(level: string | undefined): number {
  if (!level) return RISK_ORDER.length;
  const idx = RISK_ORDER.indexOf(level.toLowerCase());
  return idx === -1 ? RISK_ORDER.length : idx;
}

/**
 * Mutates `nodeMap` and `edgeMap` in place: any group of 3+ risk-source nodes
 * that share the same primary tag AND a single, identical outgoing edge target
 * is collapsed into one synthesized cluster node + one aggregated edge.
 */
function aggregateRiskClusters(
  nodeMap: Map<string, GraphNode>,
  edgeMap: Map<string, GraphEdge>,
): void {
  // Index outgoing edges by source node id.
  const outgoingByNode = new Map<string, GraphEdge[]>();
  for (const e of edgeMap.values()) {
    const arr = outgoingByNode.get(e.source) ?? [];
    arr.push(e);
    outgoingByNode.set(e.source, arr);
  }

  // Bucket eligible risk sources by (tag, nextHopId).
  const groups = new Map<string, { tag: string; nextHop: string; members: GraphNode[] }>();
  for (const node of nodeMap.values()) {
    if (!node.isRiskSource || node.isTarget) continue;
    const outs = outgoingByNode.get(node.id) ?? [];
    if (outs.length !== 1) continue;
    const tag = node.tags[0];
    if (!tag) continue;
    const nextHop = outs[0].target;
    const key = `${tag}|${nextHop}`;
    const bucket = groups.get(key);
    if (bucket) bucket.members.push(node);
    else groups.set(key, { tag, nextHop, members: [node] });
  }

  for (const { tag, nextHop, members } of groups.values()) {
    if (members.length < 3) continue;

    const sorted = [...members].sort((a, b) => {
      const da = a.hopDistance ?? 0;
      const db = b.hopDistance ?? 0;
      if (da !== db) return da - db;
      return a.address.localeCompare(b.address);
    });

    const memberInfos: ClusterMember[] = sorted.map((m) => ({
      address: m.address,
      hopDistance: m.hopDistance,
      matchedRules: m.matchedRules,
      amount: outgoingByNode.get(m.id)![0].amount,
    }));

    // Sum amounts only if every member parses as plain USD.
    let totalUsd = 0;
    let allParsed = true;
    for (const m of memberInfos) {
      if (!m.amount) { allParsed = false; break; }
      const match = m.amount.match(/^([\d.]+)\s*USD$/i);
      if (!match) { allParsed = false; break; }
      totalUsd += parseFloat(match[1]);
    }
    const aggregatedAmount = allParsed ? `${totalUsd} USD` : undefined;

    let bestRisk: string | undefined;
    for (const m of members) {
      const rl = m.riskLevel?.toLowerCase();
      if (!rl) continue;
      if (!bestRisk || rankRisk(rl) < rankRisk(bestRisk)) bestRisk = rl;
    }

    const rulesSet = new Set<string>();
    for (const m of members) for (const r of m.matchedRules ?? []) rulesSet.add(r);

    const hops = members.map((m) => m.hopDistance).filter((h): h is number => typeof h === "number");
    const minHop = hops.length ? Math.min(...hops) : undefined;

    const clusterId = `cluster:${tag}:${nextHop}`;
    const clusterNode: GraphNode = {
      id: clusterId,
      address: "",
      tags: [tag],
      riskLevel: bestRisk,
      isRiskSource: true,
      isCluster: true,
      memberCount: members.length,
      members: memberInfos,
      matchedRules: Array.from(rulesSet),
      hopDistance: minHop,
    };

    for (const m of members) {
      nodeMap.delete(m.id);
      for (const e of outgoingByNode.get(m.id) ?? []) edgeMap.delete(e.id);
    }
    nodeMap.set(clusterId, clusterNode);

    const aggregatedEdgeId = `${clusterId}->${nextHop}`;
    edgeMap.set(aggregatedEdgeId, {
      id: aggregatedEdgeId,
      source: clusterId,
      target: nextHop,
      amount: aggregatedAmount,
    });
  }
}
```

- [ ] **Step 2: Call `aggregateRiskClusters` from `buildGraphData`**

In `lib/parse-evidence-flow.ts`, find the `return` at the bottom of `buildGraphData`:

```ts
  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}
```

Replace with:

```ts
  aggregateRiskClusters(nodeMap, edgeMap);

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}
```

- [ ] **Step 3: Run tests, confirm all pass**

Run: `npm run test:unit -- parse-evidence-flow`
Expected: 4 tests pass. Also run `npm run test:unit` to confirm nothing else regressed.

- [ ] **Step 4: Commit**

```bash
git add lib/parse-evidence-flow.ts
git commit -m "feat(graph): aggregate same-tag risk sources into clusters"
```

---

### Task 3: Render cluster nodes with stacked-card visual

**Files:**
- Modify: `components/screening/FlowGraph.tsx`

- [ ] **Step 1: Update `FlowNode` to handle cluster nodes**

In `components/screening/FlowGraph.tsx`, find the start of `FlowNode` (around line 39) where it reads `data` fields. Add `isCluster` and `memberCount` extraction and a cluster-aware render branch. Replace the entire `FlowNode` function with:

```tsx
function FlowNode({ data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const riskLevel = (d.riskLevel as string) || "";
  const isTarget = Boolean(d.isTarget);
  const isRiskSource = Boolean(d.isRiskSource);
  const isCluster = Boolean(d.isCluster);
  const memberCount = typeof d.memberCount === "number" ? d.memberCount : 0;
  const address = (d.address as string) || "";
  const tags = (d.tags as string[]) || [];
  const matchedRules = (d.matchedRules as string[]) || [];
  const hasRisk = isRiskSource || riskLevel === "severe" || riskLevel === "high" || riskLevel === "medium";
  const dotColor = RISK_DOT[riskLevel] || (isTarget ? RISK_DOT.target : "");

  const card = (
    <div style={{
      background: "#0d0e12",
      border: "1px solid #1e1e24",
      borderRadius: 8,
      minWidth: 180,
      maxWidth: 260,
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      position: "relative",
    }}>
      {/* Top-right corner indicator: × N for clusters, risk dot otherwise */}
      {isCluster ? (
        <div style={{
          position: "absolute",
          top: -6,
          right: -6,
          minWidth: 24,
          height: 18,
          padding: "0 6px",
          borderRadius: 9,
          background: "#ef4444",
          color: "#fff",
          fontSize: "0.6rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 6px rgba(239,68,68,0.45)",
          border: "2px solid #0d0e12",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          ×{memberCount}
        </div>
      ) : (hasRisk || isTarget) && dotColor && (
        <div style={{
          position: "absolute",
          top: -4,
          right: -4,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: dotColor,
          border: "2px solid #0d0e12",
          boxShadow: `0 0 8px ${dotColor}60`,
        }} />
      )}

      {/* Tag labels */}
      {tags.length > 0 && (
        <div style={{
          padding: "6px 10px 4px",
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
        }}>
          {tags.map((t, i) => (
            <span key={i} style={{
              fontSize: "0.58rem",
              fontWeight: 600,
              padding: "1px 6px",
              borderRadius: 3,
              background: hasRisk ? "rgba(239,68,68,0.15)" : isTarget ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.06)",
              color: hasRisk ? "#f87171" : isTarget ? "#818cf8" : "#a0a0ab",
              lineHeight: "1.4",
              whiteSpace: "nowrap",
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Address line (or cluster summary) */}
      <div style={{
        padding: tags.length > 0 ? "2px 10px 6px" : "8px 10px",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.65rem",
          color: isTarget ? "#818cf8" : "#a0a0ab",
          fontWeight: isTarget ? 600 : 400,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}>
          {isCluster ? `${memberCount} addresses` : shortenAddr(address)}
        </span>

        {!isCluster && (
          <>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#636370" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#636370" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}>
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </>
        )}
      </div>

      {/* Matched rules count badge */}
      {matchedRules.length > 0 && (
        <div style={{
          padding: "3px 10px 5px",
          borderTop: "1px solid #1a1a1f",
          fontSize: "0.55rem",
          color: "#636370",
        }}>
          {isCluster ? `Σ ${matchedRules.length} unique rule${matchedRules.length !== 1 ? "s" : ""}` : `${matchedRules.length} rule${matchedRules.length !== 1 ? "s" : ""} matched`}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#2a2a32", border: "2px solid #3a3a44", width: 8, height: 8 }}
      />

      {isCluster ? (
        <div style={{ position: "relative" }}>
          {/* Stacked-card shadow layers */}
          <div style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: -8,
            bottom: -8,
            background: "#0a0a0e",
            border: "1px solid #1a1a1f",
            borderRadius: 8,
            zIndex: 0,
          }} />
          <div style={{
            position: "absolute",
            top: 4,
            left: 4,
            right: -4,
            bottom: -4,
            background: "#0c0c10",
            border: "1px solid #1c1c22",
            borderRadius: 8,
            zIndex: 1,
          }} />
          <div style={{ position: "relative", zIndex: 2 }}>{card}</div>
        </div>
      ) : card}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#2a2a32", border: "2px solid #3a3a44", width: 8, height: 8 }}
      />
    </>
  );
}
```

- [ ] **Step 2: Update dagre size estimate for clusters**

In `applyDagreLayout`, find the node-size loop:

```ts
  for (const n of graphNodes) {
    const hasMultipleTags = n.tags.length > 1;
    const hasTags = n.tags.length > 0;
    const w = 200;
    const h = hasTags ? (hasMultipleTags ? 72 : 56) : 42;
    g.setNode(n.id, { width: w, height: h });
  }
```

Replace with:

```ts
  for (const n of graphNodes) {
    const hasMultipleTags = n.tags.length > 1;
    const hasTags = n.tags.length > 0;
    const w = 200;
    let h = hasTags ? (hasMultipleTags ? 72 : 56) : 42;
    if (n.isCluster) h += 14; // account for stacked-card visual offset
    g.setNode(n.id, { width: w, height: h });
  }
```

- [ ] **Step 3: Commit**

```bash
git add components/screening/FlowGraph.tsx
git commit -m "feat(graph): render cluster nodes with stacked-card visual"
```

---

### Task 4: Render cluster details in `DetailPanel`

**Files:**
- Modify: `components/screening/FlowGraph.tsx`

- [ ] **Step 1: Replace `DetailPanel` with a cluster-aware version**

In `components/screening/FlowGraph.tsx`, replace the entire `DetailPanel` function with:

```tsx
function DetailPanel({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const isCluster = Boolean(data.isCluster);
  const address = String(data.address || "");
  const tags: string[] = Array.isArray(data.tags) ? (data.tags as string[]) : [];
  const matchedRules: string[] = Array.isArray(data.matchedRules) ? (data.matchedRules as string[]) : [];
  const tagDetail = (typeof data.tagDetail === "object" && data.tagDetail !== null) ? (data.tagDetail as Record<string, string>) : null;
  const hopDistance = typeof data.hopDistance === "number" ? data.hopDistance : null;
  const memberCount = typeof data.memberCount === "number" ? data.memberCount : 0;
  const members: Array<Record<string, unknown>> = Array.isArray(data.members) ? (data.members as Array<Record<string, unknown>>) : [];

  const nodeType = isCluster
    ? `Cluster · ${tags[0] || "untagged"} · ${memberCount} addresses`
    : data.isTarget ? "Target Node" : data.isRiskSource ? "Risk Source" : "Intermediary";

  return (
    <div style={{
      position: "absolute", bottom: 12, right: 12,
      background: "#0f0f12", border: "1px solid #2a2a32", borderRadius: 8,
      padding: "12px 16px", maxWidth: 360, fontSize: "0.694rem",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ color: "#f0f0f3", fontSize: "0.694rem" }}>{nodeType}</strong>
        <button onClick={onClose} style={{
          background: "none", border: "1px solid #2a2a32", borderRadius: 4,
          color: "#636370", width: 20, height: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem",
        }}>&times;</button>
      </div>

      {!isCluster && (
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", wordBreak: "break-all", color: "#a0a0ab", marginBottom: 6, lineHeight: 1.5 }}>
          {address}
        </div>
      )}

      {!isCluster && tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
          {tags.map((t, i) => (
            <span key={i} style={{
              fontSize: "0.55rem", fontWeight: 600, padding: "1px 5px", borderRadius: 3,
              background: "rgba(239,68,68,0.12)", color: "#f87171",
            }}>{t}</span>
          ))}
        </div>
      )}

      {!isCluster && tagDetail && (
        <div style={{ fontSize: "0.6rem", color: "#636370", lineHeight: 1.7 }}>
          {tagDetail.primary_category && <div>Category: <span style={{ color: "#a0a0ab" }}>{tagDetail.primary_category}</span></div>}
          {tagDetail.secondary_category && <div>Sub: <span style={{ color: "#a0a0ab" }}>{tagDetail.secondary_category}</span></div>}
          {tagDetail.risk_level && (
            <div>Risk: <span style={{ color: RISK_DOT[tagDetail.risk_level.toLowerCase()] || "#a0a0ab", fontWeight: 600 }}>
              {tagDetail.risk_level.toUpperCase()}
            </span></div>
          )}
        </div>
      )}

      {!isCluster && hopDistance !== null && (
        <div style={{ fontSize: "0.6rem", color: "#636370", marginTop: 4 }}>
          Hop Distance: <span style={{ color: "#a0a0ab", fontFamily: "'JetBrains Mono', monospace" }}>{hopDistance}</span>
        </div>
      )}

      {isCluster && (
        <div style={{
          maxHeight: 280, overflowY: "auto",
          border: "1px solid #1e1e24", borderRadius: 4,
          background: "#0a0a0e",
        }}>
          {members.map((m, idx) => {
            const memberAddr = String(m.address || "");
            const memberHop = typeof m.hopDistance === "number" ? m.hopDistance : null;
            const memberAmount = typeof m.amount === "string" ? m.amount : "";
            const memberRules: string[] = Array.isArray(m.matchedRules) ? (m.matchedRules as string[]) : [];
            return (
              <div key={memberAddr || idx} style={{
                padding: "6px 8px",
                borderBottom: idx === members.length - 1 ? "none" : "1px solid #15151a",
                fontSize: "0.6rem",
              }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", color: "#a0a0ab", wordBreak: "break-all" }}>
                  {memberAddr}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 3, color: "#636370" }}>
                  {memberHop !== null && <span>hop {memberHop}</span>}
                  {memberAmount && <span>{formatEdgeAmount(memberAmount)}</span>}
                  {memberRules.length > 0 && <span>{memberRules.length} rule{memberRules.length !== 1 ? "s" : ""}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {matchedRules.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e1e24" }}>
          <div style={{ fontSize: "0.55rem", color: "#636370", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>
            {isCluster ? "Unique Matched Rules" : "Matched Rules"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {matchedRules.map((r) => (
              <code key={r} style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: "0.55rem",
                background: "#141418", padding: "1px 5px", borderRadius: 2,
                border: "1px solid #2a2a32", color: "#a0a0ab",
              }}>{r}</code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Make sure `formatEdgeAmount` is imported**

Check the top of `components/screening/FlowGraph.tsx`. The existing import line already includes `formatEdgeAmount` — leave it as is:

```ts
import { buildGraphData, formatEdgeAmount, type GraphNode, type GraphEdge } from "@/lib/parse-evidence-flow";
```

If it is missing for any reason, add `formatEdgeAmount` to the named imports.

- [ ] **Step 3: Commit**

```bash
git add components/screening/FlowGraph.tsx
git commit -m "feat(graph): cluster mode in DetailPanel listing members"
```

---

### Task 5: Verify end-to-end in the browser and lint

**Files:**
- None modified; verification only.

- [ ] **Step 1: Run unit + lint + build**

Run:
```bash
npm run test:unit
npm run lint
npm run build
```
Expected: all green. Unit tests show the four new cases passing. `npm run build` should complete without TypeScript errors.

- [ ] **Step 2: Verify the screening page**

With dev server running (port 3000), navigate to the screening history detail that produced 163 nodes (the one shown in the screenshot — accessible from `/screening` history list, latest case).

Switch to the **Graph** view. Expected:
- The risk-source column collapses dramatically (76 blacklisted → 1 cluster, 4 garantex → 1 cluster, etc.).
- Cluster nodes show `× 76` (or similar) badge in the top-right.
- Stacked-card shadow visible behind each cluster.
- Top-right "X nodes · Y edges" badge reflects the new lower counts.
- Clicking a cluster opens the DetailPanel listing all member addresses with hop + amount; scroll if needed.
- Clicking a non-cluster node (target, intermediates, low-volume tags) still works as before.

If anything looks off (overlapping stack layers, wrong member counts, missing amounts), note it and revisit Task 2 / Task 3.

- [ ] **Step 3: Final commit (if any tweaks were needed)**

Only if Step 2 required changes:

```bash
git add -A
git commit -m "fix(graph): cluster rendering polish from manual verification"
```

---

## Self-Review Notes

- **Spec coverage:** Every spec section maps to a task — aggregation rule (Task 2), types (Task 1), cluster node visual (Task 3), DetailPanel cluster mode (Task 4), dagre size tweak (Task 3 step 2), the four unit tests (Task 1+2). The amount-summing edge case (drop on unparseable) is covered by test 4 in Task 1.
- **Placeholder scan:** No TBDs or hand-waving. Every code block is concrete.
- **Type consistency:** `ClusterMember` shape and `GraphNode` cluster fields stay identical from Task 1 through Task 4. `aggregateRiskClusters` mutates the same `nodeMap`/`edgeMap` types used by `buildGraphData`.
