import { NextResponse } from "next/server";
import { loadHistoryIndex, historyByType } from "@/lib/storage";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  if (type === "kya" || type === "kyt") {
    return NextResponse.json(historyByType(type));
  }
  return NextResponse.json(loadHistoryIndex());
}
