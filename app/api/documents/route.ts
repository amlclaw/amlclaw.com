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

export async function GET() {
  const uploads = loadUploadsMeta();
  const all = [...defaultDocs, ...uploads];
  return NextResponse.json(all);
}
