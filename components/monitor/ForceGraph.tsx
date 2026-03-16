"use client";

import { useRef, useEffect, useCallback } from "react";

export interface GraphNode {
  id: string;
  label: string;
  type: "entity" | "exchange" | "defi" | "unknown" | "risk";
  risk?: "low" | "medium" | "high" | "severe";
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  pinned?: boolean;
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
  width: number;
  height: number;
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
  low: "rgba(52,211,153,0.1)",
};

export default function ForceGraph({ nodes, edges, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<{ edge: number; progress: number; speed: number }[]>([]);
  const timeRef = useRef(0);

  // Initialize positions
  useEffect(() => {
    const cx = width / 2;
    const cy = height / 2;
    nodesRef.current = nodes.map((n, i) => ({
      ...n,
      x: n.x ?? cx + (Math.random() - 0.5) * width * 0.6,
      y: n.y ?? cy + (Math.random() - 0.5) * height * 0.6,
      vx: 0,
      vy: 0,
    }));
    edgesRef.current = edges;

    // Spawn particles for each edge
    particlesRef.current = edges.flatMap((_, i) => {
      const count = 1 + Math.floor(Math.random() * 2);
      return Array.from({ length: count }, () => ({
        edge: i,
        progress: Math.random(),
        speed: 0.002 + Math.random() * 0.003,
      }));
    });
  }, [nodes, edges, width, height]);

  const simulate = useCallback(() => {
    const ns = nodesRef.current;
    const es = edgesRef.current;
    if (ns.length === 0) return;

    const cx = width / 2;
    const cy = height / 2;

    // Force simulation
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      if (a.pinned) continue;

      // Center gravity
      a.vx! += (cx - a.x!) * 0.0003;
      a.vy! += (cy - a.y!) * 0.0003;

      // Repulsion between nodes
      for (let j = i + 1; j < ns.length; j++) {
        const b = ns[j];
        const dx = a.x! - b.x!;
        const dy = a.y! - b.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 800 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!a.pinned) { a.vx! += fx; a.vy! += fy; }
        if (!b.pinned) { b.vx! -= fx; b.vy! -= fy; }
      }
    }

    // Edge attraction
    for (const e of es) {
      const a = ns.find((n) => n.id === e.source);
      const b = ns.find((n) => n.id === e.target);
      if (!a || !b) continue;
      const dx = b.x! - a.x!;
      const dy = b.y! - a.y!;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 150) * 0.0005;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      if (!a.pinned) { a.vx! += fx; a.vy! += fy; }
      if (!b.pinned) { b.vx! -= fx; b.vy! -= fy; }
    }

    // Update positions with damping
    for (const n of ns) {
      if (n.pinned) continue;
      n.vx! *= 0.92;
      n.vy! *= 0.92;
      n.x! += n.vx!;
      n.y! += n.vy!;
      // Bounds
      n.x! = Math.max(40, Math.min(width - 40, n.x!));
      n.y! = Math.max(40, Math.min(height - 40, n.y!));
    }

    // Update particles
    for (const p of particlesRef.current) {
      p.progress += p.speed;
      if (p.progress > 1) p.progress -= 1;
    }
  }, [width, height]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ns = nodesRef.current;
    const es = edgesRef.current;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    timeRef.current += 0.016;

    // Draw edges
    for (const e of es) {
      const a = ns.find((n) => n.id === e.source);
      const b = ns.find((n) => n.id === e.target);
      if (!a || !b) continue;

      ctx.beginPath();
      ctx.moveTo(a.x!, a.y!);
      ctx.lineTo(b.x!, b.y!);
      ctx.strokeStyle = e.risk ? "rgba(248,113,113,0.15)" : "rgba(0,240,255,0.08)";
      ctx.lineWidth = Math.min(3, 0.5 + Math.log10(e.amount + 1) * 0.5);
      ctx.stroke();
    }

    // Draw particles
    for (const p of particlesRef.current) {
      const e = es[p.edge];
      if (!e) continue;
      const a = ns.find((n) => n.id === e.source);
      const b = ns.find((n) => n.id === e.target);
      if (!a || !b) continue;

      const x = a.x! + (b.x! - a.x!) * p.progress;
      const y = a.y! + (b.y! - a.y!) * p.progress;
      const alpha = Math.sin(p.progress * Math.PI);
      const color = e.risk ? `rgba(248,113,113,${alpha * 0.8})` : `rgba(0,240,255,${alpha * 0.6})`;
      const glow = e.risk ? `rgba(248,113,113,${alpha * 0.3})` : `rgba(0,240,255,${alpha * 0.2})`;

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    // Draw nodes
    for (const n of ns) {
      const color = NODE_COLORS[n.type] || NODE_COLORS.unknown;
      const radius = n.type === "entity" ? 10 : 6;
      const glow = RISK_GLOW[n.risk || "low"] || "transparent";

      // Outer glow
      if (n.risk === "severe" || n.risk === "high") {
        const pulse = 0.5 + 0.5 * Math.sin(timeRef.current * 3);
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, radius + 8 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x!, n.y!, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Inner highlight
      ctx.beginPath();
      ctx.arc(n.x!, n.y!, radius - 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();

      // Label
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "9px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(n.label, n.x!, n.y! + radius + 12);
    }
  }, [width, height]);

  useEffect(() => {
    const loop = () => {
      simulate();
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [simulate, draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block" }}
    />
  );
}
