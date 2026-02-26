import { NextResponse } from "next/server";
import { findRuleset, loadRuleset } from "@/lib/storage";
import { validateRules } from "@/lib/validate-rules";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ rulesetId: string }> }
) {
  const { rulesetId } = await params;
  const { meta, filepath } = findRuleset(rulesetId);
  if (!meta || !filepath) {
    return NextResponse.json({ detail: "Ruleset not found" }, { status: 404 });
  }

  const rules = loadRuleset(filepath) as Record<string, unknown>[];
  const result = validateRules(rules);
  return NextResponse.json({ valid: result.valid, output: result.output });
}
