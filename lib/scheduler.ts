/**
 * Singleton in-process scheduler for the two monitoring modules.
 *
 * Both monitor types watch FUTURE activity:
 *  - "address" monitors: each cycle pulls the address's NEW stablecoin
 *    transfers (Etherscan/TronGrid), filters by amount, and KYT-screens each
 *    tx — receiving = screen_direction "in", sending = "out".
 *  - "kyt" monitors: each cycle runs a KYA screen of the watched counterparty
 *    address (from/to of the origin tx) and alerts on risk escalation.
 */
import cron, { type ScheduledTask } from "node-cron";
import crypto from "crypto";
import {
  loadMonitorIndex,
  loadMonitor,
  updateMonitor,
  saveMonitorRun,
  saveHistoryEntry,
} from "./storage";
import { kyaScreen, kytScreen, riskRank, normalizeRisk, screenTimeoutMs } from "./width-api";
import { fetchNewTxs } from "./chain-txs";
import {
  appendMonitorTxs,
  txsDueForScreening,
  updateMonitorTx,
  ledgerStats,
  MAX_KYT_RETRIES,
} from "./monitor-txs";
import { getSettings } from "./settings";
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
// Singleton state — MUST live on globalThis. In Next.js dev, every HMR reload
// and every route bundle instantiates this module again; module-level state
// would register duplicate cron jobs whose concurrent runs race on the tx
// ledger and cursor (observed: 4 simultaneous runs clobbering the ledger).
// ---------------------------------------------------------------------------
interface SchedulerState {
  activeCronJobs: Map<string, ScheduledTask>;
  runningTasks: Set<string>;
  initialized: boolean;
  /**
   * Global single-lane queue for monitor runs. The width API has limited
   * concurrency, so runs execute strictly one after another — when several
   * cron jobs fire at the same tick (e.g. all every_1h monitors at :00),
   * they line up here instead of screening in parallel. Within a run each
   * tx is also screened sequentially (await response, pause, next).
   */
  runChain: Promise<void>;
}

