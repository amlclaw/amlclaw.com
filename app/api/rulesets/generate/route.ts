import { NextResponse } from "next/server";
import { spawnAI, isAIBusy } from "@/lib/ai";
import { loadPrompt, loadRuleSchema, loadLabels } from "@/lib/prompts";
import { loadPolicy, loadCustomMeta, saveCustomMeta, saveRuleset } from "@/lib/storage";
import path from "path";

const RULESETS_DIR = path.join(process.cwd(), "data", "rulesets");

export async function POST(req: Request) {
  if (isAIBusy()) {
    return NextResponse.json({ error: "AI is currently busy with another task" }, { status: 409 });
  }

  const body = await req.json();
  const { policyId, name, jurisdiction } = body as {
    policyId: string;
    name?: string;
    jurisdiction?: string;
  };

  if (!policyId) {
    return NextResponse.json({ error: "policyId is required" }, { status: 400 });
  }

  const policy = loadPolicy(policyId);
  if (!policy || !policy.content) {
    return NextResponse.json({ error: "Policy not found or has no content" }, { status: 404 });
  }

  const schema = loadRuleSchema();
  const labels = loadLabels();

  const prompt = loadPrompt("generate-rules", {
    POLICIES: policy.content,
    SCHEMA: schema,
    LABELS: labels,
  });

  const rulesetId = `custom_ai_${Date.now()}`;
  const rulesetName = name || `${policy.name} Rules`;
  const rulesetJurisdiction = jurisdiction || policy.jurisdiction;

  // Save meta with "generating" status
  const meta = loadCustomMeta();
  meta.push({
    id: rulesetId,
    name: rulesetName,
    jurisdiction: rulesetJurisdiction,
    icon: rulesetJurisdiction === "Singapore" ? "sg" :
      rulesetJurisdiction === "Hong Kong" ? "hk" :
        rulesetJurisdiction === "Dubai" ? "ae" : "rules",
    source_policies: [policyId],
    generated_by: "ai",
    status: "generating",
  });
  saveCustomMeta(meta);

  // Fire and forget
  spawnAI({
    jobId: `rules_gen_${rulesetId}`,
    jobType: "generate-rules",
    prompt,
    onData: () => {},
    onComplete: (finalOutput) => {
      try {
        let rules: unknown[] | null = null;

        // Strategy 1: Direct parse
        try {
          const parsed = JSON.parse(finalOutput.trim());
          if (Array.isArray(parsed)) rules = parsed;
        } catch { /* not pure JSON */ }

        // Strategy 2: Extract JSON from markdown fences
        if (!rules) {
          const cleaned = finalOutput.replace(/```json\s*/g, "").replace(/```\s*/g, "");
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try { rules = JSON.parse(jsonMatch[0]); } catch { /* bad JSON */ }
          }
        }

        if (!rules || !Array.isArray(rules) || rules.length === 0) {
          throw new Error("No valid JSON rules array found in AI output");
        }

        // Save ruleset file
        const filepath = path.join(RULESETS_DIR, `${rulesetId}.json`);
        saveRuleset(filepath, rules);

        // Update meta status to ready
        const currentMeta = loadCustomMeta();
        const entry = currentMeta.find((m) => m.id === rulesetId);
        if (entry) {
          entry.status = "ready";
          entry.rules_count = rules.length;
          saveCustomMeta(currentMeta);
        }

        console.log(`[generate] Ruleset ${rulesetId} completed: ${rules.length} rules`);
      } catch (e) {
        const currentMeta = loadCustomMeta();
        const entry = currentMeta.find((m) => m.id === rulesetId);
        if (entry) {
          entry.status = "error";
          saveCustomMeta(currentMeta);
        }
        console.error(`[generate] Ruleset ${rulesetId} parse failed:`, e instanceof Error ? e.message : e);
      }
    },
    onError: (error) => {
      const currentMeta = loadCustomMeta();
      const entry = currentMeta.find((m) => m.id === rulesetId);
      if (entry) {
        entry.status = "error";
        saveCustomMeta(currentMeta);
      }
      console.error(`[generate] Ruleset ${rulesetId} failed:`, error);
    },
  });

  return NextResponse.json(
    { message: "Generation started", rulesetId, status: "generating" },
    { status: 202 }
  );
}
