/**
 * Risk path extraction engine (TypeScript port of extract_risk_paths.py)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface RuleCondition {
  parameter: string;
  operator: string;
  value: unknown;
}

export interface Rule {
  rule_id: string;
  category: string;
  name: string;
  risk_level: string;
  action: string;
  direction?: string;
  min_hops?: number;
  max_hops?: number;
  conditions?: RuleCondition[];
  description?: string;
  reference?: string;
}

export interface Tag {
  primary_category?: string;
  secondary_category?: string;
  tertiary_category?: string;
  quaternary_category?: string;
  risk_level?: string;
  priority?: number;
  [key: string]: unknown;
}

export interface EvidencePath {
  path_index: number;
  deep: number;
  flow: string;
}

export interface RiskEntity {
  address: string;
  min_deep: number;
  tag: {
    primary_category: string;
    secondary_category: string;
    tertiary_category: string;
    quaternary_category: string;
    risk_level: string;
  };
  matched_rules: string[];
  evidence_paths: EvidencePath[];
  occurrences: number;
}

export interface TargetFinding {
  tag: {
    primary_category: string;
    secondary_category: string;
    tertiary_category: string;
    quaternary_category: string;
    risk_level: string;
  };
  matched_rules: string[];
}

export interface ExtractionSummary {
  scenario: string;
  categories_applied: string[];
  total_paths_analyzed: number;
  paths_direction_filtered: number;
  unique_risk_entities: number;
  rules_loaded: number;
  rules_total_available: number;
  rules_triggered: string[];
  highest_severity: string;
}

export interface ExtractionResult {
  riskEntities: RiskEntity[];
  summary: ExtractionSummary;
  targetFindings: TargetFinding[];
  targetTagsRaw: Tag[];
}

// ---------------------------------------------------------------------------
// Scenario mappings
// ---------------------------------------------------------------------------
const SCENARIO_CATEGORIES: Record<string, string[] | null> = {
  onboarding: ["Deposit"],
  deposit: ["Deposit"],
  withdrawal: ["Withdrawal"],
  cdd: ["CDD"],
  monitoring: ["Ongoing Monitoring"],
  all: null,
};

const SCENARIO_PATH_FILTER: Record<string, number[] | null> = {
  onboarding: null,
  deposit: null,
  withdrawal: [1],
  cdd: null,
  monitoring: null,
  all: null,
};

// ---------------------------------------------------------------------------
// Node-level and target-level parameters
// ---------------------------------------------------------------------------
const NODE_LEVEL_PARAMS = new Set([
  "path.node.tags.primary_category",
  "path.node.tags.secondary_category",
  "path.node.tags.risk_level",
]);

const TARGET_LEVEL_PARAMS = new Set([
  "target.tags.primary_category",
  "target.tags.secondary_category",
  "target.tags.risk_level",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function prioritizeTag(tags: Tag[]): Tag | null {
  if (!tags || tags.length === 0) return null;
  return tags.reduce((best, tag) => {
    const bestP = typeof best.priority === "number" ? best.priority : 9999;
    const tagP = typeof tag.priority === "number" ? tag.priority : 9999;
    return tagP < bestP ? tag : best;
  });
}

function evalTagCondition(
  cond: RuleCondition,
  tag: Tag | null,
  validParams: Set<string>,
  tagField: string
): boolean | null {
  const param = cond.parameter;
  const op = cond.operator;
  const value = cond.value;

  if (!validParams.has(param)) return null;

  const fieldMap: Record<string, string> = {
    [`${tagField}.primary_category`]: "primary_category",
    [`${tagField}.secondary_category`]: "secondary_category",
    [`${tagField}.risk_level`]: "risk_level",
  };

  const field = fieldMap[param];
  if (!field) return null;

  const actual = tag ? (tag[field] as string | undefined) : undefined;
  if (actual === undefined || actual === null) return false;

  if (op === "IN") return Array.isArray(value) ? value.includes(actual) : false;
  if (op === "==") return actual === value;
  if (op === "!=") return actual !== value;
  if (op === "NOT_IN") return Array.isArray(value) ? !value.includes(actual) : true;
  return false;
}

function evalCondition(cond: RuleCondition, nodeTag: Tag | null, _nodeDeep: number): boolean | null {
  return evalTagCondition(cond, nodeTag, NODE_LEVEL_PARAMS, "path.node.tags");
}

function evalTargetCondition(cond: RuleCondition, targetTag: Tag | null): boolean | null {
  return evalTagCondition(cond, targetTag, TARGET_LEVEL_PARAMS, "target.tags");
}

function ruleHasTargetConditions(rule: Rule): boolean {
  return (rule.conditions || []).some((c) => TARGET_LEVEL_PARAMS.has(c.parameter));
}

function ruleMatchesTargetTag(rule: Rule, targetTag: Tag): boolean {
  const conditions = rule.conditions || [];
  if (conditions.length === 0) return false;

  let evaluated = 0;
  for (const cond of conditions) {
    const result = evalTargetCondition(cond, targetTag);
    if (result === null) continue;
    evaluated++;
    if (!result) return false;
  }
  return evaluated > 0;
}

function evaluateTargetRules(rules: Rule[], targetTags: Tag[]): TargetFinding[] {
  const targetRules = rules.filter(ruleHasTargetConditions);
  if (targetRules.length === 0 || !targetTags || targetTags.length === 0) return [];

  const findings: TargetFinding[] = [];
  for (const tag of targetTags) {
    const matchedRuleIds: string[] = [];
    for (const rule of targetRules) {
      if (ruleMatchesTargetTag(rule, tag)) {
        matchedRuleIds.push(rule.rule_id);
      }
    }
    if (matchedRuleIds.length > 0) {
      findings.push({
        tag: {
          primary_category: tag.primary_category || "",
          secondary_category: tag.secondary_category || "",
          tertiary_category: tag.tertiary_category || "",
          quaternary_category: tag.quaternary_category || "",
          risk_level: tag.risk_level || "",
        },
        matched_rules: matchedRuleIds.sort(),
      });
    }
  }
  return findings;
}

function ruleAppliesToContext(rule: Rule, pathDir: number, nodeDeep: number): boolean {
  const ruleDir = rule.direction;
  if (ruleDir) {
    const dirMap: Record<string, number> = { inflow: -1, outflow: 1 };
    if (dirMap[ruleDir] !== pathDir) return false;
  }
  if (rule.min_hops !== undefined && rule.min_hops !== null && nodeDeep < rule.min_hops) return false;
  if (rule.max_hops !== undefined && rule.max_hops !== null && nodeDeep > rule.max_hops) return false;
  return true;
}

function ruleMatchesNode(rule: Rule, nodeTag: Tag | null, nodeDeep: number): boolean {
  const conditions = rule.conditions || [];
  if (conditions.length === 0) return false;

  let evaluated = 0;
  for (const cond of conditions) {
    const result = evalCondition(cond, nodeTag, nodeDeep);
    if (result === null) continue;
    evaluated++;
    if (!result) return false;
  }
  return evaluated > 0;
}

function computeTrueDeep(nodeIndex: number, numNodes: number, pathDir: number): number {
  return pathDir === -1 ? numNodes - 1 - nodeIndex : nodeIndex;
}

function formatEvidencePath(
  nodes: Record<string, unknown>[],
  illicitIndex: number,
  pathDirection: number
): string {
  let relevantNodes: Record<string, unknown>[];
  if (pathDirection === -1) relevantNodes = nodes.slice(illicitIndex);
  else if (pathDirection === 1) relevantNodes = nodes.slice(0, illicitIndex + 1);
  else relevantNodes = nodes;

  const parts: string[] = [];
  for (let i = 0; i < relevantNodes.length; i++) {
    const n = relevantNodes[i];
    const addr = (n.address as string) || "Unknown";
    let amount = (n.amount as number) || 0;
    if (amount === null) amount = 0;

    const tags = (n.tags as Tag[]) || [];
    let labelStr = "";
    if (tags.length > 0) {
      const bestTag = prioritizeTag(tags);
      if (bestTag) {
        const lbl =
          bestTag.quaternary_category ||
          bestTag.tertiary_category ||
          bestTag.secondary_category ||
          bestTag.primary_category;
        if (lbl) labelStr = ` (${lbl})`;
      }
    }

    if (i > 0) parts.push(`--(${amount} USD)-->`);
    parts.push(`[${addr}${labelStr}]`);
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------
export function extractRiskPaths(
  graphData: Record<string, unknown>,
  rules: Rule[],
  maxDepth = 5,
  scenario = "all"
): ExtractionResult {
  const data = ((graphData.graph_data as Record<string, unknown>) || {}).data as Record<string, unknown> || {};
  const targetAddress = (graphData.address as string) || "";

  // Scenario: filter rules by category
  const categories = SCENARIO_CATEGORIES[scenario] ?? null;
  const rulesTotalLoaded = rules.length;
  let filteredRules = rules;
  if (categories) {
    filteredRules = rules.filter((r) => categories.includes(r.category));
  }
  const rulesAfterFilter = filteredRules.length;

  // Scenario: allowed path directions
  const allowedDirs = SCENARIO_PATH_FILTER[scenario] ?? null;

  // Target self-tag evaluation
  const targetTagsRaw = (data.tags as Tag[]) || [];
  const targetFindings = evaluateTargetRules(filteredRules, targetTagsRaw);
  const targetSelfMatchedRules = new Set<string>();
  for (const tf of targetFindings) {
    for (const rid of tf.matched_rules) targetSelfMatchedRules.add(rid);
  }

  // Path traversal
  const findings: Record<string, {
    address: string;
    min_deep: number;
    tag: { primary_category: string; secondary_category: string; tertiary_category: string; quaternary_category: string; risk_level: string };
    matched_rules: Set<string>;
    evidence_paths: EvidencePath[];
    occurrences: number;
  }> = {};

  const allPaths = (data.paths as Record<string, unknown>[]) || [];
  let pathsDirectionFiltered = 0;

  for (let pathIdx = 0; pathIdx < allPaths.length; pathIdx++) {
    const path = allPaths[pathIdx];
    const nodes = (path.path as Record<string, unknown>[]) || [];
    const pathDir = (path.direction as number) ?? -1;

    if (nodes.length === 0) continue;
    if (allowedDirs && !allowedDirs.includes(pathDir)) {
      pathsDirectionFiltered++;
      continue;
    }

    const numNodes = nodes.length;
    for (let nodeIdx = 0; nodeIdx < numNodes; nodeIdx++) {
      const node = nodes[nodeIdx];
      const addr = (node.address as string) || "";
      if (addr === targetAddress) continue;

      const trueDeep = computeTrueDeep(nodeIdx, numNodes, pathDir);
      if (trueDeep < 1 || trueDeep > maxDepth) continue;

      const tag = prioritizeTag((node.tags as Tag[]) || []);
      if (!tag) continue;

      const matchedRuleIds: string[] = [];
      for (const rule of filteredRules) {
        if (!ruleAppliesToContext(rule, pathDir, trueDeep)) continue;
        if (ruleMatchesNode(rule, tag, trueDeep)) matchedRuleIds.push(rule.rule_id);
      }
      if (matchedRuleIds.length === 0) continue;

      const evidence = formatEvidencePath(nodes, nodeIdx, pathDir);
      const key = addr;
      if (!findings[key]) {
        findings[key] = {
          address: addr,
          min_deep: trueDeep,
          tag: {
            primary_category: tag.primary_category || "",
            secondary_category: tag.secondary_category || "",
            tertiary_category: tag.tertiary_category || "",
            quaternary_category: tag.quaternary_category || "",
            risk_level: tag.risk_level || "",
          },
          matched_rules: new Set(),
          evidence_paths: [],
          occurrences: 0,
        };
      }

      const entry = findings[key];
      for (const rid of matchedRuleIds) entry.matched_rules.add(rid);
      entry.min_deep = Math.min(entry.min_deep, trueDeep);
      entry.occurrences++;
      if (entry.evidence_paths.length < 3) {
        entry.evidence_paths.push({ path_index: pathIdx, deep: trueDeep, flow: evidence });
      }
    }
  }

  // Convert and sort
  const severityOrder: Record<string, number> = { severe: 0, high: 1, medium: 2, low: 3 };
  const result: RiskEntity[] = Object.values(findings).map((f) => ({
    ...f,
    matched_rules: [...f.matched_rules].sort(),
  }));

  result.sort((a, b) => {
    const sa = severityOrder[(a.tag.risk_level || "low").toLowerCase()] ?? 3;
    const sb = severityOrder[(b.tag.risk_level || "low").toLowerCase()] ?? 3;
    if (sa !== sb) return sa - sb;
    return a.min_deep - b.min_deep;
  });

  // Build summary
  const allTriggered = new Set<string>();
  for (const f of result) for (const rid of f.matched_rules) allTriggered.add(rid);
  for (const rid of targetSelfMatchedRules) allTriggered.add(rid);

  let highestSeverity = "Low";
  for (const f of result) {
    const rl = (f.tag.risk_level || "low").toLowerCase();
    if ((severityOrder[rl] ?? 3) < (severityOrder[highestSeverity.toLowerCase()] ?? 3)) {
      highestSeverity = { severe: "Severe", high: "High", medium: "Medium", low: "Low" }[rl] || "Low";
    }
  }

  const ruleSeverity: Record<string, string> = {};
  for (const rule of filteredRules) ruleSeverity[rule.rule_id] = rule.risk_level || "Low";
  for (const rid of allTriggered) {
    const rs = ruleSeverity[rid] || "Low";
    if ((severityOrder[rs.toLowerCase()] ?? 3) < (severityOrder[highestSeverity.toLowerCase()] ?? 3)) {
      highestSeverity = rs;
    }
  }

  const summary: ExtractionSummary = {
    scenario,
    categories_applied: categories || ["ALL"],
    total_paths_analyzed: allPaths.length,
    paths_direction_filtered: pathsDirectionFiltered,
    unique_risk_entities: result.length,
    rules_loaded: rulesAfterFilter,
    rules_total_available: rulesTotalLoaded,
    rules_triggered: [...allTriggered].sort(),
    highest_severity: highestSeverity,
  };

  return { riskEntities: result, summary, targetFindings, targetTagsRaw };
}
