import { NextResponse } from "next/server";
import { loadHistoryIndex, loadMonitorIndex } from "@/lib/storage";
import { getSchedulerStatus } from "@/lib/scheduler";
import { getSettings, getWidthApiKey } from "@/lib/settings";

export async function GET() {
  const history = loadHistoryIndex();
  const monitors = loadMonitorIndex();
  const scheduler = getSchedulerStatus();
  const settings = getSettings();

  // Recent screenings (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentScreenings = history.filter((h) => h.completed_at >= weekAgo);

  // Risk distribution (v3 vocabulary)
  const riskDistribution: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const h of recentScreenings) {
    const level = (h.risk_level || "low").toLowerCase();
    riskDistribution[level] = (riskDistribution[level] || 0) + 1;
  }

  const kyaCount = history.filter((h) => h.type === "kya").length;
  const kytCount = history.filter((h) => h.type === "kyt").length;

  const addressMonitors = monitors.filter((m) => m.type === "address");
  const kytMonitors = monitors.filter((m) => m.type === "kyt");

  // Recent high-risk alerts
  const recentAlerts = history
    .filter((h) => ["critical", "high"].includes((h.risk_level || "").toLowerCase()))
    .slice(0, 8);

  return NextResponse.json({
    stats: {
      total_screenings: history.length,
      screenings_this_week: recentScreenings.length,
      kya_count: kyaCount,
      kyt_count: kytCount,
      address_monitors_active: addressMonitors.filter((m) => m.enabled).length,
      address_monitors_total: addressMonitors.length,
      kyt_monitors_active: kytMonitors.filter((m) => m.enabled).length,
      kyt_monitors_total: kytMonitors.length,
    },
    risk_distribution: riskDistribution,
    recent_screenings: history.slice(0, 10),
    recent_alerts: recentAlerts,
    api_status: {
      width_configured: !!getWidthApiKey(),
      etherscan_configured: !!settings.api.etherscanApiKey,
      trongrid_configured: !!settings.api.trongridApiKey,
      scheduler_active: scheduler.initialized,
      scheduler_jobs: scheduler.active_jobs,
    },
  });
}
