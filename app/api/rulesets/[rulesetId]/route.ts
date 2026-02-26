import { NextResponse } from "next/server";
import { findRuleset, loadRuleset, saveRuleset, deleteRulesetFile, loadCustomMeta, saveCustomMeta } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ rulesetId: string }> }
) {
  const { rulesetId } = await params;
  const { meta, filepath, isBuiltin } = findRuleset(rulesetId);
  if (!meta || !filepath) {
    return NextResponse.json({ detail: "Ruleset not found" }, { status: 404 });
  }
  const rules = loadRuleset(filepath);
  return NextResponse.json({ id: rulesetId, meta: { ...meta, builtin: isBuiltin }, rules });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ rulesetId: string }> }
) {
  const { rulesetId } = await params;
  const { meta, filepath, isBuiltin } = findRuleset(rulesetId);
  if (!meta || !filepath) {
    return NextResponse.json({ detail: "Ruleset not found" }, { status: 404 });
  }
  if (isBuiltin) {
    return NextResponse.json({ detail: "Cannot modify built-in rulesets. Clone it first." }, { status: 403 });
  }

  const body = await req.json();
  const rules = body.rules || [];
  saveRuleset(filepath, rules);
  return NextResponse.json({ status: "ok", rules_count: rules.length });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ rulesetId: string }> }
) {
  const { rulesetId } = await params;
  const { meta, filepath, isBuiltin } = findRuleset(rulesetId);
  if (!meta || !filepath) {
    return NextResponse.json({ detail: "Ruleset not found" }, { status: 404 });
  }
  if (isBuiltin) {
    return NextResponse.json({ detail: "Cannot delete built-in rulesets" }, { status: 403 });
  }

  deleteRulesetFile(filepath);
  const customMeta = loadCustomMeta().filter((m) => m.id !== rulesetId);
  saveCustomMeta(customMeta);

  return NextResponse.json({ status: "ok" });
}
