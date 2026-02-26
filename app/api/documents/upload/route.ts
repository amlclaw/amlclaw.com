import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
const UPLOADS_META_PATH = path.join(UPLOADS_DIR, "_meta.json");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadUploadsMeta(): Record<string, unknown>[] {
  try {
    if (fs.existsSync(UPLOADS_META_PATH)) {
      return JSON.parse(fs.readFileSync(UPLOADS_META_PATH, "utf-8"));
    }
  } catch { /* */ }
  return [];
}

function saveUploadsMeta(meta: Record<string, unknown>[]) {
  ensureDir(UPLOADS_DIR);
  fs.writeFileSync(UPLOADS_META_PATH, JSON.stringify(meta, null, 2), "utf-8");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const name = file.name;
    const ext = name.split(".").pop()?.toLowerCase() || "md";
    if (!["md", "txt"].includes(ext)) {
      return NextResponse.json({ error: "Only .md and .txt files are supported" }, { status: 400 });
    }

    const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${id}.${ext}`;

    ensureDir(UPLOADS_DIR);

    const content = await file.text();
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), content, "utf-8");

    const meta = loadUploadsMeta();
    const docMeta = {
      id,
      name: name.replace(/\.\w+$/, ""),
      category: "User Upload",
      jurisdiction: "Custom",
      icon: "upload",
      path: `uploads/${filename}`,
      type: "upload",
      format: ext,
      uploaded_at: new Date().toISOString(),
    };
    meta.push(docMeta);
    saveUploadsMeta(meta);

    return NextResponse.json(docMeta, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}
