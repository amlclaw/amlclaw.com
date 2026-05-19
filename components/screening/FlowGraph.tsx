"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
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
  /** Blockchain identifier (e.g. "Tron", "Ethereum"). Used for tx lookup + explorer links. */
  chain?: string;
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
      {/* Top-right indicator: × N for clusters, risk dot otherwise */}
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

      {/* Address (or cluster summary) */}
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
          {isCluster
            ? `Σ ${matchedRules.length} unique rule${matchedRules.length !== 1 ? "s" : ""}`
            : `${matchedRules.length} rule${matchedRules.length !== 1 ? "s" : ""} matched`}
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
    let h = hasTags ? (hasMultipleTags ? 72 : 56) : 42;
    if (n.isCluster) h += 14; // account for stacked-card visual offset
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
        cursor: "pointer",
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
export default function FlowGraph({ entities, target, scenario, chain }: FlowGraphProps) {
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{ source: string; target: string; amount?: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Esc closes fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    // Prevent body scroll while fullscreen
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  const { nodes, edges } = useMemo(() => {
    const { nodes: gn, edges: ge } = buildGraphData(entities, target);
    if (gn.length === 0) return { nodes: [] as Node[], edges: [] as Edge[] };
    return applyDagreLayout(gn, ge);
  }, [entities, target]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as Record<string, unknown>;
    setSelectedEdge(null);
    setSelected((prev) => (prev && prev.address === d.address) ? null : d);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    // Skip cluster edges — they aggregate N member edges and don't map to a
    // single tx list. User should drill into a cluster member instead.
    if (edge.source.startsWith("cluster:") || edge.target.startsWith("cluster:")) {
      setSelectedEdge({
        source: edge.source,
        target: edge.target,
        amount: typeof edge.label === "string" ? edge.label : undefined,
      });
      return;
    }
    setSelected(null);
    setSelectedEdge((prev) =>
      prev && prev.source === edge.source && prev.target === edge.target
        ? null
        : {
            source: edge.source,
            target: edge.target,
            amount: typeof edge.label === "string" ? edge.label : undefined,
          },
    );
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="flow-graph-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#636370", fontSize: "0.833rem" }}>
        No graph data available
      </div>
    );
  }

  const containerStyle: React.CSSProperties = isFullscreen
    ? {
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1000,
        background: "#06060f",
      }
    : { position: "relative" };

  return (
    <div className={isFullscreen ? undefined : "flow-graph-container"} style={containerStyle}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={() => { setSelected(null); setSelectedEdge(null); }}
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

      {/* Top-right cluster of badges */}
      <div style={{
        position: "absolute", top: 12, right: 12,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{
          fontSize: "0.6rem", color: "#636370",
          background: "#0f0f12", border: "1px solid #1e1e24",
          padding: "3px 8px", borderRadius: 4,
        }}>
          {nodes.length} nodes &middot; {edges.length} edges
        </div>
        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26,
            background: "#0f0f12", border: "1px solid #1e1e24",
            borderRadius: 4, color: "#a0a0ab", cursor: "pointer",
            padding: 0,
          }}
        >
          {isFullscreen ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V3h4" />
              <path d="M21 7V3h-4" />
              <path d="M3 17v4h4" />
              <path d="M21 17v4h-4" />
            </svg>
          )}
        </button>
      </div>

      {/* Node detail panel */}
      {selected && <DetailPanel data={selected} onClose={() => setSelected(null)} />}

      {/* Edge tx panel */}
      {selectedEdge && (
        <EdgePanel
          chain={chain ?? "Tron"}
          from={selectedEdge.source}
          to={selectedEdge.target}
          amountLabel={selectedEdge.amount}
          onClose={() => setSelectedEdge(null)}
        />
      )}
    </div>
  );
}

/* ─── Detail Panel (typed to avoid unknown-as-ReactNode) ─── */
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

/* ─── Edge Tx Panel ─── */
interface EdgeTx {
  tx_id: string;
  block_number: number;
  block_timestamp: number;
  amount_usd: number;
  amount_raw: string;
  explorer_url: string | null;
}

