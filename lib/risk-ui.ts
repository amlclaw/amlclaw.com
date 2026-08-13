/**
 * Client-safe risk display helpers for the v3 risk vocabulary
 * (low | medium | high | critical). Existing CSS pills use the legacy
 * "severe" class for the top tier — map critical onto it.
 */

export function riskPillClass(risk: string): string {
  const r = String(risk || "low").toLowerCase();
  if (r === "critical") return "severe";
  if (["severe", "high", "medium", "low"].includes(r)) return r;
  return "low";
}

export function riskColorVar(risk: string): string {
  const r = String(risk || "low").toLowerCase();
  const map: Record<string, string> = {
    critical: "var(--risk-severe)",
    severe: "var(--risk-severe)",
    high: "var(--risk-high)",
    medium: "var(--risk-medium)",
    low: "var(--risk-low)",
  };
  return map[r] || "var(--text-secondary)";
}

export function riskLabel(risk: string): string {
  const r = String(risk || "low").toLowerCase();
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/** Sort rank: higher = riskier (critical 3 … low 0). Client-safe. */
export function riskSortRank(risk: string): number {
  const map: Record<string, number> = { critical: 3, severe: 3, high: 2, medium: 1, low: 0 };
  return map[String(risk || "low").toLowerCase()] ?? 0;
}

/** Recommendation from rule actions: block → Reject, review → Review, else Pass. */
export function recommendation(actions: string[]): "Reject" | "Review" | "Pass" {
  const set = new Set(actions.map((a) => a.toLowerCase()));
  if (set.has("block")) return "Reject";
  if (set.has("review") || set.has("alert")) return "Review";
  return "Pass";
}

export function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Fund-score verdict display helpers (score-first UI; risk level is legacy).
// ---------------------------------------------------------------------------

export function verdictColorVar(verdict?: string | null): string {
  switch (verdict) {
    case "block": return "var(--danger)";
    case "edd": return "var(--risk-high)";
    case "review": return "var(--risk-medium)";
    case "accept": return "var(--success)";
    default: return "var(--text-tertiary)";
  }
}

export function verdictZh(verdict?: string | null): string {
  switch (verdict) {
    case "block": return "拒绝";
    case "edd": return "尽调";
    case "review": return "复核";
    case "accept": return "放行";
    default: return "—";
  }
}
