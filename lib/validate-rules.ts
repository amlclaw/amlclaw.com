/**
 * Rule validation (TypeScript port of validate_rules.py)
 */
import fs from "fs";
import path from "path";

export function parseTrustinLabels(labelsPath: string): {
  primaryCategories: Set<string>;
  secondaryCategories: Set<string>;
} {
  const primaryCategories = new Set<string>();
  const secondaryCategories = new Set<string>();

  if (!fs.existsSync(labelsPath)) return { primaryCategories, secondaryCategories };

  const content = fs.readFileSync(labelsPath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || line.startsWith("| :") || line.startsWith("| 一级")) continue;
    const cols = line.split("|").map((c) => c.trim());
    if (cols.length >= 6) {
      const primaryEn = cols[1].trim();
      const secondaryEn = cols[3].trim();
      if (primaryEn && primaryEn !== "一级分类「英文」") primaryCategories.add(primaryEn);
      if (secondaryEn && secondaryEn !== "二级分类「英文」") secondaryCategories.add(secondaryEn);
    }
  }

  return { primaryCategories, secondaryCategories };
}

interface RuleSchema {
  items: {
    required: string[];
    properties: {
      category: { enum: string[] };
      risk_level: { enum: string[] };
      action: { enum: string[] };
      direction?: { enum: string[] };
      conditions: {
        items: {
          properties: {
            parameter: { enum: string[] };
            operator: { enum: string[] };
          };
        };
      };
    };
  };
}

export function validateSchemaStructure(
  rules: Record<string, unknown>[],
  schema: RuleSchema
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(rules)) {
    errors.push("Root element must be a JSON array");
    return errors;
  }

  const props = schema.items.properties;
  const validCategories = props.category.enum;
  const validRiskLevels = props.risk_level.enum;
  const validActions = props.action.enum;
  const validParameters = props.conditions.items.properties.parameter.enum;
  const validOperators = props.conditions.items.properties.operator.enum;
  const requiredFields = schema.items.required;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const prefix = `Rule [${i}] (id=${rule.rule_id ?? "???"})`;

    for (const field of requiredFields) {
      if (!(field in rule)) errors.push(`${prefix}: missing required field '${field}'`);
    }

    if ("category" in rule && !validCategories.includes(rule.category as string))
      errors.push(`${prefix}: invalid category '${rule.category}'. Valid: ${JSON.stringify(validCategories)}`);
    if ("risk_level" in rule && !validRiskLevels.includes(rule.risk_level as string))
      errors.push(`${prefix}: invalid risk_level '${rule.risk_level}'. Valid: ${JSON.stringify(validRiskLevels)}`);
    if ("action" in rule && !validActions.includes(rule.action as string))
      errors.push(`${prefix}: invalid action '${rule.action}'. Valid: ${JSON.stringify(validActions)}`);

    if ("direction" in rule) {
      if (!["inflow", "outflow"].includes(rule.direction as string))
        errors.push(`${prefix}: invalid direction '${rule.direction}'. Valid: ['inflow', 'outflow']`);
    }
    if ("min_hops" in rule) {
      if (typeof rule.min_hops !== "number" || rule.min_hops < 1)
        errors.push(`${prefix}: min_hops must be a positive integer, got '${rule.min_hops}'`);
    }
    if ("max_hops" in rule) {
      if (typeof rule.max_hops !== "number" || rule.max_hops < 1)
        errors.push(`${prefix}: max_hops must be a positive integer, got '${rule.max_hops}'`);
    }
    if ("min_hops" in rule && "max_hops" in rule) {
      if (typeof rule.min_hops === "number" && typeof rule.max_hops === "number" && rule.min_hops > rule.max_hops)
        errors.push(`${prefix}: min_hops (${rule.min_hops}) > max_hops (${rule.max_hops})`);
    }

    if ("conditions" in rule) {
      if (!Array.isArray(rule.conditions)) {
        errors.push(`${prefix}: 'conditions' must be an array`);
      } else {
        for (let j = 0; j < (rule.conditions as unknown[]).length; j++) {
          const cond = (rule.conditions as Record<string, unknown>[])[j];
          const cp = `${prefix} condition[${j}]`;
          for (const req of ["parameter", "operator", "value"]) {
            if (!(req in cond)) errors.push(`${cp}: missing required field '${req}'`);
          }
          if ("parameter" in cond && !validParameters.includes(cond.parameter as string))
            errors.push(`${cp}: invalid parameter '${cond.parameter}'`);
          if ("operator" in cond && !validOperators.includes(cond.operator as string))
            errors.push(`${cp}: invalid operator '${cond.operator}'`);
        }
      }
    }
  }
  return errors;
}

export function validateRuleIdUniqueness(rules: Record<string, unknown>[]): string[] {
  const errors: string[] = [];
  const seen: Record<string, number> = {};
  for (let i = 0; i < rules.length; i++) {
    const rid = rules[i].rule_id as string | undefined;
    if (!rid) continue;
    if (rid in seen) {
      errors.push(`Duplicate rule_id '${rid}' at indices ${seen[rid]} and ${i}`);
    } else {
      seen[rid] = i;
    }
  }
  return errors;
}

export function validateTagValues(
  rules: Record<string, unknown>[],
  primaryCategories: Set<string>,
  secondaryCategories: Set<string>
): string[] {
  const errors: string[] = [];
  if (primaryCategories.size === 0 && secondaryCategories.size === 0) return errors;

  const tagParams: Record<string, Set<string>> = {
    "target.tags.primary_category": primaryCategories,
    "target.tags.secondary_category": secondaryCategories,
    "path.node.tags.primary_category": primaryCategories,
    "path.node.tags.secondary_category": secondaryCategories,
  };

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const prefix = `Rule [${i}] (id=${rule.rule_id ?? "???"})`;
    const conditions = (rule.conditions as Record<string, unknown>[]) || [];
    for (let j = 0; j < conditions.length; j++) {
      const cond = conditions[j];
      const param = cond.parameter as string;
      if (param in tagParams) {
        const validTags = tagParams[param];
        const value = cond.value;
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v === "string" && !validTags.has(v)) {
            errors.push(`${prefix} condition[${j}]: tag value '${v}' not found in Trustin AML labels for parameter '${param}'`);
          }
        }
      }
    }
  }
  return errors;
}

export function validateRules(rules: Record<string, unknown>[]): {
  valid: boolean;
  errors: string[];
  output: string;
} {
  const schemaPath = path.join(process.cwd(), "data", "schema", "rule_schema.json");
  const labelsPath = path.join(process.cwd(), "references", "Trustin AML labels.md");

  let schema: RuleSchema;
  try {
    schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
  } catch {
    return { valid: false, errors: ["Schema file not found or invalid"], output: "Schema file not found" };
  }

  const { primaryCategories, secondaryCategories } = parseTrustinLabels(labelsPath);

  const allErrors: string[] = [];
  allErrors.push(...validateSchemaStructure(rules, schema));
  allErrors.push(...validateRuleIdUniqueness(rules));
  allErrors.push(...validateTagValues(rules, primaryCategories, secondaryCategories));

  if (allErrors.length > 0) {
    return {
      valid: false,
      errors: allErrors,
      output: `FAIL: ${allErrors.length} error(s) found:\n${allErrors.map((e) => `  - ${e}`).join("\n")}`,
    };
  }

  return {
    valid: true,
    errors: [],
    output: `PASS: ${rules.length} rule(s) validated successfully.\n  - Schema structure: OK\n  - Rule ID uniqueness: OK\n  - Tag values: OK`,
  };
}
