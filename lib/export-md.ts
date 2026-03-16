/**
 * Markdown report export generator — Professional audit format
 */
import { getSettings } from "./settings";
import { computeRiskDimensions } from "./risk-score";
import type { RiskEntity, Tag } from "./extract-risk-paths";

export function generateExportMd(job: Record<string, unknown>): string {
  const r = (job.result as Record<string, unknown>) || {};
  const req = (job.request as Record<string, unknown>) || {};
  const target = (r.target as Record<string, unknown>) || {};
  const summary = (r.summary as Record<string, unknown>) || {};
  const entities = (r.risk_entities as Record<string, unknown>[]) || [];

  const overall = (summary.highest_severity as string) || computeRisk(entities);
  const scenario = (r.scenario as string) || (req.scenario as string) || "all";
  const selfTags = (target.tags as Record<string, unknown>[]) || [];
  const selfRules = (target.self_matched_rules as string[]) || [];
  const riskResult = computeRiskDimensions(
    entities as unknown as RiskEntity[],
    selfTags as unknown as Tag[],
    selfRules
  );
  const riskScore = riskResult.total;
  const triggeredRules = (summary.rules_triggered as string[]) || [];
  const rulesLoaded = (summary.rules_loaded as number) || (summary.total_rules as number) || 0;
  const totalRules = (summary.total_rules as number) || rulesLoaded;
  const categoriesApplied = (summary.categories_applied as string[]) || [];
  const pathsDirection = (summary.paths_direction_filtered as string) || "all";

  const lines: string[] = [];

  // ── Report Header ──
  const appSettings = getSettings();
  const engineName = appSettings.app.name || "AMLClaw";
  if (appSettings.app.reportHeader) {
    lines.push(appSettings.app.reportHeader);
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  lines.push("# AML Address Screening Report");
  lines.push("");
  lines.push(`**Generated**: ${job.completed_at || "N/A"}`);
  lines.push(`**Engine**: ${engineName} Web`);
  lines.push(`**Scenario**: ${scenario}`);
  if (categoriesApplied.length > 0) lines.push(`**Categories Applied**: ${categoriesApplied.join(", ")}`);
  lines.push(`**Overall Risk**: ${riskResult.level}`);
  lines.push("");

  // ── Subject Identification ──
  lines.push("## Subject Identification");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push(`| Network | ${(target.chain as string) || (req.chain as string) || "-"} |`);
  lines.push(`| Address | \`${(target.address as string) || (req.address as string) || "-"}\` |`);
  lines.push(`| Validation | ${selfTags.length > 0 || selfRules.length > 0 ? "FLAGS DETECTED" : "CLEAN"} |`);
  lines.push(`| Ruleset | ${req.ruleset || "-"} |`);
  lines.push("");

  // ── Target Self-Risk Assessment ──
  if (selfTags.length > 0 || selfRules.length > 0) {
    lines.push("## Target Self-Risk Assessment");
    lines.push("");
    lines.push(`> **WARNING**: Address has ${selfTags.length} self-tag(s) and ${selfRules.length} self-triggered rule(s)`);
    lines.push("");
    if (selfTags.length > 0) {
      lines.push("| Primary Category | Secondary Category | Risk Level |");
      lines.push("|------------------|--------------------|------------|");
      for (const t of selfTags) {
        lines.push(`| ${(t.primary_category as string) || "-"} | ${(t.secondary_category as string) || "-"} | ${(t.risk_level as string) || "-"} |`);
      }
      lines.push("");
    }
    if (selfRules.length > 0) {
      lines.push("Self-triggered rules: " + selfRules.map((r) => `\`${r}\``).join(", "));
      lines.push("");
    }
  }

  // ── Key Risk Indicators ──
  lines.push("## Key Risk Indicators (KRI)");
  lines.push("");
  lines.push("| Indicator | Value |");
  lines.push("|-----------|-------|");
  lines.push(`| Risk Score | ${riskScore}/100 |`);
  lines.push(`| Risk Level | ${overall} |`);
  lines.push(`| Scenario | ${scenario} |`);
  lines.push(`| Direction | ${pathsDirection} |`);
  lines.push(`| Paths Analyzed | ${entities.length} |`);
  const recommendation = entities.length === 0 ? "Pass" : (overall === "Severe" || overall === "High") ? "Reject" : "Review";
  lines.push(`| Recommendation | **${recommendation}** |`);
  lines.push("");

  // Risk Score Breakdown
  const d = riskResult.dimensions;
  const weights = [
    { name: "Sanctions Exposure", score: d.sanctions, weight: 0.25 },
    { name: "Darknet/Illicit", score: d.illicit, weight: 0.20 },
    { name: "Mixer/Privacy", score: d.mixer, weight: 0.15 },
    { name: "Proximity", score: d.proximity, weight: 0.15 },
    { name: "Breadth", score: d.breadth, weight: 0.15 },
    { name: "Self Risk", score: d.selfRisk, weight: 0.10 },
  ];
  lines.push("### Risk Score Breakdown");
  lines.push("");
  lines.push("| Dimension | Score | Weight | Weighted |");
  lines.push("|-----------|-------|--------|----------|");
  for (const w of weights) {
    lines.push(`| ${w.name} | ${w.score} | ${(w.weight * 100).toFixed(0)}% | ${(w.score * w.weight).toFixed(1)} |`);
  }
  lines.push(`| **Total** | | | **${riskResult.total.toFixed(1)}** |`);
  lines.push("");

  // ── Custom Policy Enforcement ──
  lines.push("## Custom Policy Enforcement");
  lines.push("");
  lines.push(`Loaded **${rulesLoaded || totalRules}** of **${totalRules}** rules.`);
  lines.push("");
  if (triggeredRules.length > 0) {
    lines.push(`> **${triggeredRules.length} rule(s) triggered**`);
    lines.push("");
    lines.push("| Rule ID | Risk | Name | Action |");
    lines.push("|---------|------|------|--------|");
    for (const rid of triggeredRules) {
      const detail = findRuleInEntities(rid, entities);
      lines.push(`| \`${rid}\` | ${detail.risk_level || "-"} | ${detail.name || "-"} | ${detail.action || "-"} |`);
    }
    lines.push("");
  } else {
    lines.push("All rules passed — no policy violations detected.");
    lines.push("");
  }

  // ── On-Chain Graph Discovery ──
  if (entities.length > 0) {
    lines.push("## On-Chain Graph Discovery");
    lines.push("");
    const groups = groupEntitiesByCategory(entities);
    lines.push("| Category | Risk Level | Min Depth | Entities |");
    lines.push("|----------|------------|-----------|----------|");
    for (const g of groups) {
      lines.push(`| ${g.category} | ${g.riskLevel} | Hop ${g.minDepth} | ${g.count} |`);
    }
    lines.push("");
  }

  // ── Detailed Risk Evidence ──
  if (entities.length > 0) {
    lines.push("## Detailed Risk Evidence");
    lines.push("");

    // Group by triggered rule
    const ruleGroups = new Map<string, Record<string, unknown>[]>();
    for (const entity of entities) {
      const matched = (entity.matched_rules as string[]) || [];
      for (const rid of matched) {
        if (!ruleGroups.has(rid)) ruleGroups.set(rid, []);
        ruleGroups.get(rid)!.push(entity);
      }
    }

    for (const [rid, ruleEntities] of ruleGroups) {
      lines.push(`### Trigger: \`${rid}\``);
      lines.push("");
      for (let i = 0; i < ruleEntities.length; i++) {
        const entity = ruleEntities[i];
        const addr = (entity.address as string) || "Unknown";
        const tag = entity.tag as Record<string, unknown> | undefined;
        const minDeep = entity.min_deep as number;
        const evidencePaths = (entity.evidence_paths as Record<string, unknown>[]) || [];

        lines.push(`**Entity**: \`${addr}\``);
        if (tag) {
          const parts: string[] = [];
          if (tag.primary_category) parts.push(`Primary: ${tag.primary_category}`);
          if (tag.secondary_category) parts.push(`Secondary: ${tag.secondary_category}`);
          if (tag.risk_level) parts.push(`Risk: ${tag.risk_level}`);
          lines.push(`- Tag: ${parts.join(" | ")}`);
        }
        lines.push(`- Hop Distance: ${minDeep ?? "?"}`);

        if (evidencePaths.length > 0) {
          lines.push("- Evidence Chains:");
          for (const ep of evidencePaths) {
            lines.push(`  - Hop ${ep.deep}: \`${ep.flow}\``);
          }
        }
        lines.push("");
      }
    }

    // Ungrouped entities
    const ungrouped = entities.filter((e) => !((e.matched_rules as string[]) || []).length);
    if (ungrouped.length > 0) {
      lines.push("### Other Risk Entities");
      lines.push("");
      for (const entity of ungrouped) {
        const addr = (entity.address as string) || "Unknown";
        lines.push(`- \`${addr}\``);
      }
      lines.push("");
    }
  } else {
    lines.push("## Result");
    lines.push("");
    lines.push("No risk entities detected. Address appears clean.");
    lines.push("");
  }

  lines.push("---");
  lines.push("*Generated by AMLClaw Web*");
  return lines.join("\n");
}

function computeRisk(entities: Record<string, unknown>[]): string {
  for (const level of ["Severe", "High", "Medium"]) {
    for (const e of entities) {
      const tag = e.tag as Record<string, unknown> | undefined;
      if (tag?.risk_level?.toString().toLowerCase() === level.toLowerCase()) return level;
    }
  }
  return "Low";
}

function computeRiskScore(overallRisk: string): number {
  const scores: Record<string, number> = { severe: 100, high: 85, medium: 50, low: 20 };
  return scores[overallRisk.toLowerCase()] || 20;
}

function findRuleInEntities(ruleId: string, entities: Record<string, unknown>[]): { name: string; risk_level: string; action: string } {
  for (const e of entities) {
    const rules = (e.matched_rules_detail as Record<string, unknown>[]) || [];
    for (const r of rules) {
      if (r.rule_id === ruleId) return { name: (r.name as string) || "", risk_level: (r.risk_level as string) || "", action: (r.action as string) || "" };
    }
  }
  for (const e of entities) {
    const matched = (e.matched_rules as string[]) || [];
    if (matched.includes(ruleId)) {
      const tag = e.tag as Record<string, unknown> | undefined;
      return { name: "", risk_level: (tag?.risk_level as string) || "", action: "" };
    }
  }
  return { name: "", risk_level: "", action: "" };
}

function groupEntitiesByCategory(entities: Record<string, unknown>[]): { category: string; riskLevel: string; minDepth: number; count: number }[] {
  const groups = new Map<string, { riskLevel: string; minDepth: number; count: number }>();
  for (const e of entities) {
    const tag = e.tag as Record<string, unknown> | undefined;
    const cat = (tag?.primary_category as string) || "Unknown";
    const risk = (tag?.risk_level as string) || "Low";
    const depth = (e.min_deep as number) || 0;
    const key = `${cat}|${risk}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.minDepth = Math.min(existing.minDepth, depth);
    } else {
      groups.set(key, { riskLevel: risk, minDepth: depth, count: 1 });
    }
  }
  return Array.from(groups.entries()).map(([key, val]) => ({
    category: key.split("|")[0],
    ...val,
  }));
}
