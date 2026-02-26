/**
 * File-based storage helpers for history, custom rulesets, and policies.
 * Uses in-memory Map as fallback for serverless (Vercel).
 */
import fs from "fs";
import path from "path";
import type { MonitorTask, MonitorRun } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_DIR = path.join(DATA_DIR, "history");
const RULESETS_DIR = path.join(DATA_DIR, "rulesets");
const DEFAULTS_DIR = path.join(DATA_DIR, "defaults");
const POLICIES_DIR = path.join(DATA_DIR, "policies");
const MONITORS_DIR = path.join(DATA_DIR, "monitors");

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
// Built-in rulesets
// ---------------------------------------------------------------------------
export const BUILTIN_RULESETS = [
  { id: "singapore_mas", name: "Singapore MAS DPT", jurisdiction: "Singapore", icon: "sg", builtin: true, file: "singapore_mas.json" },
  { id: "hong_kong_sfc", name: "Hong Kong SFC VASP", jurisdiction: "Hong Kong", icon: "hk", builtin: true, file: "hong_kong_sfc.json" },
  { id: "dubai_vara", name: "Dubai VARA", jurisdiction: "Dubai", icon: "ae", builtin: true, file: "dubai_vara.json" },
];

// ---------------------------------------------------------------------------
// Custom ruleset meta
// ---------------------------------------------------------------------------
function customMetaPath() {
  return path.join(RULESETS_DIR, "_meta.json");
}

export function loadCustomMeta(): Record<string, unknown>[] {
  const raw = readFile(customMetaPath());
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveCustomMeta(meta: Record<string, unknown>[]) {
  writeFile(customMetaPath(), JSON.stringify(meta, null, 2));
}

// ---------------------------------------------------------------------------
// Ruleset CRUD
// ---------------------------------------------------------------------------
export function getAllRulesets(): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  for (const rs of BUILTIN_RULESETS) {
    const filePath = path.join(DEFAULTS_DIR, rs.file);
    let count = 0;
    const raw = readFile(filePath);
    if (raw) { try { count = JSON.parse(raw).length; } catch { /* */ } }
    result.push({ ...rs, rules_count: count });
  }

  const customMeta = loadCustomMeta();
  for (const cm of customMeta) {
    const rulesFile = path.join(RULESETS_DIR, `${cm.id}.json`);
    let count = 0;
    const raw = readFile(rulesFile);
    if (raw) { try { count = JSON.parse(raw).length; } catch { /* */ } }
    result.push({ ...cm, rules_count: count, builtin: false });
  }

  return result;
}

export function findRuleset(rulesetId: string): {
  meta: Record<string, unknown> | null;
  filepath: string | null;
  isBuiltin: boolean;
} {
  for (const rs of BUILTIN_RULESETS) {
    if (rs.id === rulesetId) {
      return { meta: rs, filepath: path.join(DEFAULTS_DIR, rs.file), isBuiltin: true };
    }
  }
  for (const cm of loadCustomMeta()) {
    if (cm.id === rulesetId) {
      return { meta: cm, filepath: path.join(RULESETS_DIR, `${cm.id}.json`), isBuiltin: false };
    }
  }
  return { meta: null, filepath: null, isBuiltin: false };
}

