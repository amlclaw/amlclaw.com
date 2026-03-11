/**
 * Audit log — append-only event log for compliance traceability.
 * Stores events in data/audit/log.jsonl (JSON Lines format).
 */
import fs from "fs";
import path from "path";

const AUDIT_DIR = path.join(process.cwd(), "data", "audit");
const LOG_FILE = path.join(AUDIT_DIR, "log.jsonl");
const MAX_EVENTS = 10000;

export type AuditAction =
  | "screening.started"
  | "screening.completed"
  | "screening.error"
  | "screening.exported"
  | "screening.batch_started"
  | "screening.batch_completed"
  | "ruleset.created"
  | "ruleset.updated"
  | "ruleset.deleted"
  | "ruleset.generated"
  | "rule.created"
  | "rule.updated"
  | "rule.deleted"
  | "policy.created"
  | "policy.generated"
  | "policy.deleted"
  | "policy.uploaded"
  | "monitor.created"
  | "monitor.updated"
  | "monitor.deleted"
  | "monitor.run_started"
  | "monitor.run_completed"
  | "settings.updated"
  | "webhook.sent"
  | "webhook.failed";

export interface AuditEvent {
  id: string;
  timestamp: string;
  action: AuditAction;
  details: Record<string, unknown>;
}

function ensureAuditDir() {
  try {
    if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });
  } catch { /* */ }
}

export function logAudit(action: AuditAction, details: Record<string, unknown> = {}): AuditEvent {
  const event: AuditEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    details,
  };

  ensureAuditDir();
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(event) + "\n", "utf-8");
  } catch { /* fallback: silently drop */ }

  return event;
}

export function loadAuditLog(opts: {
  limit?: number;
  offset?: number;
  action?: string;
} = {}): { events: AuditEvent[]; total: number } {
  const { limit = 50, offset = 0, action } = opts;

  ensureAuditDir();
  let lines: string[];
  try {
    const raw = fs.readFileSync(LOG_FILE, "utf-8");
    lines = raw.trim().split("\n").filter(Boolean);
  } catch {
    return { events: [], total: 0 };
  }

  // Trim if too large
  if (lines.length > MAX_EVENTS) {
    lines = lines.slice(lines.length - MAX_EVENTS);
    try {
      fs.writeFileSync(LOG_FILE, lines.join("\n") + "\n", "utf-8");
    } catch { /* */ }
  }

  // Reverse for newest-first
  lines.reverse();

  let events: AuditEvent[] = [];
  for (const line of lines) {
    try {
      const evt = JSON.parse(line) as AuditEvent;
      if (action && !evt.action.startsWith(action)) continue;
      events.push(evt);
    } catch { /* skip corrupt lines */ }
  }

  const total = events.length;
  events = events.slice(offset, offset + limit);

  return { events, total };
}
