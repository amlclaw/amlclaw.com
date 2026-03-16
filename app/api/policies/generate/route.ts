import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { queryAgent } from "@/lib/ai-agent";
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
  const doc = defaultDocs.find((d) => d.id === docId);
  if (doc) {
    const filepath = path.join(process.cwd(), "references", doc.path);
    try { return fs.readFileSync(filepath, "utf-8"); } catch { return null; }
  }
  const uploads = loadUploadsMeta();
  const upload = uploads.find((u) => u.id === docId) as Record<string, unknown> | undefined;
  if (upload) {
    const filepath = path.join(process.cwd(), "data", upload.path as string);
    try { return fs.readFileSync(filepath, "utf-8"); } catch { return null; }
  }
  return null;
}

export async function POST(req: Request) {
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
  const allDocs = [...defaultDocs, ...loadUploadsMeta()];
  const docs: { id: string; name: string; content: string }[] = [];
  for (const id of documentIds) {
    const content = loadDocContent(id);
    const meta = allDocs.find((d) => d.id === id);
    if (content && meta) {
      docs.push({
        id,
        name: (meta as Record<string, unknown>).name as string || id,
        content,
      });
    }
  }

  if (docs.length === 0) {
    return NextResponse.json({ error: "No document content found" }, { status: 400 });
  }

  // Mark policy as generating
  updatePolicy(policyId, {
    status: "generating",
    updated_at: new Date().toISOString(),
  });

  // Build prompt — single call, no batching (1M context)
  const docText = docs.map((d) => `## ${d.name}\n\n${d.content}`).join("\n\n---\n\n");
  const prompt = loadPrompt("generate-policy", {
    JURISDICTION: jurisdiction || "General",
    DOCUMENTS: docText,
  });

  // Fire and forget
  queryAgent({
    jobId: `policy_gen_${policyId}`,
    jobType: "generate-policy",
    prompt,
    maxTurns: 3,
    disallowedTools: ["Bash", "Edit", "Write", "Read"],
  }).then((output) => {
    updatePolicy(policyId, {
      content: output,
      status: "ready",
      updated_at: new Date().toISOString(),
    });
    console.log(`[generate] Policy ${policyId} completed`);
  }).catch((error) => {
    updatePolicy(policyId, {
      status: "error",
      updated_at: new Date().toISOString(),
    });
    console.error(`[generate] Policy ${policyId} failed:`, error.message);
  });

  return NextResponse.json(
    {
      message: "Generation started",
      policyId,
      status: "generating",
      totalDocs: docs.length,
    },
    { status: 202 }
  );
}