const g = globalThis as unknown as { __amlclawScheduler?: SchedulerState };
const sched: SchedulerState = (g.__amlclawScheduler ??= {
  activeCronJobs: new Map(),
  runningTasks: new Set(),
  initialized: false,
  runChain: Promise.resolve(),
});
const activeCronJobs = sched.activeCronJobs;
const runningTasks = sched.runningTasks;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
export function ensureSchedulerInitialized() {
  if (sched.initialized) return;
  sched.initialized = true;

  const tasks = loadMonitorIndex();
  const now = Date.now();
  for (const task of tasks) {
    if (!task.enabled) continue;
    registerCronJob(task);
    // Catch-up: cron only fires while the process is alive, so a monitor whose
    // scheduled slot passed during downtime would silently skip a cycle.
    // Queue one run now (the global lane keeps them sequential).
    if (task.next_run_at && new Date(task.next_run_at).getTime() < now) {
      executeMonitorTask(task.id, "scheduled").catch((e) => {
        console.error(`[Scheduler] Catch-up run failed for ${task.id}:`, e);
      });
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
export function executeMonitorTask(
  taskId: string,
  trigger: "scheduled" | "manual",
  screenOnly = false,
): Promise<MonitorRun | null> {
  // Dedupe: task already queued or running → skip this trigger
  if (runningTasks.has(taskId)) return Promise.resolve(null);
  runningTasks.add(taskId);

  // Enqueue on the global single-lane queue — strictly one run at a time
  const result = sched.runChain.then(() => runMonitorTaskNow(taskId, trigger, screenOnly));
  sched.runChain = result.then(
    () => undefined,
    (e) => { console.error(`[Scheduler] Run failed for ${taskId}:`, e); },
  );
  return result.finally(() => runningTasks.delete(taskId));
}

async function runMonitorTaskNow(
  taskId: string,
  trigger: "scheduled" | "manual",
  screenOnly = false,
): Promise<MonitorRun | null> {
  const task = loadMonitor(taskId);
  if (!task) return null;

  updateMonitor(taskId, { running: true });

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

  let results: MonitorRunResult[] = [];
  let summary: MonitorRunSummary;
  let hasError = false;

  try {
    if (task.type === "address") {
      ({ results, summary } = await runAddressMonitor(task, runId, screenOnly));
    } else {
      ({ results, summary } = await runKytMonitor(task, runId));
    }
    hasError = results.some((r) => r.status === "error");
  } catch (e) {
    hasError = true;
    results.push({
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    });
    summary = { new_txs: 0, screened: 0, skipped: 0, flagged: 0, highest_risk: "low" };
  }

  const completedRun: MonitorRun = {
    ...run,
    completed_at: new Date().toISOString(),
    status: hasError && results.some((r) => r.status === "completed") ? "partial" : hasError ? "error" : "completed",
    results,
    summary,
  };
  saveMonitorRun(taskId, completedRun);

  // Update task (runningTasks cleanup happens in the queue wrapper)
  const nextRun = computeNextRun(task.schedule);
  updateMonitor(taskId, {
    running: false,
    last_run_at: completedRun.completed_at,
    next_run_at: nextRun || undefined,
    last_result_summary: summary,
  });

  return completedRun;
}

// ---------------------------------------------------------------------------
// Address monitor — new txs land in a per-monitor ledger, then get KYT-screened.
// Failed screens stay in the ledger and are retried on later runs.
// ---------------------------------------------------------------------------

/** Pause between consecutive KYT screens to avoid hammering the width API. */
const SCREEN_INTERVAL_MS = 2_000;

/**
 * Trace depth for all monitoring screens (address-monitor KYT per tx and
 * KYT-monitor KYA re-screens). Monitoring cares about the subject's own
 * labels (sanctions / freeze) and its direct counterparties — 1 hop answers
 * that in seconds instead of a deep 3-hop trace, and keeps API cost low.
 */
const MONITOR_HOPS = 1;

/**
 * Rolling screen window lower bound for a monitor: only trace fund flows since
 * the last run (first run = when the monitor was created). Leaving min_timestamp
 * at 0 makes the width API trace from genesis every cycle — slow and it grows
 * unbounded. A [last_run, now] window keeps each cycle small and fast while
 * still catching any NEW risk since the previous scan.
 */
function monitorWindowStart(task: MonitorTask): number {
  const anchor = task.last_run_at || task.created_at;
  const ms = anchor ? new Date(anchor).getTime() : 0;
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

async function runAddressMonitor(
  task: MonitorTask,
  runId: string,
  screenOnly = false,
): Promise<{ results: MonitorRunResult[]; summary: MonitorRunSummary }> {
  const settings = getSettings();
  const maxTxPerRun = settings.monitoring.maxTxPerRun || 20;
  const minAmount = task.min_amount ?? settings.monitoring.defaultMinAmount ?? 1;
  const watchedTokens = task.tokens?.length ? task.tokens : ["USDT", "USDC"];
  const windowStart = monitorWindowStart(task);
  const nowMs = Date.now();

  // 1 & 2. Capture: pull new transfers since cursor, filter token + amount, and
  //    record as pending. Skipped in screenOnly (drain) mode so the pending
  //    backlog can be worked down monotonically without pulling in more txs.
  //    Cursor advances on CAPTURE — screening state lives in the ledger, so
  //    nothing is lost if screening fails.
  let capturedCount = 0;
  if (!screenOnly) {
    const { txs, cursor } = await fetchNewTxs(task.chain, task.address, task.cursor ?? {});
    updateMonitor(task.id, { cursor });

    const eligible = txs.filter(
      (tx) => watchedTokens.includes(tx.token) && tx.amount >= minAmount,
    );
    appendMonitorTxs(
      task.id,
      eligible.map((tx) => ({
        tx_id: tx.txId,
        block_number: tx.blockNumber,
        timestamp: tx.timestamp,
        from: tx.from,
        to: tx.to,
        token: tx.token,
        amount: tx.amount,
        direction: tx.direction,
      })),
    );
    capturedCount = eligible.length;
  }

  // 3. Screen the due backlog (pending + retryable errors), oldest first
  const queue = txsDueForScreening(task.id, maxTxPerRun);
  const results: MonitorRunResult[] = [];

  for (let i = 0; i < queue.length; i++) {
    const tx = queue[i];
    if (i > 0) await new Promise((r) => setTimeout(r, SCREEN_INTERVAL_MS));
    try {
      const result = await kytScreen({
        chain: task.chain,
        txId: tx.tx_id,
        token: tx.token.toLowerCase(),
        screenDirection: tx.direction,
        inRulesetId: task.in_ruleset_id ?? 0,
        outRulesetId: task.out_ruleset_id ?? 0,
        inflowHops: MONITOR_HOPS,
        outflowHops: MONITOR_HOPS,
        maxNodesPerHop: settings.screening.maxNodesPerHop,
        maxOpponentPaths: settings.screening.maxOpponentPaths,
        minAmount: settings.screening.minAmount,
        // Rolling window; never later than the tx itself (retries can predate last_run)
        minTimestamp: Math.min(windowStart, tx.timestamp),
        maxTimestamp: nowMs,
        forceTimeSequence: settings.screening.forceTimeSequence,
        scoringRulesetId: settings.screening.defaultScoringRulesetId,
      }, undefined, screenTimeoutMs());

      // Fund score is computed server-side by the width engine — use it directly.
      const fundScore = result.score;

      // Save as screening history (cross-link)
      const jobId = crypto.randomUUID().slice(0, 8);
      const completedAt = new Date().toISOString();
      saveHistoryEntry(jobId, {
        status: "completed",
        type: "kyt",
        completed_at: completedAt,
        source: "monitor",
        monitor_task_id: task.id,
        monitor_run_id: runId,
        request: {
          chain: task.chain,
          tx_id: tx.tx_id,
          token: tx.token.toLowerCase(),
          direction: tx.direction,
          in_ruleset_id: task.in_ruleset_id ?? 0,
          out_ruleset_id: task.out_ruleset_id ?? 0,
        },
        result,
        fund_score: fundScore,
      }, {
        type: "kyt",
        chain: task.chain,
        subject: tx.tx_id,
        direction: tx.direction,
        risk_level: result.risk,
        score: fundScore?.score ?? null,
        verdict: fundScore?.verdict ?? null,
        hits_count: result.hits.length,
        completed_at: completedAt,
        source: "monitor",
      });

      updateMonitorTx(task.id, tx.tx_id, {
        kyt_status: "screened",
        risk_level: result.risk,
        score: fundScore?.score ?? null,
        verdict: fundScore?.verdict ?? null,
        job_id: jobId,
        screened_at: completedAt,
        error: undefined,
      });

      results.push({
        status: "completed",
        job_id: jobId,
        risk_level: result.risk,
        score: fundScore?.score ?? null,
        verdict: fundScore?.verdict ?? null,
        tx_id: tx.tx_id,
        direction: tx.direction,
        token: tx.token,
        amount: tx.amount,
        counterparty: tx.direction === "in" ? tx.from : tx.to,
      });

      if (shouldAlert(result.risk)) {
        sendWebhook("monitor.high_risk", {
          monitor_type: "address",
          task_id: task.id,
          chain: task.chain,
          address: task.address,
          tx_id: tx.tx_id,
          direction: tx.direction,
          amount: tx.amount,
          token: tx.token,
          risk: result.risk,
          job_id: jobId,
        });
      }
    } catch (e) {
      const retries = tx.retry_count + 1;
      const errMsg = e instanceof Error ? e.message : String(e);
      updateMonitorTx(task.id, tx.tx_id, {
        kyt_status: retries >= MAX_KYT_RETRIES ? "failed" : "error",
        retry_count: retries,
        error: errMsg,
      });
      results.push({
        status: "error",
        tx_id: tx.tx_id,
        direction: tx.direction,
        token: tx.token,
        amount: tx.amount,
        error: errMsg,
      });
    }
  }

  const screened = results.filter((r) => r.status === "completed");
  let highest = "low";
  for (const r of screened) {
    if (r.risk_level && riskRank(r.risk_level) > riskRank(highest)) highest = normalizeRisk(r.risk_level);
  }
  const stats = ledgerStats(task.id);

  return {
    results,
    summary: {
      new_txs: capturedCount,
      screened: screened.length,
      // remaining backlog (will be picked up by the next run)
      skipped: stats.pending,
      flagged: screened.filter((r) => shouldAlert(r.risk_level || "low")).length,
      highest_risk: highest,
    },
  };
}

// ---------------------------------------------------------------------------
// KYT monitor — periodic KYA of the watched counterparty address
// ---------------------------------------------------------------------------
async function runKytMonitor(
  task: MonitorTask,
  runId: string,
): Promise<{ results: MonitorRunResult[]; summary: MonitorRunSummary }> {
  const settings = getSettings();
  const previousRisk = normalizeRisk(task.last_risk_level ?? "low");

  // Monitoring watches the address's OWN labels (sanctions/freeze) and its
  // direct counterparties — 1 hop is enough and keeps each cycle fast/cheap.
  // Rolling window [last_run, now] (first run = creation) so we only trace
  // activity since the previous scan, not the full history every cycle.
  const result = await kyaScreen({
    chain: task.chain,
    address: task.address,
    rulesetId: task.kya_ruleset_id ?? 0,
    scenario: "all",
    inflowHops: MONITOR_HOPS,
    outflowHops: MONITOR_HOPS,
    maxNodesPerHop: settings.screening.maxNodesPerHop,
    maxOpponentPaths: settings.screening.maxOpponentPaths,
    minAmount: settings.screening.minAmount,
    minTimestamp: monitorWindowStart(task),
    maxTimestamp: Date.now(),
    forceTimeSequence: settings.screening.forceTimeSequence,
    cexImmune: settings.screening.cexImmune,
    scoringRulesetId: settings.screening.defaultScoringRulesetId,
  }, undefined, screenTimeoutMs());

  // Fund score is computed server-side by the width engine — use it directly.
  const fundScore = result.score;

  const escalated = riskRank(result.risk) > riskRank(previousRisk);
  updateMonitor(task.id, {
    last_risk_level: result.risk,
    last_score: fundScore?.score ?? null,
    last_verdict: fundScore?.verdict ?? null,
  });

  // Save as screening history (cross-link)
  const jobId = crypto.randomUUID().slice(0, 8);
  const completedAt = new Date().toISOString();
  saveHistoryEntry(jobId, {
    status: "completed",
    type: "kya",
    completed_at: completedAt,
    source: "monitor",
    monitor_task_id: task.id,
    monitor_run_id: runId,
    request: {
      chain: task.chain,
      address: task.address,
      ruleset_id: task.kya_ruleset_id ?? 0,
      scenario: "all",
    },
    result,
    fund_score: fundScore,
  }, {
    type: "kya",
    chain: task.chain,
    subject: task.address,
    scenario: "all",
    risk_level: result.risk,
    score: fundScore?.score ?? null,
    verdict: fundScore?.verdict ?? null,
    hits_count: result.hits.length,
    completed_at: completedAt,
    source: "monitor",
  });

  if (escalated || shouldAlert(result.risk)) {
    sendWebhook(escalated ? "monitor.risk_escalated" : "monitor.high_risk", {
      monitor_type: "kyt",
      task_id: task.id,
      chain: task.chain,
      address: task.address,
      origin_tx_id: task.origin_tx_id,
      watch_side: task.watch_side,
      previous_risk: previousRisk,
      risk: result.risk,
      job_id: jobId,
    });
  }

  return {
    results: [{
      status: "completed",
      job_id: jobId,
      address: task.address,
      risk_level: result.risk,
      score: fundScore?.score ?? null,
      verdict: fundScore?.verdict ?? null,
      previous_risk_level: previousRisk,
      escalated,
    }],
    summary: {
      new_txs: 1,
      screened: 1,
      skipped: 0,
      flagged: shouldAlert(result.risk) || escalated ? 1 : 0,
      highest_risk: result.risk,
    },
  };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
export function isTaskRunning(taskId: string): boolean {
  return runningTasks.has(taskId);
}

export function getSchedulerStatus() {
  return {
    initialized: sched.initialized,
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
