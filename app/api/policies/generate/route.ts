import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { spawnAI } from "@/lib/ai";
import { loadPrompt } from "@/lib/prompts";
import { updatePolicy } from "@/lib/storage";
import { getIndexStatus, searchChunks } from "@/lib/vectorstore";
import { getSettings } from "@/lib/settings";
import defaultDocs from "@/data/documents.json";

const UPLOADS_META_PATH = path.join(process.cwd(), "data", "uploads", "_meta.json");

// ~40K chars ≈ ~10K tokens per batch, safe for all providers
const MAX_BATCH_CHARS = 40_000;

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

interface DocEntry {
  id: string;
  name: string;
  content: string;
}

/**
 * Split documents into batches that fit within token limits
 */
function batchDocuments(docs: DocEntry[]): DocEntry[][] {
  const batches: DocEntry[][] = [];
  let currentBatch: DocEntry[] = [];
  let currentSize = 0;

  // Sort by size — small docs first, so they batch together
  const sorted = [...docs].sort((a, b) => a.content.length - b.content.length);

  for (const doc of sorted) {
    // If single doc exceeds limit, truncate it and give it its own batch
    if (doc.content.length > MAX_BATCH_CHARS) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }
      const truncated = {
        ...doc,
        content: doc.content.slice(0, MAX_BATCH_CHARS) +
          `\n\n[... Document truncated at ${MAX_BATCH_CHARS.toLocaleString()} characters. Original: ${doc.content.length.toLocaleString()} characters.]`,
      };
      batches.push([truncated]);
      continue;
    }

    if (currentSize + doc.content.length > MAX_BATCH_CHARS && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push(doc);
    currentSize += doc.content.length;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Run multi-batch generation: generate per batch, then merge
 */
async function runBatchGeneration(
  policyId: string,
  docs: DocEntry[],
  jurisdiction: string
): Promise<void> {
  const batches = batchDocuments(docs);
  console.log(`[generate] Policy ${policyId}: ${docs.length} docs, ${batches.length} batch(es)`);

  if (batches.length === 1) {
    // Single batch — direct generation
    const docText = batches[0].map((d) => `## ${d.name}\n\n${d.content}`).join("\n\n---\n\n");
    const prompt = loadPrompt("generate-policy", {
      JURISDICTION: jurisdiction,
      DOCUMENTS: docText,
    });

    return new Promise((resolve, reject) => {
      spawnAI({
        jobId: `policy_gen_${policyId}`,
        jobType: "generate-policy",
        prompt,
        onData: () => {},
        onComplete: (output) => {
          updatePolicy(policyId, {
            content: output,
            status: "ready",
            updated_at: new Date().toISOString(),
          });
          console.log(`[generate] Policy ${policyId} completed (single batch)`);
          resolve();
        },
        onError: (error) => {
          console.error(`[generate] Policy ${policyId} failed:`, error);
          reject(new Error(error));
        },
      });
    });
  }

  // Multi-batch: generate partial policies, then merge
  const partialPolicies: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const docNames = batch.map((d) => d.name).join(", ");
    console.log(`[generate] Policy ${policyId}: batch ${i + 1}/${batches.length} (${docNames})`);

    const docText = batch.map((d) => `## ${d.name}\n\n${d.content}`).join("\n\n---\n\n");
    const prompt = loadPrompt("generate-policy", {
      JURISDICTION: jurisdiction,
      DOCUMENTS: docText,
    });

    const partial = await new Promise<string>((resolve, reject) => {
      spawnAI({
        jobId: `policy_gen_${policyId}_batch${i}`,
        jobType: "generate-policy",
        prompt,
        onData: () => {},
        onComplete: (output) => {
          console.log(`[generate] Batch ${i + 1}/${batches.length} done (${output.length} chars)`);
          resolve(output);
        },
        onError: (error) => {
          console.error(`[generate] Batch ${i + 1} failed:`, error);
          reject(new Error(error));
        },
      });
    });

    partialPolicies.push(partial);
  }

  // Merge step
  console.log(`[generate] Policy ${policyId}: merging ${partialPolicies.length} partial policies`);

  const mergePrompt = `You are an expert AML Compliance Documentation Writer.

Below are ${partialPolicies.length} partial compliance policies generated from different regulatory documents for the **${jurisdiction}** jurisdiction. Merge them into a single, comprehensive, well-structured AML/CFT Compliance Policy.

**Instructions:**
- Combine all sections logically. Remove duplicates.
- Keep all regulatory references and section numbers.
- Follow this structure: Executive Summary, Regulatory Scope, Risk Appetite & Sanctions, CDD/KYC, Transaction Monitoring (Inflow), Transaction Monitoring (Outflow), Travel Rule, Ongoing Monitoring & Reporting, Record Keeping, Escalation Matrix.
- Output clean Markdown.

${partialPolicies.map((p, i) => `---\n\n## Partial Policy ${i + 1}\n\n${p}`).join("\n\n")}`;

  return new Promise((resolve, reject) => {
    spawnAI({
      jobId: `policy_gen_${policyId}_merge`,
      jobType: "generate-policy",
      prompt: mergePrompt,
      onData: () => {},
      onComplete: (output) => {
        updatePolicy(policyId, {
          content: output,
          status: "ready",
          updated_at: new Date().toISOString(),
        });
        console.log(`[generate] Policy ${policyId} completed (merged ${partialPolicies.length} batches)`);
        resolve();
      },
      onError: (error) => {
        console.error(`[generate] Policy ${policyId} merge failed:`, error);
        reject(new Error(error));
      },
    });
  });
}

