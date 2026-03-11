import { NextResponse } from "next/server";
import { collectMetrics } from "@/lib/metrics";

export async function GET() {
  const metrics = collectMetrics();
  return NextResponse.json(metrics);
}
