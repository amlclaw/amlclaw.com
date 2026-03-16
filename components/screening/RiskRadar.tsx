"use client";

import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from "recharts";
import type { RiskDimensions } from "@/lib/risk-score";

interface RiskRadarProps {
  dimensions: RiskDimensions;
  total: number;
  level: string;
}

const LABELS: { key: keyof RiskDimensions; label: string }[] = [
  { key: "sanctions", label: "Sanctions" },
  { key: "illicit", label: "Illicit" },
  { key: "mixer", label: "Mixer" },
  { key: "proximity", label: "Proximity" },
  { key: "breadth", label: "Breadth" },
  { key: "selfRisk", label: "Self Risk" },
];

function getColor(total: number): string {
  if (total > 80) return "#ef4444";
  if (total > 60) return "#f97316";
  if (total > 40) return "#f59e0b";
  return "#10b981";
}

const levelColors: Record<string, { bg: string; color: string; border: string }> = {
  severe: { bg: "rgba(239,68,68,0.15)", color: "var(--risk-severe)", border: "rgba(239,68,68,0.3)" },
  high: { bg: "rgba(249,115,22,0.15)", color: "var(--risk-high)", border: "rgba(249,115,22,0.3)" },
  medium: { bg: "rgba(234,179,8,0.15)", color: "var(--risk-medium)", border: "rgba(234,179,8,0.3)" },
  low: { bg: "rgba(34,197,94,0.15)", color: "var(--risk-low)", border: "rgba(34,197,94,0.3)" },
};

export default function RiskRadar({ dimensions, total, level }: RiskRadarProps) {
  const data = LABELS.map(({ key, label }) => ({
    subject: label,
    value: dimensions[key],
    fullMark: 100,
  }));

  const color = getColor(total);
  const lc = levelColors[level.toLowerCase()] || levelColors.low;

  return (
    <div style={{ width: 280, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 280, height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="var(--border-default)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "var(--text-tertiary)", fontSize: 10 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              strokeOpacity={0.8}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ textAlign: "center", marginTop: -8 }}>
        <div style={{
          fontSize: "var(--text-2xl)", fontWeight: 700, fontFamily: "var(--mono)",
          color, lineHeight: 1,
        }}>
          {total}
          <span style={{ fontSize: "var(--text-xs)", opacity: 0.6 }}>/100</span>
        </div>
        <div style={{
          display: "inline-block", marginTop: 6,
          padding: "2px 10px", borderRadius: "var(--radius-full)",
          fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em",
          background: lc.bg, color: lc.color, border: `1px solid ${lc.border}`,
        }}>
          {level}
        </div>
      </div>
    </div>
  );
}
