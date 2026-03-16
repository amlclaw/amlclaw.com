/**
 * Singleton in-process scheduler for continuous monitoring tasks.
 * Uses node-cron to schedule recurring screening jobs.
 */
import cron, { type ScheduledTask } from "node-cron";
import crypto from "crypto";
import {
  loadMonitorIndex,
  loadMonitor,
  updateMonitor,
  saveMonitorRun,
  findRuleset,
  loadRuleset,
  saveHistoryEntry,
} from "./storage";
import { kyaProDetect } from "./trustin-api";
import { extractRiskPaths, type Rule } from "./extract-risk-paths";
import { getTrustInApiKey } from "./settings";
import { logAudit } from "./audit-log";
import { sendWebhook, shouldAlert } from "./webhook";
import type { MonitorTask, MonitorRun, MonitorRunResult, MonitorRunSummary } from "./types";

// ---------------------------------------------------------------------------
// Schedule Presets
// ---------------------------------------------------------------------------
export const SCHEDULE_PRESETS: Record<string, { cron: string; label: string }> = {
  every_1h:  { cron: "0 * * * *",     label: "Every 1 hour" },
  every_4h:  { cron: "0 */4 * * *",   label: "Every 4 hours" },
  every_8h:  { cron: "0 */8 * * *",   label: "Every 8 hours" },
  every_12h: { cron: "0 */12 * * *",  label: "Every 12 hours" },
  every_24h: { cron: "0 0 * * *",     label: "Every 24 hours" },
};

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------
const activeCronJobs = new Map<string, ScheduledTask>();
const runningTasks = new Set<string>();
let initialized = false;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
export function ensureSchedulerInitialized() {
  if (initialized) return;
  initialized = true;

  const tasks = loadMonitorIndex();
  for (const task of tasks) {
    if (task.enabled) {
      registerCronJob(task);
    }
  }
}

// ---------------------------------------------------------------------------
// Cron Job Management
// ---------------------------------------------------------------------------
export function registerCronJob(task: MonitorTask) {
  // Unregister existing first
  unregisterCronJob(task.id);

  if (!task.enabled || !task.schedule) return;

  if (!cron.validate(task.schedule)) {
    console.error(`[Scheduler] Invalid cron expression for task ${task.id}: ${task.schedule}`);
    return;
  }

  const job = cron.schedule(task.schedule, () => {
    executeMonitorTask(task.id, "scheduled").catch((e) => {
      console.error(`[Scheduler] Error executing task ${task.id}:`, e);
    });
  });

  activeCronJobs.set(task.id, job);

  // Update next_run_at
  const nextRun = computeNextRun(task.schedule);
  if (nextRun) {
    updateMonitor(task.id, { next_run_at: nextRun });
  }
}

export function unregisterCronJob(taskId: string) {
  const existing = activeCronJobs.get(taskId);
  if (existing) {
    existing.stop();
    activeCronJobs.delete(taskId);
  }
}

