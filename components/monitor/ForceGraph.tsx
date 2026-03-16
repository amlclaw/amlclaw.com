"use client";

import { useRef, useEffect, useCallback, useState } from "react";

export interface GraphNode {
  id: string;
  label: string;
  type: "entity" | "exchange" | "defi" | "unknown" | "risk";
  risk?: "low" | "medium" | "high" | "severe";
}

export interface GraphEdge {
  source: string;
  target: string;
  amount: number;
  token: string;
  timestamp: number;
  risk?: boolean;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

const NODE_COLORS: Record<string, string> = {
  entity: "#00f0ff",
  exchange: "#818cf8",
  defi: "#34d399",
  unknown: "#6b7280",
  risk: "#f87171",
};

/**
 * Fixed-layout network graph with flowing particle animations.
 * Entities in center ring, external nodes in outer ring. No physics — all positions fixed.
 */
export default function ForceGraph({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionsRef = useRef<PositionedNode[]>([]);
  const particlesRef = useRef<{ edge: number; progress: number; speed: number }[]>([]);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  // Layout nodes in fixed positions when container size is known
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const w = Math.floor(width);
      const h = Math.floor(height);
      if (w > 0 && h > 0) {
        sizeRef.current = { w, h };

        const cx = w / 2;
        const cy = h / 2;

        // Separate entities (center ring) from external nodes (outer ring)
        const entities = nodes.filter((n) => n.type === "entity");
        const externals = nodes.filter((n) => n.type !== "entity");

        const positioned: PositionedNode[] = [];

        // Use elliptical layout — rx based on width, ry based on height
        // This fills the wide rectangle properly
        const innerRx = w * 0.18;
        const innerRy = h * 0.28;
        entities.forEach((n, i) => {
          const angle = (i / entities.length) * Math.PI * 2 - Math.PI / 2;
          positioned.push({
            ...n,
            x: cx + Math.cos(angle) * innerRx,
            y: cy + Math.sin(angle) * innerRy,
          });
        });

        const outerRx = w * 0.38;
        const outerRy = h * 0.42;
        externals.forEach((n, i) => {
          const angle = (i / externals.length) * Math.PI * 2 - Math.PI / 2;
          positioned.push({
            ...n,
            x: cx + Math.cos(angle) * outerRx,
            y: cy + Math.sin(angle) * outerRy,
          });
        });

        positionsRef.current = positioned;

        // Create particles for each edge (2-4 per edge for busy look)
        particlesRef.current = edges.flatMap((_, i) =>
          Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => ({
            edge: i,
            progress: Math.random(),
            speed: 0.003 + Math.random() * 0.004,
          }))
        );

        if (!ready) setReady(true);
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [nodes, edges, ready]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    timeRef.current += 0.016;
    const ns = positionsRef.current;

    // Update particles
    for (const p of particlesRef.current) {
      p.progress += p.speed;
      if (p.progress > 1) p.progress -= 1;
    }

    // Draw edges (static lines)
    for (const e of edges) {
      const a = ns.find((n) => n.id === e.source);
      const b = ns.find((n) => n.id === e.target);
      if (!a || !b) continue;

      // Curved edges for visual distinction
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Curve control point — offset perpendicular to edge
      const nx = -dy / dist * dist * 0.08;
      const ny = dx / dist * dist * 0.08;
      const cpx = mx + nx;
      const cpy = my + ny;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
      ctx.strokeStyle = e.risk ? "rgba(248,113,113,0.12)" : "rgba(0,240,255,0.06)";
      ctx.lineWidth = Math.min(2.5, 0.5 + Math.log10(e.amount + 1) * 0.4);
      ctx.stroke();

      // Direction arrow at midpoint
      const t = 0.55;
      const arrowX = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cpx + t * t * b.x;
      const arrowY = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cpy + t * t * b.y;
      const tangentX = 2 * (1 - t) * (cpx - a.x) + 2 * t * (b.x - cpx);
      const tangentY = 2 * (1 - t) * (cpy - a.y) + 2 * t * (b.y - cpy);
      const angle = Math.atan2(tangentY, tangentX);
      const arrowSize = 4;

      ctx.beginPath();
      ctx.moveTo(arrowX + Math.cos(angle) * arrowSize, arrowY + Math.sin(angle) * arrowSize);
      ctx.lineTo(arrowX + Math.cos(angle + 2.5) * arrowSize, arrowY + Math.sin(angle + 2.5) * arrowSize);
      ctx.lineTo(arrowX + Math.cos(angle - 2.5) * arrowSize, arrowY + Math.sin(angle - 2.5) * arrowSize);
      ctx.closePath();
      ctx.fillStyle = e.risk ? "rgba(248,113,113,0.25)" : "rgba(0,240,255,0.15)";
      ctx.fill();
    }

    // Draw particles along curved edges
    for (const p of particlesRef.current) {
      const e = edges[p.edge];
      if (!e) continue;
      const a = ns.find((n) => n.id === e.source);
      const b = ns.find((n) => n.id === e.target);
      if (!a || !b) continue;

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / dist * dist * 0.08;
      const ny = dx / dist * dist * 0.08;
      const cpx = mx + nx;
      const cpy = my + ny;

      // Quadratic bezier position at t
      const t = p.progress;
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cpx + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cpy + t * t * b.y;
      const alpha = Math.sin(t * Math.PI); // fade in/out

      // Particle core
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = e.risk
        ? `rgba(248,113,113,${alpha * 0.9})`
        : `rgba(0,240,255,${alpha * 0.7})`;
      ctx.fill();

      // Particle glow
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = e.risk
        ? `rgba(248,113,113,${alpha * 0.15})`
        : `rgba(0,240,255,${alpha * 0.1})`;
      ctx.fill();

      // Trail (smaller dot behind)
      const t2 = Math.max(0, t - 0.04);
      const tx = (1 - t2) * (1 - t2) * a.x + 2 * (1 - t2) * t2 * cpx + t2 * t2 * b.x;
      const ty = (1 - t2) * (1 - t2) * a.y + 2 * (1 - t2) * t2 * cpy + t2 * t2 * b.y;
      ctx.beginPath();
      ctx.arc(tx, ty, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = e.risk
        ? `rgba(248,113,113,${alpha * 0.4})`
        : `rgba(0,240,255,${alpha * 0.3})`;
      ctx.fill();
    }

    // Draw nodes (fixed position)
    for (const n of ns) {
      const color = NODE_COLORS[n.type] || NODE_COLORS.unknown;
      const isEntity = n.type === "entity";
      const radius = isEntity ? 12 : 7;

      // Risk glow pulse
      if (n.risk === "severe" || n.risk === "high") {
        const pulse = 0.5 + 0.5 * Math.sin(timeRef.current * 3);
        const glowAlpha = n.risk === "severe" ? 0.4 + pulse * 0.3 : 0.2 + pulse * 0.15;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 10 + pulse * 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(248,113,113,${glowAlpha})`;
        ctx.fill();
      }

      // Entity outer ring
      if (isEntity) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}44`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Node body
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Inner highlight
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fill();

      // Label
      ctx.fillStyle = isEntity ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)";
      ctx.font = isEntity ? "bold 10px -apple-system, sans-serif" : "9px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(n.label, n.x, n.y + radius + 14);
    }

    // Center label
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = "rgba(0,240,255,0.08)";
    ctx.font = "bold 11px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MONITORED ENTITIES", cx, cy - 4);
    ctx.font = "9px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(0,240,255,0.05)";
    ctx.fillText("MAS Jurisdiction", cx, cy + 10);
  }, [edges]);

  // Animation loop — only particles move, nodes are static
  useEffect(() => {
    if (!ready) return;
    const loop = () => {
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [ready, draw]);

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <canvas ref={canvasRef} style={{ display: "block", position: "absolute", inset: 0 }} />
    </div>
  );
}
