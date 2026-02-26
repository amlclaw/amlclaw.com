import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params;

  // Check default docs
  const doc = defaultDocs.find((d) => d.id === docId);
  if (doc) {
    const filepath = path.join(process.cwd(), "references", doc.path);
    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: `File not found: ${doc.path}` }, { status: 404 });
    }
    const content = fs.readFileSync(filepath, "utf-8");
    return NextResponse.json({ id: docId, content });
  }

  // Check uploads
  const uploads = loadUploadsMeta();
  const upload = uploads.find((u) => u.id === docId) as Record<string, unknown> | undefined;
  if (upload) {
    const filepath = path.join(process.cwd(), "data", upload.path as string);
    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: "Uploaded file not found" }, { status: 404 });
    }
    const content = fs.readFileSync(filepath, "utf-8");
    return NextResponse.json({ id: docId, content });
  }

  return NextResponse.json({ error: "Document not found" }, { status: 404 });
}
