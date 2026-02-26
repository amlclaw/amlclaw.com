import { NextResponse } from "next/server";
import { loadMonitor } from "@/lib/storage";
import { ensureSchedulerInitialized, isTaskRunning, executeMonitorTask } from "@/lib/scheduler";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  ensureSchedulerInitialized();
  const { monitorId } = await params;

  const task = loadMonitor(monitorId);
  if (!task) {
    return NextResponse.json({ detail: "Monitor not found" }, { status: 404 });
  }

  if (isTaskRunning(monitorId)) {
    return NextResponse.json({ detail: "Task is already running" }, { status: 409 });
  }

  // Fire-and-forget
  executeMonitorTask(monitorId, "manual").catch((e) => {
    console.error(`[Monitor] Manual run error for ${monitorId}:`, e);
  });

  return NextResponse.json({ status: "started" });
}
