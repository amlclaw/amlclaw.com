import { NextResponse } from "next/server";
import { loadHistoryIndex } from "@/lib/storage";

export async function GET() {
  return NextResponse.json(loadHistoryIndex());
}
