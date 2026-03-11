import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { buildIndex, deleteIndex, getIndexStatus } from "@/lib/vectorstore";
import { getSettings } from "@/lib/settings";
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
  const settings = getSettings();
  const apiKey = settings.embedding?.apiKey;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Embedding API key not configured. Set it in Settings." },
      { status: 400 }
    );
  }

  let documentIds: string[] | undefined;
  try {
    const body = await req.json();
    documentIds = body.documentIds;
  } catch { /* empty body is fine */ }

  // Load all docs or filtered set
  const allDocsMeta = [
    ...defaultDocs.map((d) => ({ id: d.id, name: d.name })),
    ...loadUploadsMeta().map((u) => ({ id: u.id as string, name: u.name as string })),
  ];

  const targetIds = documentIds || allDocsMeta.map((d) => d.id);

  const docs: { id: string; name: string; content: string }[] = [];
  for (const id of targetIds) {
    const content = loadDocContent(id);
    const meta = allDocsMeta.find((d) => d.id === id);
    if (content && meta) {
      docs.push({ id, name: meta.name, content });
    }
  }

  if (docs.length === 0) {
    return NextResponse.json({ error: "No documents found to index" }, { status: 400 });
  }

  const model = settings.embedding?.model || "text-embedding-3-small";

  // Fire and forget
  buildIndex(docs, apiKey, model).then((result) => {
    console.log(`[vectors] Index built: ${result.chunkCount} chunks from ${result.docCount} docs`);
  }).catch((error) => {
    console.error("[vectors] Index build failed:", error.message);
  });

  return NextResponse.json(
    {
      message: "Indexing started",
      status: "building",
      chunkCount: 0,
      docCount: docs.length,
    },
    { status: 202 }
  );
}

export async function DELETE() {
  deleteIndex();
  return NextResponse.json({ message: "Index deleted" });
}

export async function GET() {
  return NextResponse.json(getIndexStatus());
}
