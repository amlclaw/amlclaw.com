/**
 * Parse evidence flow strings and build graph data for React Flow visualization.
 * Flow direction: risk source (left) → intermediaries → target (right)
 */

export interface FlowStep {
  address: string;
  tag?: string;
  amount?: string;
}

export interface GraphNode {
  id: string;
  address: string;
  /** All tags from evidence (quaternary tag labels like "blacklisted-address") */
  tags: string[];
  /** Full tag object from the entity */
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
  /** Hop distance from target */
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

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** Amount with unit, e.g. "450000 USD" */
  amount?: string;
}

/**
 * Parse flow string: "[addr (tag)] --(amount)--> [addr (tag)]"
 * Returns steps in order: source → ... → target
 */
export function parseFlowString(flow: string): FlowStep[] {
  const steps: FlowStep[] = [];
  const nodePattern = /\[([^\]]+)\]/g;
  const edgePattern = /--\(([^)]*)\)-->/g;

  const nodes: { address: string; tag?: string }[] = [];
  let match;
  while ((match = nodePattern.exec(flow)) !== null) {
    const content = match[1].trim();
    // Match "addr (tag)" or just "addr"
    const tagMatch = content.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (tagMatch) {
      nodes.push({ address: tagMatch[1].trim(), tag: tagMatch[2].trim() });
    } else {
      nodes.push({ address: content });
    }
  }

  const amounts: string[] = [];
  while ((match = edgePattern.exec(flow)) !== null) {
    amounts.push(match[1].trim());
  }

  for (let i = 0; i < nodes.length; i++) {
    steps.push({
      address: nodes[i].address,
      tag: nodes[i].tag,
      amount: i < amounts.length ? amounts[i] : undefined,
    });
  }

  return steps;
}

/**
 * Format amount for edge labels: "450000 USD" → "$450,000"
 */
export function formatEdgeAmount(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/^([\d.]+)\s*USD$/i);
  if (m) {
    const num = parseFloat(m[1]);
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  }
  return raw;
}

/**
 * Build graph data from risk entities + target.
 * Risk sources appear on the left, target on the right.
 */
export function buildGraphData(
  entities: Record<string, unknown>[],
  target: Record<string, unknown>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();

  // Add target node
  const targetAddr = (target.address as string) || "";
  const targetTags = (target.tags as Record<string, unknown>[]) || [];
  if (targetAddr) {
    const tagLabels: string[] = [];
    for (const t of targetTags) {
      if (t.quaternary_category) tagLabels.push(String(t.quaternary_category));
      else if (t.primary_category) tagLabels.push(String(t.primary_category));
    }
    nodeMap.set(targetAddr, {
      id: targetAddr,
      address: targetAddr,
      tags: tagLabels,
      riskLevel: "target",
      isTarget: true,
      hopDistance: 0,
    });
  }

  // Process each risk entity
  for (const entity of entities) {
    const addr = (entity.address as string) || "";
    const tag = entity.tag as Record<string, unknown> | undefined;
    const matchedRules = (entity.matched_rules as string[]) || [];
    const evidencePaths = (entity.evidence_paths as Record<string, unknown>[]) || [];
    const riskLevel = tag?.risk_level ? String(tag.risk_level).toLowerCase() : "low";
    const minDeep = (entity.min_deep as number) || 1;

    // Collect tag labels
    const tagLabels: string[] = [];
    if (tag?.quaternary_category) tagLabels.push(String(tag.quaternary_category));
    if (tag?.primary_category && !tagLabels.length) tagLabels.push(String(tag.primary_category));

    // Add/update risk entity node
    if (addr) {
      const existing = nodeMap.get(addr);
      if (!existing) {
        nodeMap.set(addr, {
          id: addr,
          address: addr,
          tags: tagLabels,
          tagDetail: tag ? {
            primary_category: tag.primary_category as string,
            secondary_category: tag.secondary_category as string,
            tertiary_category: tag.tertiary_category as string,
            quaternary_category: tag.quaternary_category as string,
            risk_level: tag.risk_level as string,
          } : undefined,
          riskLevel,
          isRiskSource: true,
          matchedRules,
          hopDistance: minDeep,
        });
      } else {
        if (!existing.tags.length && tagLabels.length) existing.tags = tagLabels;
        if (!existing.riskLevel || existing.riskLevel === "low") existing.riskLevel = riskLevel;
        if (matchedRules.length) existing.matchedRules = [...(existing.matchedRules || []), ...matchedRules];
        existing.isRiskSource = true;
      }
    }

    // Parse evidence paths to build edges and intermediate nodes
    for (const ep of evidencePaths) {
      const flow = ep.flow as string;
      if (!flow) continue;

      const steps = parseFlowString(flow);
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        // Add intermediate node if not already present
        if (!nodeMap.has(step.address)) {
          nodeMap.set(step.address, {
            id: step.address,
            address: step.address,
            tags: step.tag ? [step.tag] : [],
            hopDistance: steps.length - 1 - i, // distance from target (last node)
          });
        } else {
          // Merge tags
          const ex = nodeMap.get(step.address)!;
          if (step.tag && !ex.tags.includes(step.tag)) {
            ex.tags.push(step.tag);
          }
        }

        // Add edge: step[i] → step[i+1]
        if (i < steps.length - 1) {
          const edgeId = `${step.address}->${steps[i + 1].address}`;
          if (!edgeMap.has(edgeId)) {
            edgeMap.set(edgeId, {
              id: edgeId,
              source: step.address,
              target: steps[i + 1].address,
              amount: step.amount,
            });
          }
        }
      }
    }
  }

  aggregateRiskClusters(nodeMap, edgeMap);

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

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
  const outgoingByNode = new Map<string, GraphEdge[]>();
  for (const e of edgeMap.values()) {
    const arr = outgoingByNode.get(e.source) ?? [];
    arr.push(e);
    outgoingByNode.set(e.source, arr);
  }

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
