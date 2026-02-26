import { NextResponse } from "next/server";
import { getAllRulesets, findRuleset, loadRuleset, saveRuleset, loadCustomMeta, saveCustomMeta } from "@/lib/storage";
import path from "path";
import crypto from "crypto";

export async function GET() {
  return NextResponse.json(getAllRulesets());
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = (body.name || "").trim();
  const jurisdiction = body.jurisdiction || "Custom";
  const cloneFrom = body.clone_from || "";

  if (!name) {
    return NextResponse.json({ detail: "Name is required" }, { status: 400 });
  }

  const rid = "custom_" + crypto.randomUUID().slice(0, 8);
  let rules: unknown[] = [];

  if (cloneFrom) {
    const { filepath } = findRuleset(cloneFrom);
    if (filepath) rules = loadRuleset(filepath);
  }

  const rulesetDir = path.join(process.cwd(), "data", "rulesets");
  saveRuleset(path.join(rulesetDir, `${rid}.json`), rules);

  const meta = loadCustomMeta();
  meta.push({ id: rid, name, jurisdiction, icon: "rules" });
  saveCustomMeta(meta);

  return NextResponse.json({ id: rid, name, rules_count: rules.length });
}
