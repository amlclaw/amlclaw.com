"use client";

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { buildGraphData, formatEdgeAmount, type GraphNode, type GraphEdge } from "@/lib/parse-evidence-flow";
import { shortenAddr } from "@/lib/utils";

/* ─── Props ─── */
interface FlowGraphProps {
  entities: Record<string, unknown>[];
  target: Record<string, unknown>;
  scenario?: string;
}

/* ─── Risk Colors ─── */
const RISK_DOT: Record<string, string> = {
  severe: "#ef4444",
  high: "#ef4444",
  medium: "#f97316",
  low: "#22c55e",
  target: "#6366f1",
};

/* ─── Custom Node ─── */
function FlowNode({ data }: NodeProps) {
  const d = data as Record<string, unknown>;
  const riskLevel = (d.riskLevel as string) || "";
  const isTarget = Boolean(d.isTarget);
  const isRiskSource = Boolean(d.isRiskSource);
  const address = (d.address as string) || "";
  const tags = (d.tags as string[]) || [];
  const matchedRules = (d.matchedRules as string[]) || [];
  const hasRisk = isRiskSource || riskLevel === "severe" || riskLevel === "high" || riskLevel === "medium";
  const dotColor = RISK_DOT[riskLevel] || (isTarget ? RISK_DOT.target : "");

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#2a2a32", border: "2px solid #3a3a44", width: 8, height: 8 }}
      />

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
        {/* Risk dot indicator (top-right) */}
        {(hasRisk || isTarget) && dotColor && (
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

        {/* Address */}
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
            {shortenAddr(address)}
          </span>

          {/* Copy & link icons (decorative) */}
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#636370" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#636370" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}>
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </div>

        {/* Matched rules count badge */}
        {matchedRules.length > 0 && (
          <div style={{
            padding: "3px 10px 5px",
            borderTop: "1px solid #1a1a1f",
            fontSize: "0.55rem",
            color: "#636370",
          }}>
            {matchedRules.length} rule{matchedRules.length !== 1 ? "s" : ""} matched
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#2a2a32", border: "2px solid #3a3a44", width: 8, height: 8 }}
      />
    </>
  );
}

const nodeTypes = { flowNode: FlowNode };

/* ─── Dagre Layout ─── */
function applyDagreLayout(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",  // Left-to-right
    nodesep: 30,
    ranksep: 120,
    edgesep: 20,
    marginx: 40,
    marginy: 40,
  });

  // Estimate node sizes
  for (const n of graphNodes) {
    const hasMultipleTags = n.tags.length > 1;
    const hasTags = n.tags.length > 0;
    const w = 200;
    const h = hasTags ? (hasMultipleTags ? 72 : 56) : 42;
    g.setNode(n.id, { width: w, height: h });
  }

  for (const e of graphEdges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const nodes: Node[] = graphNodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "flowNode",
      position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 },
      data: {
        address: n.address,
        tags: n.tags,
        tagDetail: n.tagDetail,
        riskLevel: n.riskLevel,
        isTarget: n.isTarget,
        isRiskSource: n.isRiskSource,
        matchedRules: n.matchedRules,
        hopDistance: n.hopDistance,
      },
    };
  });

  const edges: Edge[] = graphEdges.map((e) => {
    const label = e.amount ? formatEdgeAmount(e.amount) : undefined;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label,
      type: "default",
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#3a3a44", width: 12, height: 12 },
      style: {
        stroke: "#2a2a32",
        strokeWidth: 1.5,
      },
      labelStyle: {
        fill: "#636370",
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: "#0d0e12",
        fillOpacity: 0.9,
      },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 3,
    };
  });

  return { nodes, edges };
}

/* ─── Main Component ─── */
export default function FlowGraph({ entities, target, scenario }: FlowGraphProps) {
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  const { nodes, edges } = useMemo(() => {
    const { nodes: gn, edges: ge } = buildGraphData(entities, target);
    if (gn.length === 0) return { nodes: [] as Node[], edges: [] as Edge[] };
    return applyDagreLayout(gn, ge);
  }, [entities, target]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as Record<string, unknown>;
    setSelected((prev) => (prev && prev.address === d.address) ? null : d);
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="flow-graph-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#636370", fontSize: "0.833rem" }}>
        No graph data available
      </div>
    );
  }

  return (
    <div className="flow-graph-container" style={{ position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelected(null)}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: false }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1a1a1f" gap={24} size={1} />
        <Controls
          showInteractive={false}
          position="bottom-left"
        />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as Record<string, unknown>;
            if (d.isTarget) return "#6366f1";
            const rl = (d.riskLevel as string) || "";
            return RISK_DOT[rl] || "#2a2a32";
          }}
          maskColor="rgba(9,9,11,0.7)"
          style={{ background: "#0f0f12", border: "1px solid #1e1e24", borderRadius: 6 }}
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Scenario badge */}
      {scenario && (
        <div style={{
          position: "absolute", top: 12, left: 12,
          fontSize: "0.65rem", fontWeight: 600, color: "#818cf8",
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
          padding: "3px 10px", borderRadius: 4,
        }}>
          {scenario.toUpperCase()} SCENARIO
        </div>
      )}

      {/* Node count badge */}
      <div style={{
        position: "absolute", top: 12, right: 12,
        fontSize: "0.6rem", color: "#636370",
        background: "#0f0f12", border: "1px solid #1e1e24",
        padding: "3px 8px", borderRadius: 4,
      }}>
        {nodes.length} nodes &middot; {edges.length} edges
      </div>

      {/* Detail panel */}
      {selected && <DetailPanel data={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ─── Detail Panel (typed to avoid unknown-as-ReactNode) ─── */
function DetailPanel({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const address = String(data.address || "");
  const tags: string[] = Array.isArray(data.tags) ? (data.tags as string[]) : [];
  const matchedRules: string[] = Array.isArray(data.matchedRules) ? (data.matchedRules as string[]) : [];
  const tagDetail = (typeof data.tagDetail === "object" && data.tagDetail !== null) ? (data.tagDetail as Record<string, string>) : null;
  const hopDistance = typeof data.hopDistance === "number" ? data.hopDistance : null;
  const nodeType = data.isTarget ? "Target Node" : data.isRiskSource ? "Risk Source" : "Intermediary";

  return (
    <div style={{
      position: "absolute", bottom: 12, right: 12,
      background: "#0f0f12", border: "1px solid #2a2a32", borderRadius: 8,
      padding: "12px 16px", maxWidth: 320, fontSize: "0.694rem",
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

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6rem", wordBreak: "break-all", color: "#a0a0ab", marginBottom: 6, lineHeight: 1.5 }}>
        {address}
      </div>

      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
          {tags.map((t, i) => (
            <span key={i} style={{
              fontSize: "0.55rem", fontWeight: 600, padding: "1px 5px", borderRadius: 3,
              background: "rgba(239,68,68,0.12)", color: "#f87171",
            }}>{t}</span>
          ))}
        </div>
      )}

      {tagDetail && (
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

      {hopDistance !== null && (
        <div style={{ fontSize: "0.6rem", color: "#636370", marginTop: 4 }}>
          Hop Distance: <span style={{ color: "#a0a0ab", fontFamily: "'JetBrains Mono', monospace" }}>{hopDistance}</span>
        </div>
      )}

      {matchedRules.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e1e24" }}>
          <div style={{ fontSize: "0.55rem", color: "#636370", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>
            Matched Rules
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
