import { NextResponse } from "next/server";
import { findRuleset, loadRuleset, saveRuleset } from "@/lib/storage";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ rulesetId: string }> }
) {
  const { rulesetId } = await params;
  const { meta, filepath, isBuiltin } = findRuleset(rulesetId);
  if (!meta || !filepath) {
    return NextResponse.json({ detail: "Ruleset not found" }, { status: 404 });
  }
  if (isBuiltin) {
    return NextResponse.json({ detail: "Cannot modify built-in rulesets" }, { status: 403 });
  }

  const rule = await req.json();
  const rules = loadRuleset(filepath) as Record<string, unknown>[];

  if (rules.some((r) => r.rule_id === rule.rule_id)) {
    return NextResponse.json({ detail: `Rule ID '${rule.rule_id}' already exists` }, { status: 400 });
  }

  rules.push(rule);
  saveRuleset(filepath, rules);
  return NextResponse.json({ status: "ok", rules_count: rules.length });
}
