"use client";

import { useRef, useEffect, useCallback, useState } from "react";

export interface GraphNode {
  id: string;
  label: string;
  type: "entity" | "exchange" | "defi" | "unknown" | "risk";
  risk?: "low" | "medium" | "high" | "severe";
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
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

const NODE_COLORS: Record<string, string> = {
  entity: "#00f0ff",
  exchange: "#818cf8",
  defi: "#34d399",
  unknown: "#6b7280",
  risk: "#f87171",
};

const RISK_GLOW: Record<string, string> = {
  severe: "rgba(248,113,113,0.6)",
  high: "rgba(248,113,113,0.3)",
  medium: "rgba(251,191,36,0.2)",
  low: "transparent",
};

export default function ForceGraph({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<(GraphNode & { x: number; y: number; vx: number; vy: number })[]>([]);
  const edgesRef = useRef<GraphEdge[]>(edges);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<{ edge: number; progress: number; speed: number }[]>([]);
  const timeRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const w = Math.floor(width);
      const h = Math.floor(height);
      if (w > 0 && h > 0) {
        sizeRef.current = { w, h };
        if (!ready) {
          // First valid size — initialize nodes
          const cx = w / 2;
          const cy = h / 2;
          nodesRef.current = nodes.map((n) => ({
            ...n,
            x: cx + (Math.random() - 0.5) * w * 0.6,
            y: cy + (Math.random() - 0.5) * h * 0.6,
            vx: 0,
            vy: 0,
          }));
          edgesRef.current = edges;
          particlesRef.current = edges.flatMap((_, i) =>
            Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => ({
              edge: i,
              progress: Math.random(),
              speed: 0.002 + Math.random() * 0.003,
            }))
          );
          setReady(true);
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [nodes, edges, ready]);

  const tick = useCallback(() => {
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    const ns = nodesRef.current;
    const es = edgesRef.current;
    const cx = w / 2;
    const cy = h / 2;

    // Forces
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      a.vx += (cx - a.x) * 0.0003;
      a.vy += (cy - a.y) * 0.0003;
      for (let j = i + 1; j < ns.length; j++) {
        const b = ns[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 800 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
    }

    for (const e of es) {
      const a = ns.find((n) => n.id === e.source);
      const b = ns.find((n) => n.id === e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 150) * 0.0005;
      a.vx += (dx / dist) * force;
      a.vy += (dy / dist) * force;
      b.vx -= (dx / dist) * force;
      b.vy -= (dy / dist) * force;
    }

    for (const n of ns) {
      n.vx *= 0.92;
      n.vy *= 0.92;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(50, Math.min(w - 50, n.x));
      n.y = Math.max(50, Math.min(h - 50, n.y));
    }

    for (const p of particlesRef.current) {
      p.progress += p.speed;
      if (p.progress > 1) p.progress -= 1;
    }
  }, []);

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
    const ns = nodesRef.current;
    const es = edgesRef.current;

    // Edges
    for (const e of es) {
      const a = ns.find((n) => n.id === e.source);
      const b = ns.find((n) => n.id === e.target);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = e.risk ? "rgba(248,113,113,0.15)" : "rgba(0,240,255,0.08)";
      ctx.lineWidth = Math.min(3, 0.5 + Math.log10(e.amount + 1) * 0.5);
      ctx.stroke();
    }

    // Particles
    for (const p of particlesRef.current) {
      const e = es[p.edge];
      if (!e) continue;
      const a = ns.find((n) => n.id === e.source);
      const b = ns.find((n) => n.id === e.target);
      if (!a || !b) continue;
      const x = a.x + (b.x - a.x) * p.progress;
      const y = a.y + (b.y - a.y) * p.progress;
      const alpha = Math.sin(p.progress * Math.PI);
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = e.risk ? `rgba(248,113,113,${alpha * 0.8})` : `rgba(0,240,255,${alpha * 0.6})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = e.risk ? `rgba(248,113,113,${alpha * 0.3})` : `rgba(0,240,255,${alpha * 0.2})`;
      ctx.fill();
    }

    // Nodes
    for (const n of ns) {
      const color = NODE_COLORS[n.type] || NODE_COLORS.unknown;
      const radius = n.type === "entity" ? 10 : 6;
      const glow = RISK_GLOW[n.risk || "low"];

      if (n.risk === "severe" || n.risk === "high") {
        const pulse = 0.5 + 0.5 * Math.sin(timeRef.current * 3);
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 8 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius - 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "9px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(n.label, n.x, n.y + radius + 12);
    }
  }, []);

  // Animation loop
  useEffect(() => {
    if (!ready) return;
    const loop = () => {
      tick();
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [ready, tick, draw]);

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <canvas ref={canvasRef} style={{ display: "block", position: "absolute", inset: 0 }} />
    </div>
  );
}
