import { NextResponse } from "next/server";
import { loadMonitor, updateMonitor, deleteMonitor } from "@/lib/storage";
import {
  ensureSchedulerInitialized,
  registerCronJob,
  unregisterCronJob,
  SCHEDULE_PRESETS,
  computeNextRun,
} from "@/lib/scheduler";

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
  return NextResponse.json(task);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  ensureSchedulerInitialized();
  const { monitorId } = await params;
  const task = loadMonitor(monitorId);
  if (!task) {
    return NextResponse.json({ detail: "Monitor not found" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.enabled !== undefined) updates.enabled = body.enabled;

  // address monitors
  if (body.tokens !== undefined) updates.tokens = body.tokens;
  if (body.min_amount !== undefined) updates.min_amount = Number(body.min_amount);
  if (body.in_ruleset_id !== undefined) updates.in_ruleset_id = parseInt(body.in_ruleset_id) || 0;
  if (body.out_ruleset_id !== undefined) updates.out_ruleset_id = parseInt(body.out_ruleset_id) || 0;

  // kyt monitors
  if (body.kya_ruleset_id !== undefined) updates.kya_ruleset_id = parseInt(body.kya_ruleset_id) || 0;

  // Handle schedule changes
  if (body.schedule_preset !== undefined || body.schedule !== undefined) {
    const preset = body.schedule_preset || task.schedule_preset;
    let schedule = body.schedule || "";
    if (preset !== "custom" && SCHEDULE_PRESETS[preset]) {
      schedule = SCHEDULE_PRESETS[preset].cron;
    }
    if (schedule) {
      updates.schedule = schedule;
      updates.schedule_preset = preset;
      updates.next_run_at = computeNextRun(schedule) || undefined;
    }
  }

  const updated = updateMonitor(monitorId, updates);
  if (!updated) {
    return NextResponse.json({ detail: "Update failed" }, { status: 500 });
  }

  // Re-register or unregister cron based on enabled state
  if (updated.enabled) {
    registerCronJob(updated);
  } else {
    unregisterCronJob(monitorId);
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ monitorId: string }> }
) {
  ensureSchedulerInitialized();
  const { monitorId } = await params;
  unregisterCronJob(monitorId);
  const deleted = deleteMonitor(monitorId);
  if (!deleted) {
    return NextResponse.json({ detail: "Monitor not found" }, { status: 404 });
  }
  return NextResponse.json({ status: "deleted" });
}
