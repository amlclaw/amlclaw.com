/**
 * Case Management — file-based storage.
 * Cases at data/cases/{id}.json with index at data/cases/index.json.
 */
import fs from "fs";
import path from "path";

const CASES_DIR = path.join(process.cwd(), "data", "cases");
const INDEX_PATH = path.join(CASES_DIR, "index.json");

export type CaseStatus = "open" | "under_review" | "closed";
export type CaseDisposition = "escalate_str" | "block_freeze" | "clear" | "false_positive";

export interface CaseNote {
  text: string;
  created_at: string;
}

export interface Case {
  id: string;
  reference: string;
  status: CaseStatus;

  // Trigger
  screening_job_id: string;
  trigger_risk_level: string;
  trigger_address: string;
  trigger_chain: string;
  trigger_scenario?: string;
  trigger_ruleset?: string;
  triggered_rules?: string[];

  // Disposition
  disposition?: CaseDisposition;
  disposition_reason?: string;

  // Timeline
  notes: CaseNote[];

  created_at: string;
  updated_at: string;
  closed_at?: string;
}

function ensureDir() {
  try {
    if (!fs.existsSync(CASES_DIR)) fs.mkdirSync(CASES_DIR, { recursive: true });
  } catch { /* */ }
}

function loadIndex(): Case[] {
  try {
    if (fs.existsSync(INDEX_PATH)) {
      return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
    }
  } catch { /* */ }
  return [];
}

function saveIndex(cases: Case[]) {
  ensureDir();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(cases, null, 2));
}

export function getNextReference(): string {
  const year = new Date().getFullYear();
  const cases = loadIndex();
  const yearCases = cases.filter((c) => c.reference.includes(`${year}`));
  const num = yearCases.length + 1;
  return `CASE-${year}-${String(num).padStart(5, "0")}`;
}

export function createCase(data: {
  screening_job_id: string;
  trigger_risk_level: string;
  trigger_address: string;
  trigger_chain: string;
  trigger_scenario?: string;
  trigger_ruleset?: string;
  triggered_rules?: string[];
}): Case {
  // Check if case already exists for this screening job
  const existing = loadIndex();
  const dup = existing.find((c) => c.screening_job_id === data.screening_job_id);
  if (dup) return dup;

  const id = `case_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const reference = getNextReference();
  const now = new Date().toISOString();

  const newCase: Case = {
    id,
    reference,
    status: "open",
    screening_job_id: data.screening_job_id,
    trigger_risk_level: data.trigger_risk_level,
    trigger_address: data.trigger_address,
    trigger_chain: data.trigger_chain,
    trigger_scenario: data.trigger_scenario,
    trigger_ruleset: data.trigger_ruleset,
    triggered_rules: data.triggered_rules || [],
    notes: [{
      text: `Case auto-created. Risk level: ${data.trigger_risk_level}. Address: ${data.trigger_address} (${data.trigger_chain}).`,
      created_at: now,
    }],
    created_at: now,
    updated_at: now,
  };

  ensureDir();
  fs.writeFileSync(path.join(CASES_DIR, `${id}.json`), JSON.stringify(newCase, null, 2));
  existing.unshift(newCase);
  saveIndex(existing);

  return newCase;
}

export function getCase(id: string): Case | null {
  try {
    const filePath = path.join(CASES_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch { /* */ }
  return null;
}

export function updateCase(id: string, updates: Partial<Case>): Case | null {
  const c = getCase(id);
  if (!c) return null;

  const updated = { ...c, ...updates, updated_at: new Date().toISOString() };
  ensureDir();
  fs.writeFileSync(path.join(CASES_DIR, `${id}.json`), JSON.stringify(updated, null, 2));

  // Update index
  const index = loadIndex();
  const idx = index.findIndex((x) => x.id === id);
  if (idx >= 0) {
    index[idx] = updated;
  }
  saveIndex(index);

  return updated;
}

export function addNote(id: string, text: string): Case | null {
  const c = getCase(id);
  if (!c) return null;

  c.notes.push({ text, created_at: new Date().toISOString() });
  return updateCase(id, { notes: c.notes });
}

export function closeCase(id: string, disposition: CaseDisposition, reason: string): Case | null {
  return updateCase(id, {
    status: "closed",
    disposition,
    disposition_reason: reason,
    closed_at: new Date().toISOString(),
  });
}

export function listCases(status?: CaseStatus): Case[] {
  const cases = loadIndex();
  if (status) return cases.filter((c) => c.status === status);
  return cases;
}

export function deleteCase(id: string): boolean {
  const index = loadIndex();
  const idx = index.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  index.splice(idx, 1);
  saveIndex(index);
  try {
    const filePath = path.join(CASES_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* */ }
  return true;
}
