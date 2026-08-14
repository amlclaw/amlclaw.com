import { NextResponse } from "next/server";
import { loadMonitor, loadMonitorRuns } from "@/lib/storage";
import { ensureSchedulerInitialized } from "@/lib/scheduler";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  ensureSchedulerInitialized();
  const { monitorId } = await params;

  const task = loadMonitor(monitorId);
  if (!task) {
    return NextResponse.json({ detail: "Monitor not found" }, { status: 404 });
  }

  const runs = loadMonitorRuns(monitorId, 50);
  return NextResponse.json(runs);
}