/**
 * RAG-based generation: use vector search to find relevant chunks, single AI call.
 */
async function runRAGGeneration(
  policyId: string,
  documentIds: string[],
  jurisdiction: string
): Promise<void> {
  const settings = getSettings();
  const apiKey = settings.embedding?.apiKey;
  if (!apiKey) throw new Error("Embedding API key not configured");

  const query = `AML CFT compliance policy for ${jurisdiction}: customer due diligence KYC, transaction monitoring, sanctions screening, travel rule, suspicious transaction reporting, record keeping, risk assessment`;

  const results = await searchChunks(query, apiKey, 30, documentIds, settings.embedding?.model);

  if (results.length === 0) {
    throw new Error("No relevant chunks found");
  }

  // Assemble context from retrieved chunks
  const contextParts = results.map((r) => {
    const header = r.chunk.heading ? `### ${r.chunk.docName} — ${r.chunk.heading}` : `### ${r.chunk.docName}`;
    return `${header}\n\n${r.chunk.content}`;
  });
  const docText = contextParts.join("\n\n---\n\n");

  const prompt = loadPrompt("generate-policy", {
    JURISDICTION: jurisdiction,
    DOCUMENTS: docText,
  });

  return new Promise((resolve, reject) => {
    spawnAI({
      jobId: `policy_gen_${policyId}`,
      jobType: "generate-policy",
      prompt,
      onData: () => {},
      onComplete: (output) => {
        updatePolicy(policyId, {
          content: output,
          status: "ready",
          updated_at: new Date().toISOString(),
        });
        console.log(`[generate] Policy ${policyId} completed (RAG, ${results.length} chunks)`);
        resolve();
      },
      onError: (error) => {
        console.error(`[generate] Policy ${policyId} RAG failed:`, error);
        reject(new Error(error));
      },
    });
  });
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
  const docs: DocEntry[] = [];
  const allDocs = [...defaultDocs, ...loadUploadsMeta()];
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

  const totalChars = docs.reduce((sum, d) => sum + d.content.length, 0);
  const batches = batchDocuments(docs);
  console.log(`[generate] Starting: ${docs.length} docs, ${totalChars.toLocaleString()} chars, ${batches.length} batch(es)`);

  // Mark policy as generating
  updatePolicy(policyId, {
    status: "generating",
    updated_at: new Date().toISOString(),
  });

  // Fire and forget — use RAG if index exists, otherwise batch
  const indexStatus = getIndexStatus();
  const generateFn = indexStatus.indexed
    ? () => runRAGGeneration(policyId, documentIds, jurisdiction || "General")
    : () => runBatchGeneration(policyId, docs, jurisdiction || "General");

  generateFn().catch((error) => {
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
      batches: batches.length,
      totalDocs: docs.length,
    },
    { status: 202 }
  );
}
