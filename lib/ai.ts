/**
 * Multi-provider AI engine — replaces lib/claude.ts
 * Provider-agnostic streaming interface that works with AIStreamPanel.
 * Uses file-based lock for single-job concurrency (same as old claude.ts).
 */
import fs from "fs";
import path from "path";
import { getActiveAIConfig, isDemoMode, type AIProvider, type AIProviderConfig as SettingsProviderConfig } from "./settings";
import { streamClaude, testClaude } from "./ai-providers/claude";
import { streamDeepSeek, testDeepSeek } from "./ai-providers/deepseek";
import { streamGemini, testGemini } from "./ai-providers/gemini";

// Re-export for provider adapters
export type AIProviderConfig = SettingsProviderConfig;

export interface StreamCallbacks {
  onData: (chunk: string) => void;
  onComplete: (fullOutput: string) => void;
  onError: (error: string) => void;
}

// ---------------------------------------------------------------------------
// File-based lock (same pattern as old claude.ts)
// ---------------------------------------------------------------------------
const LOCK_FILE = path.join(process.cwd(), "data", ".ai-lock.json");

interface LockData {
  id: string;
  type: string;
  startedAt: string;
  provider: string;
}

function readLock(): LockData | null {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      return JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8"));
    }
  } catch { /* corrupt file */ }
  return null;
}

function writeLock(data: LockData): void {
  const dir = path.dirname(LOCK_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOCK_FILE, JSON.stringify(data));
}

function removeLock(): void {
  try { fs.unlinkSync(LOCK_FILE); } catch { /* already gone */ }
}

// Track active abort controller
let activeAbort: AbortController | null = null;

export function isAIBusy(): boolean {
  return readLock() !== null;
}

export function getCurrentJob(): { id: string; type: string; startedAt: string } | null {
  const lock = readLock();
  if (!lock) return null;
  return { id: lock.id, type: lock.type, startedAt: lock.startedAt };
}

export function abortCurrentJob(): boolean {
  const lock = readLock();
  if (!lock) return false;
  if (activeAbort) {
    activeAbort.abort();
    activeAbort = null;
  }
  removeLock();
  return true;
}

// ---------------------------------------------------------------------------
// Main streaming entry point
// ---------------------------------------------------------------------------
export interface SpawnAIOpts {
  jobId: string;
  jobType: string;
  prompt: string;
  onData: (chunk: string) => void;
  onComplete: (fullOutput: string) => void;
  onError: (error: string) => void;
}

// ---------------------------------------------------------------------------
// Demo mode streaming — returns pre-built content without calling any API
// ---------------------------------------------------------------------------
const DEMO_POLICY_OUTPUT = `# AML/CFT Compliance Policy — Generated (Demo)

## 1. Purpose & Scope

This policy establishes the Anti-Money Laundering and Countering the Financing of Terrorism (AML/CFT) framework for digital payment token (DPT) services, aligned with the Monetary Authority of Singapore (MAS) Payment Services Act 2019 and MAS Notice PSN02.

## 2. Customer Due Diligence (CDD)

### 2.1 Standard CDD
- Verify customer identity before establishing business relations
- Obtain beneficial ownership information for corporate customers
- Screen all customers against MAS sanctions lists and UNSC consolidated list

### 2.2 Enhanced Due Diligence (EDD)
Trigger EDD when:
- Customer is from a high-risk jurisdiction (FATF grey/black list)
- Transaction involves privacy coins or mixing services
- On-chain analysis reveals exposure to sanctioned addresses within 3 hops

## 3. Transaction Monitoring

### 3.1 Real-Time Screening
All deposit and withdrawal addresses must be screened:
- **Deposits**: Screen source addresses for sanctions, terrorism financing, darknet exposure
- **Withdrawals**: Screen destination addresses for sanctions and illicit activity
- **Hops**: Default screening depth of 3 hops

### 3.2 Ongoing Monitoring
- Active addresses monitored every 4 hours
- Alert threshold: Priority 1 (Sanctions/Terrorism) tags
- Monthly re-screening of dormant accounts

## 4. Suspicious Transaction Reporting

File STR with STRO within 15 business days for flagged transactions.

## 5. Record Keeping

Maintain all CDD records and screening results for minimum 5 years.

> ⚠️ **Demo Mode** — This policy was generated in demo mode. Connect an AI provider for real policy generation.
`;

