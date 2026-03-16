/**
 * Six-dimension risk scoring algorithm
 * Pure function — no Node.js dependencies, usable on both client and server
 */

import type { RiskEntity, Tag } from "./extract-risk-paths";

export interface RiskDimensions {
  sanctions: number;
  illicit: number;
  mixer: number;
  proximity: number;
  breadth: number;
  selfRisk: number;
}

export interface RiskScoreResult {
  total: number;
  dimensions: RiskDimensions;
  level: string;
}

const DEEP_SCORE: Record<number, number> = { 1: 100, 2: 80, 3: 60, 4: 40, 5: 20 };
const PROXIMITY_SCORE: Record<number, number> = { 1: 100, 2: 70, 3: 40, 4: 20, 5: 10 };

const SANCTIONS_KEYWORDS = ["Sanction", "OFAC", "SDN", "Sanctioned"];
const ILLICIT_KEYWORDS = ["Darknet", "Scam", "Fraud", "Phishing", "Theft", "Ransomware", "Terrorist"];
const MIXER_KEYWORDS = ["Mixer", "Tornado", "Privacy", "Tumbler"];

function categoryScore(entities: RiskEntity[], keywords: string[]): number {
  let best = 0;
  for (const e of entities) {
    const cat = e.tag.primary_category || "";
    if (keywords.some((k) => cat.includes(k))) {
      const s = DEEP_SCORE[Math.min(e.min_deep, 5)] ?? 20;
      if (s > best) best = s;
    }
  }
  return best;
}

function proximityScore(entities: RiskEntity[]): number {
  if (entities.length === 0) return 0;
  const minDeep = Math.min(...entities.map((e) => e.min_deep));
  return PROXIMITY_SCORE[Math.min(minDeep, 5)] ?? 10;
}

// Breadth mapping with linear interpolation
const BREADTH_MAP: [number, number][] = [
  [0, 0], [1, 20], [2, 35], [3, 50], [5, 70], [10, 85], [15, 100],
];

function breadthScore(count: number): number {
  if (count <= 0) return 0;
  if (count >= 15) return 100;
  for (let i = 0; i < BREADTH_MAP.length - 1; i++) {
    const [x0, y0] = BREADTH_MAP[i];
    const [x1, y1] = BREADTH_MAP[i + 1];
    if (count >= x0 && count <= x1) {
      return y0 + ((y1 - y0) * (count - x0)) / (x1 - x0);
    }
  }
  return 100;
}

function selfRiskScore(targetTags: Tag[], _selfMatchedRules: string[]): number {
  if (!targetTags || targetTags.length === 0) return 0;
  const severities = targetTags.map((t) => (t.risk_level || "").toLowerCase());
  if (severities.includes("severe")) return 100;
  if (severities.includes("high")) return 80;
  if (severities.includes("medium")) return 50;
  return 30; // has tags but Low
}

export function computeRiskDimensions(
  riskEntities: RiskEntity[],
  targetTags: Tag[],
  targetSelfMatchedRules: string[]
): RiskScoreResult {
  const dimensions: RiskDimensions = {
    sanctions: categoryScore(riskEntities, SANCTIONS_KEYWORDS),
    illicit: categoryScore(riskEntities, ILLICIT_KEYWORDS),
    mixer: categoryScore(riskEntities, MIXER_KEYWORDS),
    proximity: proximityScore(riskEntities),
    breadth: Math.round(breadthScore(riskEntities.length)),
    selfRisk: selfRiskScore(targetTags, targetSelfMatchedRules),
  };

  const total = Math.round(
    dimensions.sanctions * 0.25 +
    dimensions.illicit * 0.20 +
    dimensions.mixer * 0.15 +
    dimensions.proximity * 0.15 +
    dimensions.breadth * 0.15 +
    dimensions.selfRisk * 0.10
  );

  const level = total > 80 ? "Severe" : total > 60 ? "High" : total > 40 ? "Medium" : "Low";

  return { total, dimensions, level };
}
