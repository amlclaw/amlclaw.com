import { NextResponse } from "next/server";
import { loadMonitorRuns } from "@/lib/storage";
import { ensureSchedulerInitialized } from "@/lib/scheduler";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  ensureSchedulerInitialized();
  const { monitorId } = await params;
  const runs = loadMonitorRuns(monitorId, 50);
  return NextResponse.json(runs);
}
