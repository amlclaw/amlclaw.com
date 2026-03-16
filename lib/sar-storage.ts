/**
 * SAR (Suspicious Activity Report) file-based storage.
 * Stores SARs at data/sars/{id}.json with an index at data/sars/index.json.
 */
import fs from "fs";
import path from "path";

const SARS_DIR = path.join(process.cwd(), "data", "sars");
const INDEX_PATH = path.join(SARS_DIR, "index.json");

export interface SARInstitution {
  name: string;
  license: string;
  compliance_officer: string;
}

export interface SAR {
  id: string;
  reference: string;
  screening_job_id: string;
  jurisdiction: string;
  status: "generating" | "draft" | "final" | "filed";
  content: string;
  institution: SARInstitution;
  created_at: string;
  updated_at: string;
}

function ensureDir() {
  try {
    if (!fs.existsSync(SARS_DIR)) fs.mkdirSync(SARS_DIR, { recursive: true });
  } catch { /* */ }
}

function loadIndex(): SAR[] {
  try {
    const raw = fs.readFileSync(INDEX_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveIndex(index: SAR[]) {
  ensureDir();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2), "utf-8");
}

export function getNextReference(): string {
  const year = new Date().getFullYear();
  const index = loadIndex();
  const prefix = `SAR-${year}-`;
  let max = 0;
  for (const sar of index) {
    if (sar.reference.startsWith(prefix)) {
      const num = parseInt(sar.reference.slice(prefix.length), 10);
      if (num > max) max = num;
    }
  }
  return `${prefix}${String(max + 1).padStart(5, "0")}`;
}

export function createSAR(data: Omit<SAR, "id" | "created_at" | "updated_at">): SAR {
  ensureDir();
  const id = `sar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const sar: SAR = { ...data, id, created_at: now, updated_at: now };

  fs.writeFileSync(path.join(SARS_DIR, `${id}.json`), JSON.stringify(sar, null, 2), "utf-8");

  const index = loadIndex();
  index.unshift(sar);
  saveIndex(index);

  return sar;
}

export function getSAR(id: string): SAR | null {
  try {
    const raw = fs.readFileSync(path.join(SARS_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function updateSAR(id: string, updates: Partial<SAR>): SAR | null {
  const sar = getSAR(id);
  if (!sar) return null;

  const updated: SAR = { ...sar, ...updates, id, updated_at: new Date().toISOString() };
  fs.writeFileSync(path.join(SARS_DIR, `${id}.json`), JSON.stringify(updated, null, 2), "utf-8");

  const index = loadIndex();
  const idx = index.findIndex((s) => s.id === id);
  if (idx !== -1) {
    index[idx] = updated;
  }
  saveIndex(index);

  return updated;
}

export function listSARs(): SAR[] {
  return loadIndex();
}
