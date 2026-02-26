import { NextResponse } from "next/server";
import { loadMonitorIndex, createMonitor } from "@/lib/storage";
import { ensureSchedulerInitialized, registerCronJob, SCHEDULE_PRESETS, computeNextRun } from "@/lib/scheduler";
import type { MonitorTask, MonitorAddress } from "@/lib/types";
import crypto from "crypto";

export async function GET() {
  ensureSchedulerInitialized();
  const tasks = loadMonitorIndex();
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  ensureSchedulerInitialized();

  const body = await req.json();
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ detail: "Name is required" }, { status: 400 });
  }

  // Parse addresses
  const rawAddresses: unknown[] = body.addresses || [];
  if (!Array.isArray(rawAddresses) || rawAddresses.length === 0) {
    return NextResponse.json({ detail: "At least one address is required" }, { status: 400 });
  }
  if (rawAddresses.length > 20) {
    return NextResponse.json({ detail: "Maximum 20 addresses per task" }, { status: 400 });
  }

  const defaultChain = body.default_chain || "Tron";
  const addresses: MonitorAddress[] = rawAddresses.map((a) => {
    if (typeof a === "object" && a !== null && "address" in a) {
      const obj = a as Record<string, string>;
      return { chain: obj.chain || defaultChain, address: obj.address };
    }
    const str = String(a);
    if (str.includes(":")) {
      const [chain, address] = str.split(":", 2);
      return { chain, address };
    }
    return { chain: defaultChain, address: str };
  });

  // Resolve schedule
  const schedulePreset = body.schedule_preset || "every_4h";
  let schedule = body.schedule || "";
  if (schedulePreset !== "custom" && SCHEDULE_PRESETS[schedulePreset]) {
    schedule = SCHEDULE_PRESETS[schedulePreset].cron;
  }
  if (!schedule) {
    return NextResponse.json({ detail: "Schedule is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = `mon_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;

  const task: MonitorTask = {
    id,
    name,
    addresses,
    scenario: body.scenario || "deposit",
    ruleset_id: body.ruleset_id || "singapore_mas",
    inflow_hops: parseInt(body.inflow_hops || "3"),
    outflow_hops: parseInt(body.outflow_hops || "3"),
    max_nodes: parseInt(body.max_nodes || "100"),
    schedule,
    schedule_preset: schedulePreset,
    enabled: body.enabled !== false,
    created_at: now,
    updated_at: now,
    running: false,
    next_run_at: computeNextRun(schedule) || undefined,
  };

  createMonitor(task);

  if (task.enabled) {
    registerCronJob(task);
  }

  return NextResponse.json(task, { status: 201 });
}
