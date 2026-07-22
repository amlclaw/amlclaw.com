/**
 * Parse evidence flow strings and build graph data for React Flow visualization.
 * Flow direction: risk source (left) → intermediaries → target (right)
 */
import type { WidthHit, WidthTag } from "./width-api";

/**
 * Legacy risk-entity shape consumed by buildGraphData / FlowGraph / EntityCard.
 * V3 hits are adapted into this shape by hitsToEntities().
 */
export interface LegacyEntity {
  address: string;
  tag?: WidthTag;
  matched_rules: string[];
  matched_rules_detail: { rule_id: string; name: string; risk_level: string; action: string }[];
  min_deep: number;
  evidence_paths: { deep: number; flow: string }[];
}

/** Pick the most severe tag, preferring one whose primary_category matches. */
function pickTag(tags: WidthTag[], preferCategory?: string): WidthTag | undefined {
  if (!tags.length) return undefined;
  const order = ["critical", "severe", "high", "medium", "low"];
  const rank = (t: WidthTag) => {
    const i = order.indexOf(String(t.risk_level ?? "").toLowerCase());
    return i === -1 ? order.length : i;
  };
  const preferred = preferCategory
    ? tags.filter((t) => t.primary_category === preferCategory)
    : [];
  const pool = preferred.length ? preferred : tags;
  return [...pool].sort((a, b) => rank(a) - rank(b))[0];
}

/**
 * Build a legacy flow string from v3 pathNodes.
 * pathNodes are ordered opponent (deep 0) → target; node.amount is the edge
 * flowing into that node from the previous node in array order.
 * For outflow hits the display order is reversed (target → opponent) so the
 * arrow follows the money.
 */
function hitToFlowString(hit: WidthHit): string {
  const nodes = hit.pathNodes.length
    ? hit.pathNodes
    : [
        { address: hit.opponentAddress, amount: 0, deep: 0, tags: [] },
        { address: "", amount: hit.maxAmount, deep: hit.hops, tags: [] },
      ];

  // Edges between consecutive original nodes: amount lives on nodes[i+1]
  const parts: { address: string; tag?: string }[] = nodes.map((n) => {
    const t = pickTag(n.tags);
    const label = t?.quaternary_category || t?.primary_category;
    return { address: n.address, tag: label };
  });
  const amounts = nodes.slice(1).map((n) => n.amount);

  const ordered = hit.pathFlow === "outflow" ? [...parts].reverse() : parts;
  const orderedAmounts = hit.pathFlow === "outflow" ? [...amounts].reverse() : amounts;

  let out = "";
  ordered.forEach((p, i) => {
    out += p.tag ? `[${p.address} (${p.tag})]` : `[${p.address}]`;
    if (i < ordered.length - 1) {
      const amt = orderedAmounts[i];
      out += ` --(${amt ? `${amt} USD` : ""})--> `;
    }
  });
  return out;
}

/**
 * Adapt v3 screening hits into the legacy risk-entity list used by
 * FlowGraph/buildGraphData and the evidence list UI. Hits sharing the same
 * opponent address are merged into one entity.
 */
export function hitsToEntities(hits: WidthHit[]): LegacyEntity[] {
  const byOpponent = new Map<string, LegacyEntity>();

  for (const hit of hits) {
    const key = hit.opponentAddress || `${hit.ruleCode}:${hit.hops}`;
    const opponentNode = hit.pathNodes.find((n) => n.deep === 0) ?? hit.pathNodes[0];
    const tag = pickTag(opponentNode?.tags ?? [], hit.category);
    const flow = hitToFlowString(hit);

    const existing = byOpponent.get(key);
    if (!existing) {
      byOpponent.set(key, {
        address: hit.opponentAddress,
        tag: tag ?? { primary_category: hit.category, risk_level: hit.riskLevel },
        matched_rules: [hit.ruleCode],
        matched_rules_detail: [{
          rule_id: hit.ruleCode,
          name: hit.ruleName,
          risk_level: hit.riskLevel,
          action: hit.action,
        }],
        min_deep: hit.hops,
        evidence_paths: [{ deep: hit.hops, flow }],
      });
    } else {
      if (!existing.matched_rules.includes(hit.ruleCode)) {
        existing.matched_rules.push(hit.ruleCode);
        existing.matched_rules_detail.push({
          rule_id: hit.ruleCode,
          name: hit.ruleName,
          risk_level: hit.riskLevel,
          action: hit.action,
        });
      }
      existing.min_deep = Math.min(existing.min_deep, hit.hops);
      if (!existing.evidence_paths.some((p) => p.flow === flow)) {
        existing.evidence_paths.push({ deep: hit.hops, flow });
      }
    }
  }

  return Array.from(byOpponent.values());
}

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