export function loadRuleset(filepath: string): unknown[] {
  const raw = readFile(filepath);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveRuleset(filepath: string, rules: unknown[]) {
  writeFile(filepath, JSON.stringify(rules, null, 2));
}

export function deleteRulesetFile(filepath: string) {
  deleteFile(filepath);
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
function historyIndexPath() {
  return path.join(HISTORY_DIR, "index.json");
}

export function loadHistoryIndex(): Record<string, unknown>[] {
  const raw = readFile(historyIndexPath());
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveHistoryEntry(jobId: string, jobData: Record<string, unknown>) {
  ensureDir(HISTORY_DIR);
  writeFile(path.join(HISTORY_DIR, `${jobId}.json`), JSON.stringify(jobData, null, 2));

  const index = loadHistoryIndex();
  const req = (jobData.request as Record<string, unknown>) || {};
  const result = (jobData.result as Record<string, unknown>) || {};
  const summary = (result.summary as Record<string, unknown>) || {};
  const entities = (result.risk_entities as unknown[]) || [];

  index.unshift({
    job_id: jobId,
    chain: req.chain || "",
    address: req.address || "",
    scenario: req.scenario || "",
    ruleset: req.ruleset || "",
    risk_level: summary.highest_severity || "Low",
    risk_entities_count: entities.length,
    completed_at: jobData.completed_at || "",
  });

  const trimmed = index.slice(0, 100);
  writeFile(historyIndexPath(), JSON.stringify(trimmed, null, 2));
}

export function loadHistoryJob(jobId: string): Record<string, unknown> | null {
  const raw = readFile(path.join(HISTORY_DIR, `${jobId}.json`));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------
function policyIndexPath() {
  return path.join(POLICIES_DIR, "_index.json");
}

interface PolicyMeta {
  id: string;
  name: string;
  jurisdiction: string;
  status: "generating" | "ready" | "error";
  source_documents: string[];
  created_at: string;
  updated_at: string;
}

function loadPolicyIndex(): PolicyMeta[] {
  const raw = readFile(policyIndexPath());
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function savePolicyIndex(index: PolicyMeta[]) {
  writeFile(policyIndexPath(), JSON.stringify(index, null, 2));
}

export function loadAllPolicies(): PolicyMeta[] {
  return loadPolicyIndex();
}

export function createPolicy(opts: {
  name: string;
  jurisdiction: string;
  source_documents: string[];
}): PolicyMeta {
  ensureDir(POLICIES_DIR);
  const id = `policy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const meta: PolicyMeta = {
    id,
    name: opts.name,
    jurisdiction: opts.jurisdiction,
    status: "generating",
    source_documents: opts.source_documents,
    created_at: now,
    updated_at: now,
  };

  // Save empty content file
  writeFile(path.join(POLICIES_DIR, `${id}.md`), "");

  // Update index
  const index = loadPolicyIndex();
  index.unshift(meta);
  savePolicyIndex(index);

  return meta;
}

export function loadPolicy(policyId: string): (PolicyMeta & { content: string }) | null {
  const index = loadPolicyIndex();
  const meta = index.find((p) => p.id === policyId);
  if (!meta) return null;

  const content = readFile(path.join(POLICIES_DIR, `${policyId}.md`)) || "";
  return { ...meta, content };
}

export function updatePolicy(
  policyId: string,
  updates: Partial<PolicyMeta & { content: string }>
): (PolicyMeta & { content: string }) | null {
  const index = loadPolicyIndex();
  const idx = index.findIndex((p) => p.id === policyId);
  if (idx === -1) return null;

  // Update content if provided
  if (updates.content !== undefined) {
    writeFile(path.join(POLICIES_DIR, `${policyId}.md`), updates.content);
  }

  // Update meta fields
  const { content: _content, ...metaUpdates } = updates;
  if (Object.keys(metaUpdates).length > 0) {
    index[idx] = { ...index[idx], ...metaUpdates };
    savePolicyIndex(index);
  }

  return loadPolicy(policyId);
}

export function deletePolicy(policyId: string): boolean {
  const index = loadPolicyIndex();
  const idx = index.findIndex((p) => p.id === policyId);
  if (idx === -1) return false;

  index.splice(idx, 1);
  savePolicyIndex(index);
  deleteFile(path.join(POLICIES_DIR, `${policyId}.md`));
  return true;
}

// ---------------------------------------------------------------------------
// Monitors (Continuous Monitoring)
// ---------------------------------------------------------------------------
function monitorIndexPath() {
  return path.join(MONITORS_DIR, "_index.json");
}

export function loadMonitorIndex(): MonitorTask[] {
  const raw = readFile(monitorIndexPath());
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function saveMonitorIndex(index: MonitorTask[]) {
  ensureDir(MONITORS_DIR);
  writeFile(monitorIndexPath(), JSON.stringify(index, null, 2));
}

export function createMonitor(task: MonitorTask): MonitorTask {
  ensureDir(MONITORS_DIR);
  // Save individual task file
  writeFile(path.join(MONITORS_DIR, `${task.id}.json`), JSON.stringify(task, null, 2));
  // Create runs directory
  ensureDir(path.join(MONITORS_DIR, task.id, "runs"));
  // Update index
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

  // Update index
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
