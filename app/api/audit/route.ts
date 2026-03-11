import { NextResponse } from "next/server";
import { loadAuditLog } from "@/lib/audit-log";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const action = url.searchParams.get("action") || undefined;

  const result = loadAuditLog({ limit, offset, action });
  return NextResponse.json(result);
}