// ---------------------------------------------------------------------------
// Task Execution
// ---------------------------------------------------------------------------
export async function executeMonitorTask(
  taskId: string,
  trigger: "scheduled" | "manual"
): Promise<MonitorRun | null> {
  // Prevent concurrent runs
  if (runningTasks.has(taskId)) return null;

  const task = loadMonitor(taskId);
  if (!task) return null;

  const apiKey = getTrustInApiKey();

  const { meta, filepath } = findRuleset(task.ruleset_id);
  if (!meta || !filepath) {
    console.error(`[Scheduler] Ruleset not found: ${task.ruleset_id}`);
    return null;
  }
  const rules = loadRuleset(filepath) as Rule[];

  runningTasks.add(taskId);
  updateMonitor(taskId, { running: true });
  logAudit("monitor.run_started", { task_id: taskId, trigger, address_count: task.addresses.length });

  const runId = `run_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const run: MonitorRun = {
    run_id: runId,
    task_id: taskId,
    started_at: new Date().toISOString(),
    status: "running",
    trigger,
    results: [],
  };
  saveMonitorRun(taskId, run);

  const results: MonitorRunResult[] = [];
  let hasError = false;

  for (const addr of task.addresses) {
    try {
      const directionMap: Record<string, string> = { withdrawal: "outflow" };
      const direction = directionMap[task.scenario] || "all";

      const opts = {
        inflowHops: direction === "outflow" ? 0 : task.inflow_hops,
        outflowHops: direction === "inflow" ? 0 : task.outflow_hops,
        maxNodesPerHop: task.max_nodes,
      };
      if (direction === "all") {
        opts.inflowHops = task.inflow_hops;
        opts.outflowHops = task.outflow_hops;
      }

      const apiResult = await kyaProDetect(addr.chain, addr.address, apiKey, opts);

      if (apiResult.error) {
        results.push({
          chain: addr.chain,
          address: addr.address,
          status: "error",
          error: apiResult.error,
        });
        hasError = true;
        continue;
      }

      const graphData = { graph_data: apiResult.details, address: addr.address };
      const { riskEntities, summary, targetFindings, targetTagsRaw } = extractRiskPaths(
        graphData,
        rules,
        Math.max(task.inflow_hops, task.outflow_hops),
        task.scenario
      );

      const selfMatched: string[] = [];
      for (const f of targetFindings) {
        selfMatched.push(...f.matched_rules);
      }

      // Save as a screening history entry (cross-link)
      const jobId = crypto.randomUUID().slice(0, 8);
      const jobData: Record<string, unknown> = {
        status: "completed",
        completed_at: new Date().toISOString(),
        source: "monitor",
        monitor_task_id: taskId,
        monitor_run_id: runId,
        request: {
          chain: addr.chain,
          address: addr.address,
          scenario: task.scenario,
          ruleset: (meta.name as string) || task.ruleset_id,
          ruleset_id: task.ruleset_id,
          inflow_hops: task.inflow_hops,
          outflow_hops: task.outflow_hops,
          max_nodes: task.max_nodes,
        },
        result: {
          target: {
            chain: addr.chain,
            address: addr.address,
            tags: targetTagsRaw || [],
            self_matched_rules: selfMatched,
          },
          scenario: task.scenario,
          summary,
          risk_entities: riskEntities,
          rules_used: rules,
        },
      };
      saveHistoryEntry(jobId, jobData);

      const addrRiskLevel = summary.highest_severity as string || "Low";
      results.push({
        chain: addr.chain,
        address: addr.address,
        status: "completed",
        job_id: jobId,
        risk_level: addrRiskLevel,
        risk_entities_count: riskEntities.length,
      });

      // Webhook alert for high risk
      if (shouldAlert(addrRiskLevel)) {
        sendWebhook("monitor.high_risk", {
          task_id: taskId,
          chain: addr.chain,
          address: addr.address,
          risk_level: addrRiskLevel,
          job_id: jobId,
        });
      }
    } catch (e) {
      results.push({
        chain: addr.chain,
        address: addr.address,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
      hasError = true;
    }
  }

  // Build summary
  const flagged = results.filter((r) => r.risk_entities_count && r.risk_entities_count > 0).length;
  const riskOrder = ["Severe", "High", "Medium", "Low"];
  let highestRisk = "Low";
  for (const r of results) {
    if (r.risk_level && riskOrder.indexOf(r.risk_level) < riskOrder.indexOf(highestRisk)) {
      highestRisk = r.risk_level;
    }
  }

  const runSummary: MonitorRunSummary = {
    total_addresses: task.addresses.length,
    completed: results.filter((r) => r.status === "completed").length,
    flagged,
    highest_risk: highestRisk,
  };

  const completedRun: MonitorRun = {
    ...run,
    completed_at: new Date().toISOString(),
    status: hasError && results.some((r) => r.status === "completed") ? "partial" : hasError ? "error" : "completed",
    results,
    summary: runSummary,
  };
  saveMonitorRun(taskId, completedRun);
  logAudit("monitor.run_completed", {
    task_id: taskId,
    run_id: runId,
    status: completedRun.status,
    flagged: runSummary.flagged,
    highest_risk: highestRisk,
  });

  // Update task
  runningTasks.delete(taskId);
  const nextRun = computeNextRun(task.schedule);
  updateMonitor(taskId, {
    running: false,
    last_run_at: completedRun.completed_at,
    next_run_at: nextRun || undefined,
    last_result_summary: runSummary,
  });

  return completedRun;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
export function isTaskRunning(taskId: string): boolean {
  return runningTasks.has(taskId);
}

export function getSchedulerStatus() {
  return {
    initialized,
    active_jobs: activeCronJobs.size,
    running_tasks: Array.from(runningTasks),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function computeNextRun(cronExpr: string): string | null {
  // Simple estimation for common patterns
  const now = new Date();
  const parts = cronExpr.split(" ");
  if (parts.length !== 5) return null;

  const [min, hour] = parts;

  // "0 */N * * *" → every N hours at minute 0
  const hourMatch = hour.match(/^\*\/(\d+)$/);
  if (min === "0" && hourMatch) {
    const interval = parseInt(hourMatch[1]);
    const currentHour = now.getHours();
    const nextHour = Math.ceil((currentHour + 1) / interval) * interval;
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    if (nextHour >= 24) {
      next.setDate(next.getDate() + 1);
      next.setHours(nextHour % 24);
    } else {
      next.setHours(nextHour);
    }
    return next.toISOString();
  }

  // "0 * * * *" → every hour
  if (min === "0" && hour === "*") {
    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next.toISOString();
  }

  // "0 0 * * *" → daily at midnight
  if (min === "0" && hour === "0") {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next.toISOString();
  }

  // Fallback: next hour
  const next = new Date(now);
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next.toISOString();
}
