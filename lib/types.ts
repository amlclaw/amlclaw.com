/**
 * Shared TypeScript interfaces for AMLClaw Web
 */

// Tier 1: Document
export interface Document {
  id: string;
  name: string;
  category: string; // "FATF" | "Singapore" | "Hong Kong" | "Dubai" | "Sanctions" | "Reference" | "User Upload"
  jurisdiction?: string;
  icon: string;
  path: string; // references/ (default) or data/uploads/ (user)
  type: "default" | "upload";
  format: "md" | "pdf" | "txt";
  uploaded_at?: string;
}

// Tier 2: Compliance Policy
export interface CompliancePolicy {
  id: string;
  name: string;
  jurisdiction: string;
  status: "generating" | "ready" | "error";
  source_documents: string[]; // document IDs
  content: string; // Markdown
  created_at: string;
  updated_at: string;
}

// Tier 3: Ruleset
export interface RulesetMeta {
  id: string;
  name: string;
  jurisdiction?: string;
  icon?: string;
  builtin?: boolean;
  rules_count: number;
  source_policies?: string[]; // policy IDs
  generated_by?: "ai" | "manual" | "clone";
}

// Rule condition
export interface RuleCondition {
  parameter: string;
  operator: string;
  value: unknown;
  unit?: string;
}

// Single rule
export interface Rule {
  rule_id: string;
  category: string;
  name: string;
  risk_level: string;
  action: string;
  direction?: string;
  min_hops?: number;
  max_hops?: number;
  description?: string;
  reference?: string;
  conditions?: RuleCondition[];
}

// AI Job status
export interface AIJob {
  id: string;
  type: string;
  startedAt: string;
}

// Continuous Monitoring
export interface MonitorAddress {
  chain: string;
  address: string;
}

export interface MonitorRunSummary {
  total_addresses: number;
  completed: number;
  flagged: number;
  highest_risk: string;
}

export interface MonitorTask {
  id: string;
  name: string;
  addresses: MonitorAddress[];
  scenario: string;
  ruleset_id: string;
  inflow_hops: number;
  outflow_hops: number;
  max_nodes: number;
  schedule: string;          // cron expression "0 */4 * * *"
  schedule_preset: string;   // "every_4h" | "custom" etc.
  enabled: boolean;
  created_at: string;
  updated_at: string;
  running: boolean;
  last_run_at?: string;
  next_run_at?: string;
  last_result_summary?: MonitorRunSummary;
}

export interface MonitorRun {
  run_id: string;
  task_id: string;
  started_at: string;
  completed_at?: string;
  status: "running" | "completed" | "error" | "partial";
  trigger: "scheduled" | "manual";
  results: MonitorRunResult[];
  summary?: MonitorRunSummary;
  error?: string;
}

export interface MonitorRunResult {
  chain: string;
  address: string;
  status: "completed" | "error";
  job_id?: string;
  risk_level?: string;
  risk_entities_count?: number;
  error?: string;
}
