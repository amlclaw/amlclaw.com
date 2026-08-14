/**
 * File-based storage helpers for screening history and monitors.
 * Uses in-memory Map as fallback for serverless environments.
 */
import fs from "fs";
import path from "path";
import type { MonitorTask, MonitorRun, HistoryIndexEntry, ScreeningType, BatchJob, BatchIndexEntry } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_DIR = path.join(DATA_DIR, "history");
const MONITORS_DIR = path.join(DATA_DIR, "monitors");
const BATCHES_DIR = path.join(DATA_DIR, "batches");

const HISTORY_CAP = 200;
const BATCH_INDEX_CAP = 50;

// In-memory fallback for serverless environments
const memoryStore: Record<string, string> = {};

function ensureDir(dir: string) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return memoryStore[filePath] ?? null;
  }
}

function writeFile(filePath: string, content: string) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf-8");
  } catch {
    memoryStore[filePath] = content;
  }
}

function deleteFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    delete memoryStore[filePath];
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
function historyIndexPath() {
  return path.join(HISTORY_DIR, "index.json");
}

export function loadHistoryIndex(): HistoryIndexEntry[] {
  const raw = readFile(historyIndexPath());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    // Ignore pre-v3 entries (no `type` field) — they used the legacy result shape.
    return parsed.filter((e) => e.type === "kya" || e.type === "kyt") as unknown as HistoryIndexEntry[];
  } catch { return []; }
}

export function saveHistoryEntry(
  jobId: string,
  jobData: Record<string, unknown>,
  indexEntry: Omit<HistoryIndexEntry, "job_id">,
) {
  ensureDir(HISTORY_DIR);
  writeFile(path.join(HISTORY_DIR, `${jobId}.json`), JSON.stringify(jobData, null, 2));

  const index = loadHistoryIndex();
  index.unshift({ job_id: jobId, ...indexEntry });
  const trimmed = index.slice(0, HISTORY_CAP);
  writeFile(historyIndexPath(), JSON.stringify(trimmed, null, 2));
}

export function loadHistoryJob(jobId: string): Record<string, unknown> | null {
  const raw = readFile(path.join(HISTORY_DIR, `${jobId}.json`));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function historyByType(type: ScreeningType, limit = 50): HistoryIndexEntry[] {
  return loadHistoryIndex().filter((e) => e.type === type).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Monitors
// ---------------------------------------------------------------------------
function monitorIndexPath() {
  return path.join(MONITORS_DIR, "_index.json");
}

export function loadMonitorIndex(): MonitorTask[] {
  const raw = readFile(monitorIndexPath());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    // Ignore pre-v3 monitors (no `type` field) — incompatible task shape.
    return parsed.filter((t) => t.type === "address" || t.type === "kyt") as unknown as MonitorTask[];
  } catch { return []; }
}

function saveMonitorIndex(index: MonitorTask[]) {
  ensureDir(MONITORS_DIR);
  writeFile(monitorIndexPath(), JSON.stringify(index, null, 2));
}

export function createMonitor(task: MonitorTask): MonitorTask {
  ensureDir(MONITORS_DIR);
  writeFile(path.join(MONITORS_DIR, `${task.id}.json`), JSON.stringify(task, null, 2));
  ensureDir(path.join(MONITORS_DIR, task.id, "runs"));
  const index = loadMonitorIndex();
  index.unshift(task);
  saveMonitorIndex(index);
  return task;
}

export function loadMonitor(id: string): MonitorTask | null {
  const raw = readFile(path.join(MONITORS_DIR, `${id}.json`));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function updateMonitor(id: string, updates: Partial<MonitorTask>): MonitorTask | null {
  const task = loadMonitor(id);
  if (!task) return null;

  const updated = { ...task, ...updates, id, updated_at: new Date().toISOString() };
  writeFile(path.join(MONITORS_DIR, `${id}.json`), JSON.stringify(updated, null, 2));

  const index = loadMonitorIndex();
  const idx = index.findIndex((t) => t.id === id);
  if (idx !== -1) {
    index[idx] = updated;
  }
  saveMonitorIndex(index);
  return updated;
}

export function deleteMonitor(id: string): boolean {
  const index = loadMonitorIndex();
  const idx = index.findIndex((t) => t.id === id);
  if (idx === -1) return false;

  index.splice(idx, 1);
  saveMonitorIndex(index);
  deleteFile(path.join(MONITORS_DIR, `${id}.json`));
  // Keep runs directory for audit trail
  return true;
}

export function saveMonitorRun(taskId: string, run: MonitorRun) {
  const runsDir = path.join(MONITORS_DIR, taskId, "runs");
  ensureDir(runsDir);
  writeFile(path.join(runsDir, `${run.run_id}.json`), JSON.stringify(run, null, 2));
}

export function loadMonitorRuns(taskId: string, limit = 20): MonitorRun[] {
  const runsDir = path.join(MONITORS_DIR, taskId, "runs");
  try {
    const files = fs.readdirSync(runsDir)
      .filter((f) => f.endsWith(".json"))
      .sort((a, b) => b.localeCompare(a)) // descending by filename (timestamp-based)
      .slice(0, limit);

    const runs: MonitorRun[] = [];
    for (const f of files) {
      const raw = readFile(path.join(runsDir, f));
      if (raw) {
        try { runs.push(JSON.parse(raw)); } catch { /* skip */ }
      }
    }
    return runs;
  } catch {
    return [];
  }
}

export function loadMonitorRun(taskId: string, runId: string): MonitorRun | null {
  const raw = readFile(path.join(MONITORS_DIR, taskId, "runs", `${runId}.json`));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Batch screening
// ---------------------------------------------------------------------------
function batchMetaPath(id: string) {
  return path.join(BATCHES_DIR, id, "meta.json");
}
function batchItemPath(id: string, index: number) {
  return path.join(BATCHES_DIR, id, "items", `${index}.json`);
}
function batchIndexPath() {
  return path.join(BATCHES_DIR, "_index.json");
}

export function saveBatchMeta(batch: BatchJob) {
  ensureDir(path.join(BATCHES_DIR, batch.id));
  writeFile(batchMetaPath(batch.id), JSON.stringify(batch, null, 2));
}

export function loadBatchMeta(id: string): BatchJob | null {
  const raw = readFile(batchMetaPath(id));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Full per-item payload (job-shaped: {status, result, request, fund_score, …}). */
export function saveBatchItem(id: string, index: number, payload: Record<string, unknown>) {
  ensureDir(path.join(BATCHES_DIR, id, "items"));
  writeFile(batchItemPath(id, index), JSON.stringify(payload, null, 2));
}

export function loadBatchItem(id: string, index: number): Record<string, unknown> | null {
  const raw = readFile(batchItemPath(id, index));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function loadBatchIndex(): BatchIndexEntry[] {
  const raw = readFile(batchIndexPath());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown[];
    return parsed.filter((e) => (e as BatchIndexEntry).type === "kya" || (e as BatchIndexEntry).type === "kyt") as unknown as BatchIndexEntry[];
  } catch { return []; }
}

function saveBatchIndex(index: BatchIndexEntry[]) {
  ensureDir(BATCHES_DIR);
  writeFile(batchIndexPath(), JSON.stringify(index, null, 2));
}

/** Add or refresh an entry in the batch index (newest first, capped). */
export function upsertBatchIndexEntry(entry: BatchIndexEntry) {
  const index = loadBatchIndex();
  const idx = index.findIndex((e) => e.id === entry.id);
  if (idx !== -1) index[idx] = entry;
  else index.unshift(entry);
  saveBatchIndex(index.slice(0, BATCH_INDEX_CAP));
}
