import { NextResponse } from "next/server";
import { loadMonitor } from "@/lib/storage";
import { loadMonitorTxs, ledgerStats } from "@/lib/monitor-txs";
import { ensureSchedulerInitialized } from "@/lib/scheduler";

/** Transaction ledger of an address monitor (tronscan-style table data). */
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
  return NextResponse.json({
    stats: ledgerStats(monitorId),
    txs: loadMonitorTxs(monitorId).slice(0, 200),
  });
}
