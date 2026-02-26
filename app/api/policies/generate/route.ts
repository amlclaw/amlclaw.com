import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawnClaude, isAIBusy } from "@/lib/claude";
import { loadPrompt } from "@/lib/prompts";
import { updatePolicy } from "@/lib/storage";
import defaultDocs from "@/data/documents.json";

const UPLOADS_META_PATH = path.join(process.cwd(), "data", "uploads", "_meta.json");

function loadUploadsMeta(): Record<string, unknown>[] {
  try {
    if (fs.existsSync(UPLOADS_META_PATH)) {
      return JSON.parse(fs.readFileSync(UPLOADS_META_PATH, "utf-8"));
    }
  } catch { /* */ }
  return [];
}

function loadDocContent(docId: string): string | null {
  // Check defaults
  const doc = defaultDocs.find((d) => d.id === docId);
  if (doc) {
    const filepath = path.join(process.cwd(), "references", doc.path);
    try { return fs.readFileSync(filepath, "utf-8"); } catch { return null; }
  }
  // Check uploads
  const uploads = loadUploadsMeta();
  const upload = uploads.find((u) => u.id === docId) as Record<string, unknown> | undefined;
  if (upload) {
    const filepath = path.join(process.cwd(), "data", upload.path as string);
    try { return fs.readFileSync(filepath, "utf-8"); } catch { return null; }
  }
  return null;
}

export async function POST(req: Request) {
  if (isAIBusy()) {
    return NextResponse.json({ error: "AI is currently busy with another task" }, { status: 409 });
  }

  const body = await req.json();
  const { policyId, documentIds, jurisdiction } = body as {
    policyId: string;
    documentIds: string[];
    jurisdiction: string;
  };

  if (!policyId || !documentIds?.length) {
    return NextResponse.json({ error: "policyId and documentIds are required" }, { status: 400 });
  }

  // Load document contents
  const docContents: string[] = [];
  const allDocs = [...defaultDocs, ...loadUploadsMeta()];
  for (const id of documentIds) {
    const content = loadDocContent(id);
    const meta = allDocs.find((d) => d.id === id);
    if (content && meta) {
      docContents.push(`## ${(meta as Record<string, unknown>).name || id}\n\n${content}`);
    }
  }

  if (docContents.length === 0) {
    return NextResponse.json({ error: "No document content found" }, { status: 400 });
  }

  const prompt = loadPrompt("generate-policy", {
    JURISDICTION: jurisdiction || "General",
    DOCUMENTS: docContents.join("\n\n---\n\n"),
  });

  // SSE stream
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
        jobId: `policy_gen_${policyId}`,
        jobType: "generate-policy",
        prompt,
        onData: (chunk) => {
          safeSend(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        },
        onComplete: (finalOutput) => {
          updatePolicy(policyId, {
            content: finalOutput,
            status: "ready",
            updated_at: new Date().toISOString(),
          });
          safeSend(`event: done\ndata: ${JSON.stringify({ id: policyId })}\n\n`);
          safeClose();
        },
        onError: (error) => {
          updatePolicy(policyId, { status: "error" });
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