const DEMO_RULESET_OUTPUT = `[
  {
    "rule_id": "DEMO-GEN-001",
    "category": "Deposit",
    "direction": "inflow",
    "min_hops": 1,
    "max_hops": 1,
    "name": "Direct Sanctions Exposure",
    "description": "Freeze deposit if direct inflow from sanctioned entities",
    "conditions": [{"parameter": "path.node.tags.primary_category", "operator": "IN", "value": ["Sanctions", "Terrorism Financing"]}],
    "risk_level": "Severe",
    "action": "Freeze",
    "reference": "MAS PSN02 Section 13"
  },
  {
    "rule_id": "DEMO-GEN-002",
    "category": "Deposit",
    "direction": "inflow",
    "min_hops": 2,
    "max_hops": 3,
    "name": "Near-Distance Darknet Exposure",
    "description": "Flag for review if near-distance exposure to darknet markets",
    "conditions": [{"parameter": "path.node.tags.primary_category", "operator": "IN", "value": ["Darknet Markets", "Ransomware"]}],
    "risk_level": "High",
    "action": "Review",
    "reference": "MAS PSN02 Section 13.4"
  }
]

> ⚠️ **Demo Mode** — This ruleset was generated in demo mode.
`;

async function streamDemo(
  jobType: string,
  callbacks: StreamCallbacks,
  signal: AbortSignal
): Promise<void> {
  const output = jobType.includes("ruleset") ? DEMO_RULESET_OUTPUT : DEMO_POLICY_OUTPUT;
  const chunks = output.match(/.{1,40}/gs) || [output];
  let full = "";

  for (const chunk of chunks) {
    if (signal.aborted) return;
    await new Promise((r) => setTimeout(r, 50));
    full += chunk;
    callbacks.onData(chunk);
  }
  callbacks.onComplete(full);
}

export function spawnAI(opts: SpawnAIOpts): { abort: () => void } {
  if (isAIBusy()) {
    opts.onError("AI is busy with another task");
    return { abort: () => {} };
  }

  // Demo mode — stream pre-built content
  if (isDemoMode()) {
    writeLock({
      id: opts.jobId,
      type: opts.jobType,
      startedAt: new Date().toISOString(),
      provider: "demo",
    });

    const abort = new AbortController();
    activeAbort = abort;

    streamDemo(opts.jobType, {
      onData: opts.onData,
      onComplete: (output) => { removeLock(); activeAbort = null; opts.onComplete(output); },
      onError: (error) => { removeLock(); activeAbort = null; opts.onError(error); },
    }, abort.signal).catch((e) => {
      removeLock();
      activeAbort = null;
      opts.onError(e instanceof Error ? e.message : String(e));
    });

    return { abort: () => { abort.abort(); activeAbort = null; removeLock(); } };
  }

  const { provider, config } = getActiveAIConfig();

  if (!config.apiKey) {
    opts.onError(`No API key configured for ${provider}. Go to Settings to add one.`);
    return { abort: () => {} };
  }

  writeLock({
    id: opts.jobId,
    type: opts.jobType,
    startedAt: new Date().toISOString(),
    provider,
  });

  const abort = new AbortController();
  activeAbort = abort;

  const callbacks: StreamCallbacks = {
    onData: opts.onData,
    onComplete: (output) => {
      removeLock();
      activeAbort = null;
      opts.onComplete(output);
    },
    onError: (error) => {
      removeLock();
      activeAbort = null;
      opts.onError(error);
    },
  };

  // Dispatch to provider
  const streamFn = getStreamFunction(provider);
  streamFn(config, opts.prompt, callbacks).catch((e) => {
    removeLock();
    activeAbort = null;
    opts.onError(e instanceof Error ? e.message : String(e));
  });

  return {
    abort: () => {
      if (abort) abort.abort();
      activeAbort = null;
      removeLock();
    },
  };
}

function getStreamFunction(provider: AIProvider) {
  switch (provider) {
    case "claude": return streamClaude;
    case "deepseek": return streamDeepSeek;
    case "gemini": return streamGemini;
  }
}

// ---------------------------------------------------------------------------
// Connection testing
// ---------------------------------------------------------------------------
export async function testConnection(
  provider: AIProvider,
  config: AIProviderConfig
): Promise<{ ok: boolean; error?: string; model?: string }> {
  switch (provider) {
    case "claude": return testClaude(config);
    case "deepseek": return testDeepSeek(config);
    case "gemini": return testGemini(config);
  }
}
