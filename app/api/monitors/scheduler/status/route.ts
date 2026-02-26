import { NextResponse } from "next/server";
import { ensureSchedulerInitialized, getSchedulerStatus } from "@/lib/scheduler";

export async function GET() {
  ensureSchedulerInitialized();
  return NextResponse.json(getSchedulerStatus());
}
