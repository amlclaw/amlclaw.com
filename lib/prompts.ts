/**
 * Prompt template loader — reads .md templates and interpolates variables.
 */
import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

export function loadPrompt(name: string, vars: Record<string, string> = {}): string {
  const filepath = path.join(PROMPTS_DIR, `${name}.md`);
  let content = fs.readFileSync(filepath, "utf-8");

  for (const [key, value] of Object.entries(vars)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  return content;
}

/**
 * Load the rule schema JSON for prompt injection
 */
export function loadRuleSchema(): string {
  const schemaPath = path.join(process.cwd(), "data", "schema", "rule_schema.json");
  return fs.readFileSync(schemaPath, "utf-8");
}

/**
 * Load TrustIn AML labels taxonomy
 */
export function loadLabels(): string {
  const labelsPath = path.join(process.cwd(), "references", "Trustin AML labels.md");
  return fs.readFileSync(labelsPath, "utf-8");
}
