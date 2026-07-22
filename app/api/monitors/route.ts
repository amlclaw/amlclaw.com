import { NextResponse } from "next/server";
import { loadMonitorIndex, createMonitor } from "@/lib/storage";
import { ensureSchedulerInitialized, registerCronJob, SCHEDULE_PRESETS, computeNextRun } from "@/lib/scheduler";
import { initCursor, resolveTxEndpoints, supportedTokens } from "@/lib/chain-txs";
import { getSettings } from "@/lib/settings";
import type { MonitorTask, MonitorType } from "@/lib/types";
import crypto from "crypto";

export async function GET(req: Request) {
  ensureSchedulerInitialized();
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  let tasks = loadMonitorIndex();
  if (type === "address" || type === "kyt") {
    tasks = tasks.filter((t) => t.type === type);
  }
  return NextResponse.json(tasks);
}

/**
 * Create a monitor.
 *
 * type "address": { chain, address, tokens?, min_amount?, in_ruleset_id?, out_ruleset_id? }
 *   — watches the address's FUTURE transfers; each new tx is KYT-screened
 *     (receiving = in, sending = out). Cursor starts at "now".
 *
 * type "kyt": { chain, tx_id, watch_side: "from"|"to", kya_ruleset_id? }
 *   — resolves the tx's from/to address and periodically KYA-screens it.
 */
export async function POST(req: Request) {
  ensureSchedulerInitialized();
  const settings = getSettings();

  const body = await req.json();
  const type: MonitorType = body.type === "kyt" ? "kyt" : "address";
  const chain = body.chain || "Tron";

  // Resolve schedule
  const schedulePreset = body.schedule_preset || settings.monitoring.defaultSchedule || "every_4h";
  let schedule = body.schedule || "";
  if (schedulePreset !== "custom" && SCHEDULE_PRESETS[schedulePreset]) {
    schedule = SCHEDULE_PRESETS[schedulePreset].cron;
  }
  if (!schedule) {
    return NextResponse.json({ detail: "Schedule is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = `mon_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;

  let task: MonitorTask;

  if (type === "address") {
    const address = (body.address || "").trim();
    if (!address) {
      return NextResponse.json({ detail: "Address is required" }, { status: 400 });
    }

    const allowed = supportedTokens(chain);
    const tokens: string[] = Array.isArray(body.tokens) && body.tokens.length
      ? body.tokens.filter((t: string) => allowed.includes(t))
      : allowed;
    if (!tokens.length) {
      return NextResponse.json({ detail: `No supported tokens for ${chain}` }, { status: 400 });
    }

    let cursor;
    try {
      cursor = await initCursor(chain);
    } catch (e) {
      return NextResponse.json(
        { detail: `Failed to initialize chain cursor: ${e instanceof Error ? e.message : e}` },
        { status: 502 },
      );
    }

    task = {
      id,
      type,
      name: (body.name || "").trim() || `${chain} ${address.slice(0, 8)}… txs`,
      chain,
      address,
      tokens,
      min_amount: Number(body.min_amount ?? settings.monitoring.defaultMinAmount ?? 1),
      cursor,
      in_ruleset_id: parseInt(String(body.in_ruleset_id ?? 0)) || 0,
      out_ruleset_id: parseInt(String(body.out_ruleset_id ?? 0)) || 0,
      schedule,
      schedule_preset: schedulePreset,
      enabled: body.enabled !== false,
      created_at: now,
      updated_at: now,
      running: false,
      next_run_at: computeNextRun(schedule) || undefined,
    };
  } else {
    const txId = (body.tx_id || "").trim();
    const watchSide: "from" | "to" = body.watch_side === "to" ? "to" : "from";
    if (!txId) {
      return NextResponse.json({ detail: "Transaction hash is required" }, { status: 400 });
    }

    // Resolve the watched address from the tx endpoints
    let address = (body.address || "").trim();
    if (!address) {
      try {
        const endpoints = await resolveTxEndpoints(chain, txId);
        address = watchSide === "from" ? endpoints.from : endpoints.to;
      } catch (e) {
        return NextResponse.json(
          { detail: `Failed to resolve tx endpoints: ${e instanceof Error ? e.message : e}` },
          { status: 502 },
        );
      }
    }

    task = {
      id,
      type,
      name: (body.name || "").trim() || `KYA ${watchSide} of ${txId.slice(0, 10)}…`,
      chain,
      address,
      origin_tx_id: txId,
      watch_side: watchSide,
      kya_ruleset_id: parseInt(String(body.kya_ruleset_id ?? 0)) || 0,
      last_risk_level: "low",
      schedule,
      schedule_preset: schedulePreset,
      enabled: body.enabled !== false,
      created_at: now,
      updated_at: now,
      running: false,
      next_run_at: computeNextRun(schedule) || undefined,
    };
  }

  createMonitor(task);

  if (task.enabled) {
    registerCronJob(task);
  }

  return NextResponse.json(task, { status: 201 });
}
