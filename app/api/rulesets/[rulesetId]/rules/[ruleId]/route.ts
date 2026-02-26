import { NextResponse } from "next/server";
import { findRuleset, loadRuleset, saveRuleset } from "@/lib/storage";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ rulesetId: string; ruleId: string }> }
) {
  const { rulesetId, ruleId } = await params;
  const { meta, filepath, isBuiltin } = findRuleset(rulesetId);
  if (!meta || !filepath) {
    return NextResponse.json({ detail: "Ruleset not found" }, { status: 404 });
  }
  if (isBuiltin) {
    return NextResponse.json({ detail: "Cannot modify built-in rulesets" }, { status: 403 });
  }

  const rule = await req.json();
  const rules = loadRuleset(filepath) as Record<string, unknown>[];
  const idx = rules.findIndex((r) => r.rule_id === ruleId);
  if (idx === -1) {
    return NextResponse.json({ detail: "Rule not found" }, { status: 404 });
  }

  rules[idx] = rule;
  saveRuleset(filepath, rules);
  return NextResponse.json({ status: "ok" });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ rulesetId: string; ruleId: string }> }
) {
  const { rulesetId, ruleId } = await params;
  const { meta, filepath, isBuiltin } = findRuleset(rulesetId);
  if (!meta || !filepath) {
    return NextResponse.json({ detail: "Ruleset not found" }, { status: 404 });
  }
  if (isBuiltin) {
    return NextResponse.json({ detail: "Cannot modify built-in rulesets" }, { status: 403 });
  }

  const rules = (loadRuleset(filepath) as Record<string, unknown>[]).filter(
    (r) => r.rule_id !== ruleId
  );
  saveRuleset(filepath, rules);
  return NextResponse.json({ status: "ok", rules_count: rules.length });
}
