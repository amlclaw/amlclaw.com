import { queryAgent } from "@/lib/ai-agent";
import { loadPrompt } from "@/lib/prompts";
import { loadHistoryJob } from "@/lib/storage";
import { createSAR, getNextReference, updateSAR } from "@/lib/sar-storage";
import { logAudit } from "@/lib/audit-log";
import { getSettings } from "@/lib/settings";
import { parseSARJson, renderSARTemplate } from "@/lib/sar-template";

export async function POST(req: Request) {
  const body = await req.json();
  const { screening_job_id, jurisdiction = "generic" } = body as {
    screening_job_id: string;
    jurisdiction?: string;
  };

  if (!screening_job_id) {
    return new Response(JSON.stringify({ error: "screening_job_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const job = loadHistoryJob(screening_job_id);
  if (!job) {
    return new Response(JSON.stringify({ error: "Screening job not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reference = getNextReference();
  const settings = getSettings();
  const sarSettings = (settings as unknown as Record<string, unknown>).sar as Record<string, unknown> | undefined;

  const institution = {
    name: (sarSettings?.institution_name as string) || settings.app.name || "AMLClaw",
    license: (sarSettings?.license_number as string) || "",
    compliance_officer: (sarSettings?.compliance_officer as string) || "",
  };

  const sar = createSAR({
    reference,
    screening_job_id,
    jurisdiction,
    status: "generating",
    content: "",
    institution,
  });

  // Respond immediately — generation happens in background
  const response = new Response(JSON.stringify({
    id: sar.id,
    reference: sar.reference,
    status: "generating",
  }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });

  // Background generation
  (async () => {
    try {
      // Use structured prompt — AI outputs JSON
      const prompt = loadPrompt("sar-structured", {
        screening_data: JSON.stringify(job, null, 2),
        institution_info: JSON.stringify(institution, null, 2),
        jurisdiction,
        reference_id: reference,
      });

      const rawOutput = await queryAgent({
        jobId: `sar_gen_${sar.id}`,
        jobType: "generate-sar",
        prompt,
        maxTurns: 3,
        disallowedTools: ["Bash", "Edit", "Write", "Read"],
      });

      // Parse JSON and render with template
      const structured = parseSARJson(rawOutput);

      let content: string;
      if (structured) {
        content = renderSARTemplate(structured, {
          reference,
          jurisdiction,
          institution_name: institution.name,
          license_number: institution.license,
          compliance_officer: institution.compliance_officer,
          generated_at: new Date().toISOString(),
        });
      } else {
        // Fallback: use raw AI output if JSON parsing fails
        console.warn(`[sar] Failed to parse structured JSON for ${sar.id}, using raw output`);
        content = rawOutput;
      }

      updateSAR(sar.id, { content, status: "draft" });
      logAudit("sar.generated" as Parameters<typeof logAudit>[0], {
        sar_id: sar.id,
        reference: sar.reference,
        screening_job_id,
        jurisdiction,
        structured: !!structured,
      });
      console.log(`[sar] ${sar.reference} generated (structured: ${!!structured})`);
    } catch (e) {
      console.error(`[sar] ${sar.reference} failed:`, e instanceof Error ? e.message : e);
      updateSAR(sar.id, { status: "draft", content: "" });
    }
  })();

  return response;
}
