import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const UPLOADS_META_PATH = path.join(UPLOADS_DIR, "_meta.json");

function loadUploadsMeta(): Record<string, unknown>[] {
  try {
    if (fs.existsSync(UPLOADS_META_PATH)) {
      return JSON.parse(fs.readFileSync(UPLOADS_META_PATH, "utf-8"));
    }
  } catch { /* */ }
  return [];
}

function saveUploadsMeta(meta: Record<string, unknown>[]) {
  fs.writeFileSync(UPLOADS_META_PATH, JSON.stringify(meta, null, 2), "utf-8");
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params;
  const meta = loadUploadsMeta();
  const idx = meta.findIndex((u) => u.id === docId);
  if (idx === -1) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const upload = meta[idx];
  const filepath = path.join(process.cwd(), "data", upload.path as string);
  try {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch { /* */ }

  meta.splice(idx, 1);
  saveUploadsMeta(meta);

  return NextResponse.json({ ok: true });
}
