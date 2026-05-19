# FlowGraph Cluster Aggregation — Design

## Problem

The screening detail page renders a React Flow graph of risk evidence. On real cases (e.g. history `3b7e0225`) the graph has 163 nodes / 163 edges, with the bulk being risk-source addresses that share the same tag and the same downstream target. Dagre's LR layout degenerates into a tall vertical waterfall that's effectively unreadable.

In the sampled case, 84 risk entities collapse to 5 distinct quaternary tags:

| tag                                   | count |
| ------------------------------------- | ----- |
| `blacklisted-address`                 | 76    |
| `us-ofac-sanctions-garantex-deposit`  | 4     |
| `us-ofac-sanctions-grinex.io-hotwallet` | 2   |
| `kraken-deposit`                      | 1     |
| `sportsbet.io-deposit`                | 1     |

The vast majority of nodes are redundant from a user's perspective — 76 blacklisted addresses funnelling into the same intermediate carry one piece of information ("76 blacklisted sources, one funnel"), not 76.

## Goal

Aggregate same-kind risk-source nodes into a single visual cluster so the graph's skeleton is legible at a glance, while preserving the ability to drill into the individual members on demand.

## Non-Goals

- No new aggregation for intermediates or the target node.
- No layout-algorithm swap; we keep dagre LR.
- No filter / threshold UI in this iteration. Threshold is hard-coded.
- No inline "explode cluster into nodes" interaction.

## Aggregation Rule

Implemented in `lib/parse-evidence-flow.ts`, applied after `buildGraphData` constructs the raw node/edge maps.

- **Scope** — only nodes with `isRiskSource === true` and exactly one outgoing edge are eligible. Target, intermediates, and risk-sources with multiple outgoing edges are skipped.
- **Key** — `(primary quaternary_category tag, single outgoing edge target id)`. A node with no `quaternary_category` falls back to `primary_category`; if neither exists it is not eligible.
- **Threshold** — only groups with `≥ 3` members are aggregated. Smaller groups stay as individual nodes.
- **Effect** — for each qualifying group:
  - Replace the member nodes with one synthesized `cluster` node.
  - Replace the member's outgoing edges with a single edge from the cluster to the shared next hop, whose `amount` is the sum of member amounts (formatted via `formatEdgeAmount`).
  - Preserve every member's individual `address`, `hopDistance`, `matchedRules`, and per-edge `amount` inside `cluster.members[]` for the detail panel.

### Type changes (`lib/parse-evidence-flow.ts`)

```ts
export interface GraphNode {
  // existing fields...
  isCluster?: boolean;
  memberCount?: number;
  members?: ClusterMember[];
}

export interface ClusterMember {
  address: string;
  hopDistance?: number;
  matchedRules?: string[];
  amount?: string; // raw amount string, e.g. "258000 USD"
}
```

The cluster node itself sets:
- `id` = `cluster:<tag>:<nextHopId>`
- `address` = `""` (no real address; renderer handles this)
- `tags` = `[tag]`
- `riskLevel` = the highest risk level across members, using order `severe > high > medium > low`
- `isRiskSource` = `true`
- `isCluster` = `true`
- `memberCount` = N
- `members` = sorted by `hopDistance` ascending, then `address`
- `hopDistance` = min of members'

The aggregated edge sets `amount` to a synthesized `"<sum> USD"` string. Members' original amounts are kept inside `members[i].amount`.

## Rendering (`components/screening/FlowGraph.tsx`)

### Cluster node visual

In `FlowNode`, when `data.isCluster`:

- Render the same card body, but offset two pseudo-cards behind it (via `::before`/`::after` or two absolutely-positioned siblings) to convey a "stack".
- Replace the shortened address line with a label like `Cluster · {memberCount} addresses`.
- Show the tag chip as today.
- Show a `× N` badge in the top-right (replacing the risk dot's position; the existing risk dot is suppressed for clusters since the tag chip already carries that info).
- Keep the matched-rules line, but show `Σ <total rules across members>` (unique count).

The Dagre size estimate for cluster nodes uses the same width but +14px height to account for the stack offset.

### DetailPanel cluster mode

When `data.isCluster`, the panel renders:

- Header: `Cluster · <tag> · <N> addresses`
- A scrollable list (max-height 280px) of members, each row:
  - shortened address (monospace) + copy icon
  - hop distance pill
  - per-member amount (formatted)
  - matched rules chips
- Total amount summary at the bottom.

Non-cluster nodes keep the current rendering.

## Tests

Unit tests in `tests/unit/parse-evidence-flow.test.ts` (new file):

1. **aggregates ≥3 same-key risk sources** — given 3 nodes with tag `X` all pointing at hop `H`, expects 1 cluster node + 1 edge, members preserved with original amounts, summed edge amount.
2. **does not aggregate below threshold** — 2 same-key nodes stay as 2 separate nodes.
3. **does not aggregate when outgoing edges differ** — 3 nodes with tag `X` pointing at different targets stay as 3 separate nodes.
4. **does not aggregate non-risk-source nodes** — target/intermediate with same shape are untouched.

## Files Touched

| File | Change |
| ---- | ------ |
| `lib/parse-evidence-flow.ts` | Extend `GraphNode`, add `ClusterMember`, add `aggregateRiskClusters()` step run inside (or after) `buildGraphData` |
| `components/screening/FlowGraph.tsx` | Cluster styling in `FlowNode`; cluster mode in `DetailPanel`; size estimate tweak in `applyDagreLayout` |
| `tests/unit/parse-evidence-flow.test.ts` | New file, 4 tests above |

## Risks

- **Edge amount summing accuracy** — non-USD amount strings (if any ever appear) won't sum cleanly. Mitigation: only sum entries that match the `^([\d.]+)\s*USD$` regex. If any member fails to parse, drop the `amount` on the aggregated edge (renderer simply shows no label) rather than printing a misleading total.
- **Member list explosion in DetailPanel** — 76-member cluster needs a scroll container with a sane max height (already specified).
- **Cluster of 1 due to filtering** — `< 3` threshold prevents this by construction.
