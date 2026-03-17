import { NextResponse } from "next/server";
import { listCases } from "@/lib/case-storage";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as "open" | "under_review" | "closed" | null;
  const cases = listCases(status || undefined);
  return NextResponse.json(cases);
}