function EdgePanel({
  chain, from, to, amountLabel, onClose,
}: {
  chain: string;
  from: string;
  to: string;
  amountLabel?: string;
  onClose: () => void;
}) {
  const isClusterEdge = from.startsWith("cluster:") || to.startsWith("cluster:");

  const [items, setItems] = useState<EdgeTx[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset state when the edge identity changes.
  useEffect(() => {
    setItems([]);
    setTotal(0);
    setPage(1);
    setErr(null);
  }, [from, to]);

  // Fetch a page of tx records.
  useEffect(() => {
    if (isClusterEdge) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);

    const url = `/api/screening/edge-txs?chain=${encodeURIComponent(chain)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&page_size=20`;
    fetch(url)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.detail || `HTTP ${r.status}`);
        return body as { items: EdgeTx[]; total: number };
      })
      .then((body) => {
        if (cancelled) return;
        setItems((prev) => (page === 1 ? body.items : [...prev, ...body.items]));
        setTotal(body.total ?? 0);
      })
      .catch((e: Error) => { if (!cancelled) setErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [chain, from, to, page, isClusterEdge]);

  const fmtTs = (ts: number) => {
    if (!ts) return "—";
    try { return new Date(ts).toISOString().slice(0, 19).replace("T", " "); }
    catch { return String(ts); }
  };
  const fmtUsd = (n: number) => {
    if (!Number.isFinite(n)) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };
  const shortHash = (h: string) => h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h;

  return (
    <div style={{
      position: "absolute", bottom: 12, right: 12,
      background: "#0f0f12", border: "1px solid #2a2a32", borderRadius: 8,
      padding: "12px 16px", width: 380, fontSize: "0.694rem",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ color: "#f0f0f3", fontSize: "0.694rem" }}>Edge Transactions</strong>
        <button onClick={onClose} style={{
          background: "none", border: "1px solid #2a2a32", borderRadius: 4,
          color: "#636370", width: 20, height: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem",
        }}>&times;</button>
      </div>

      {/* From → To summary */}
      <div style={{ fontSize: "0.6rem", lineHeight: 1.6, color: "#a0a0ab", marginBottom: 6 }}>
        <div style={{ color: "#636370" }}>FROM</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>{from}</div>
        <div style={{ color: "#636370", marginTop: 4 }}>TO</div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>{to}</div>
        {amountLabel && (
          <div style={{ color: "#636370", marginTop: 4 }}>
            Aggregate amount: <span style={{ color: "#a0a0ab" }}>{amountLabel}</span>
          </div>
        )}
      </div>

      {isClusterEdge && (
        <div style={{
          padding: "8px 10px",
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 4,
          color: "#818cf8",
          fontSize: "0.6rem",
          lineHeight: 1.5,
        }}>
          This edge is an aggregation of multiple member edges. Click the cluster node to open the member list, then click any individual member to inspect its txs.
        </div>
      )}

      {!isClusterEdge && (
        <>
          {err && (
            <div style={{ color: "#f87171", fontSize: "0.6rem", marginTop: 6 }}>{err}</div>
          )}

          <div style={{ marginTop: 6, maxHeight: 280, overflowY: "auto", border: "1px solid #1e1e24", borderRadius: 4, background: "#0a0a0e" }}>
            {items.length === 0 && !loading && !err && (
              <div style={{ padding: "10px 8px", color: "#636370", fontSize: "0.6rem", textAlign: "center" }}>No transactions in window.</div>
            )}
            {items.map((tx, idx) => (
              <div key={tx.tx_id || idx} style={{
                padding: "6px 8px",
                borderBottom: idx === items.length - 1 ? "none" : "1px solid #15151a",
                fontSize: "0.6rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#a0a0ab", flex: 1 }}>{shortHash(tx.tx_id)}</code>
                  {tx.explorer_url && (
                    <a href={tx.explorer_url} target="_blank" rel="noreferrer" title="View on explorer"
                      style={{ color: "#818cf8", textDecoration: "none", display: "inline-flex" }}>
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 3, color: "#636370" }}>
                  <span>{fmtTs(tx.block_timestamp)}</span>
                  <span style={{ color: "#a0a0ab" }}>{fmtUsd(tx.amount_usd)}</span>
                  <span>blk #{tx.block_number}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#636370", fontSize: "0.55rem" }}>
            <span>{items.length} / {total} shown</span>
            {items.length < total && (
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                style={{
                  background: "#141418", border: "1px solid #2a2a32",
                  borderRadius: 3, color: "#a0a0ab",
                  padding: "3px 8px", fontSize: "0.55rem",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
