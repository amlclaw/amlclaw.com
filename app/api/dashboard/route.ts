import { NextResponse } from "next/server";
import { loadHistoryIndex, loadMonitorIndex, loadAllPolicies, getAllRulesets } from "@/lib/storage";
import { getSchedulerStatus } from "@/lib/scheduler";
import { getSettings } from "@/lib/settings";

export async function GET() {
  const history = loadHistoryIndex();
  const monitors = loadMonitorIndex();
  const policies = loadAllPolicies();
  const rulesets = getAllRulesets();
  const scheduler = getSchedulerStatus();
  const settings = getSettings();

  // Recent screenings (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentScreenings = history.filter(
    (h) => (h.completed_at as string) >= weekAgo
  );

  // Risk distribution
  const riskDistribution: Record<string, number> = { Severe: 0, High: 0, Medium: 0, Low: 0 };
  for (const h of recentScreenings) {
    const level = (h.risk_level as string) || "Low";
    riskDistribution[level] = (riskDistribution[level] || 0) + 1;
  }

  // Active monitors
  const activeMonitors = monitors.filter((m) => m.enabled);
  const runningMonitors = monitors.filter((m) => m.running);

  // Total monitored addresses
  const monitoredAddresses = monitors.reduce(
    (acc, m) => acc + m.addresses.length,
    0
  );

  // API status
  const hasAiKey = !!settings.ai.oauthToken;
  const hasTrustinKey = !!settings.blockchain.trustinApiKey || !!process.env.TRUSTIN_API_KEY;

  return NextResponse.json({
    stats: {
      total_screenings: history.length,
      screenings_this_week: recentScreenings.length,
      policies_count: policies.length,
      rulesets_count: rulesets.length,
      monitors_active: activeMonitors.length,
      monitors_running: runningMonitors.length,
      monitored_addresses: monitoredAddresses,
    },
    risk_distribution: riskDistribution,
    recent_screenings: history.slice(0, 10),
    api_status: {
      ai_configured: hasAiKey,
      ai_provider: "claude-code-sdk",
      trustin_configured: hasTrustinKey,
      scheduler_active: scheduler.initialized,
      scheduler_jobs: scheduler.active_jobs,
    },
  });
}
