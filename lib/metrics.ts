/**
 * Runtime metrics — collects observability data from audit log and storage.
 */
import { loadAuditLog, type AuditEvent } from "./audit-log";
import { loadHistoryIndex, loadMonitorIndex } from "./storage";
import { getSettings } from "./settings";
import { getSchedulerStatus } from "./scheduler";

const SYSTEM_START_TIME = new Date().toISOString();

export interface MetricsData {
  system: {
    start_time: string;
    uptime_seconds: number;
    last_screening_at: string | null;
  };
  screening: {
    total: number;
    successful: number;
    failed: number;
    avg_latency_ms: number;
    today: number;
    this_week: number;
  };
  ai: {
    total_calls: number;
    successful: number;
    failed: number;
    by_provider: Record<string, { total: number; successful: number; failed: number }>;
  };
  monitors: {
    total: number;
    active: number;
    paused: number;
    total_addresses: number;
  };
  connections: {
    ai_configured: boolean;
    ai_provider: string;
    trustin_configured: boolean;
    scheduler_active: boolean;
  };
}

export function collectMetrics(): MetricsData {
  // Load all audit events (up to 10k)
  const { events } = loadAuditLog({ limit: 10000 });
  const history = loadHistoryIndex();
  const monitors = loadMonitorIndex();
  const settings = getSettings();
  const scheduler = getSchedulerStatus();

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // --- Screening stats ---
  const screeningCompleted = events.filter((e) => e.action === "screening.completed");
  const screeningErrors = events.filter((e) => e.action === "screening.error");

  // Latency: from screening.started to screening.completed matching by jobId
  const startedMap = new Map<string, number>();
  for (const e of events) {
    if (e.action === "screening.started" && e.details.jobId) {
      startedMap.set(e.details.jobId as string, new Date(e.timestamp).getTime());
    }
  }

  let totalLatency = 0;
  let latencyCount = 0;
  for (const e of screeningCompleted) {
    const jobId = (e.details.jobId ?? e.details.job_id) as string | undefined;
    if (jobId && startedMap.has(jobId)) {
      const latency = new Date(e.timestamp).getTime() - startedMap.get(jobId)!;
      if (latency > 0 && latency < 600000) { // sanity: < 10 min
        totalLatency += latency;
        latencyCount++;
      }
    }
  }

  const screeningsToday = history.filter(
    (h) => h.completed_at && new Date(h.completed_at as string) >= todayStart
  ).length;
  const screeningsThisWeek = history.filter(
    (h) => h.completed_at && new Date(h.completed_at as string) >= weekStart
  ).length;

  const lastScreening = history.length > 0 ? (history[0].completed_at as string) || null : null;

  // --- AI stats from audit log ---
  const aiActions = ["policy.generated", "ruleset.generated"] as const;
  const aiEvents = events.filter((e) =>
    aiActions.some((a) => e.action === a)
  );
  // Count by provider from details
  const byProvider: Record<string, { total: number; successful: number; failed: number }> = {};
  for (const e of aiEvents) {
    const provider = (e.details.provider as string) || "unknown";
    if (!byProvider[provider]) byProvider[provider] = { total: 0, successful: 0, failed: 0 };
    byProvider[provider].total++;
    byProvider[provider].successful++;
  }
  // AI errors are harder to track — approximate from audit
  // For now, all generated events are successes

  const aiTotal = aiEvents.length;

  // --- Monitor stats ---
  const activeMonitors = monitors.filter((m) => m.enabled);
  const pausedMonitors = monitors.filter((m) => !m.enabled);
  const totalAddresses = monitors.reduce((acc, m) => acc + m.addresses.length, 0);

  // --- Connection status ---
  const hasAiKey = !!settings.ai.providers[settings.ai.activeProvider]?.apiKey;
  const hasTrustinKey = !!settings.blockchain.trustinApiKey || !!process.env.TRUSTIN_API_KEY;

  return {
    system: {
      start_time: SYSTEM_START_TIME,
      uptime_seconds: Math.floor((now - new Date(SYSTEM_START_TIME).getTime()) / 1000),
      last_screening_at: lastScreening,
    },
    screening: {
      total: history.length,
      successful: screeningCompleted.length,
      failed: screeningErrors.length,
      avg_latency_ms: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
      today: screeningsToday,
      this_week: screeningsThisWeek,
    },
    ai: {
      total_calls: aiTotal,
      successful: aiTotal,
      failed: 0,
      by_provider: byProvider,
    },
    monitors: {
      total: monitors.length,
      active: activeMonitors.length,
      paused: pausedMonitors.length,
      total_addresses: totalAddresses,
    },
    connections: {
      ai_configured: hasAiKey,
      ai_provider: settings.ai.activeProvider,
      trustin_configured: hasTrustinKey,
      scheduler_active: scheduler.initialized,
    },
  };
}
