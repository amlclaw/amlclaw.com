import { queryAgentStream } from "@/lib/ai-agent";
import { loadPrompt } from "@/lib/prompts";
import { loadHistoryJob } from "@/lib/storage";
import { createSAR, getNextReference, updateSAR } from "@/lib/sar-storage";
import { logAudit } from "@/lib/audit-log";
import { getSettings } from "@/lib/settings";

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

  // Load prompt template
  const promptName = `sar-${jurisdiction}`;
  let prompt: string;
  try {
    prompt = loadPrompt(promptName, {
      screening_data: JSON.stringify(job, null, 2),
      institution_info: JSON.stringify(institution, null, 2),
      reference_id: reference,
    });
  } catch {
    prompt = loadPrompt("sar-generic", {
      screening_data: JSON.stringify(job, null, 2),
      institution_info: JSON.stringify(institution, null, 2),
      reference_id: reference,
    });
  }

  // Stream response via SSE — preserve named event format
  const encoder = new TextEncoder();
  let closed = false;

  const safeSend = (controller: ReadableStreamDefaultController, event: string, data: Record<string, unknown>) => {
    if (closed) return;
    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch { /* controller already closed */ }
  };

  const safeClose = (controller: ReadableStreamDefaultController) => {
    if (closed) return;
    closed = true;
    try { controller.close(); } catch { /* already closed */ }
  };

  const stream = new ReadableStream({
    async start(controller) {
      let fullOutput = "";
      try {
        for await (const delta of queryAgentStream({
          jobId: `sar_gen_${sar.id}`,
          jobType: "generate-sar",
          prompt,
        })) {
          fullOutput += delta.text;
          safeSend(controller, "data", { text: delta.text });
        }

        updateSAR(sar.id, { content: fullOutput, status: "draft" });
        logAudit("sar.generated" as Parameters<typeof logAudit>[0], {
          sar_id: sar.id,
          reference: sar.reference,
          screening_job_id,
          jurisdiction,
        });
        safeSend(controller, "done", { id: sar.id, reference: sar.reference });
      } catch (e) {
        updateSAR(sar.id, { status: "draft", content: "" });
        safeSend(controller, "error", { error: e instanceof Error ? e.message : String(e) });
      } finally {
        safeClose(controller);
      }
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
