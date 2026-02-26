import { NextResponse } from "next/server";
import { spawnClaude, isAIBusy } from "@/lib/claude";
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function safeSend(data: string) {
        if (closed) return;
        try { controller.enqueue(encoder.encode(data)); } catch { closed = true; }
      }

      function safeClose() {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }

      spawnClaude({
        jobId: `rules_gen_${rulesetId}`,
        jobType: "generate-rules",
        prompt,
        onData: (chunk) => {
          safeSend(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        },
        onComplete: (finalOutput) => {
          try {
            // Try multiple strategies to extract JSON array
            let rules: unknown[] | null = null;

            // Strategy 1: Direct parse
            try {
              const parsed = JSON.parse(finalOutput.trim());
              if (Array.isArray(parsed)) rules = parsed;
            } catch { /* not pure JSON */ }

            // Strategy 2: Find JSON array in output (handles markdown fencing)
            if (!rules) {
              // Remove markdown code fences
              const cleaned = finalOutput.replace(/```json\s*/g, "").replace(/```\s*/g, "");
              const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                try { rules = JSON.parse(jsonMatch[0]); } catch { /* bad JSON */ }
              }
            }

            if (!rules || !Array.isArray(rules) || rules.length === 0) {
              throw new Error("No valid JSON rules array found in AI output");
            }

            // Save the ruleset
            const filepath = path.join(RULESETS_DIR, `${rulesetId}.json`);
            saveRuleset(filepath, rules);

            // Update custom meta
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
            });
            saveCustomMeta(meta);

            safeSend(`event: done\ndata: ${JSON.stringify({ id: rulesetId, rules_count: rules.length })}\n\n`);
          } catch (e) {
            safeSend(`event: error\ndata: ${JSON.stringify({ error: e instanceof Error ? e.message : "Failed to parse rules" })}\n\n`);
          }
          safeClose();
        },
        onError: (error) => {
          safeSend(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
          safeClose();
        },
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
