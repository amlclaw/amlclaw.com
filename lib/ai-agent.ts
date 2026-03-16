/**
 * Claude Code AI engine — dual mode:
 *   1. CLI mode (default): spawns `claude -p` subprocess, inherits user's login session — zero config
 *   2. SDK mode: uses Agent SDK query() with explicit OAuth token — for advanced control
 *
 * CLI mode is used when no oauthToken is configured. SDK mode when token is present.
 */
import { spawn, type ChildProcess } from "child_process";
import { query, type Query } from "@anthropic-ai/claude-agent-sdk";
import { getAIConfig, isDemoMode } from "./settings";

// ---------------------------------------------------------------------------
// Demo content (ported from old lib/ai.ts)
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

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

type AIMode = "cli" | "sdk" | "demo";

function getMode(): AIMode {
  if (isDemoMode()) return "demo";
  const config = getAIConfig();
  if (config.oauthToken) return "sdk";
  return "cli"; // default — uses local claude CLI login
}

// ---------------------------------------------------------------------------
// CLI mode — spawn `claude -p` subprocess
// ---------------------------------------------------------------------------

function spawnClaude(prompt: string, model?: string, systemPrompt?: string): ChildProcess {
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose"];
  if (model) {
    args.push("--model", model);
  }
  if (systemPrompt) {
    args.push("--system-prompt", systemPrompt);
  }
  return spawn("claude", args, {
    env: { ...process.env },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

async function runCLI(prompt: string, model?: string, systemPrompt?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawnClaude(prompt, model, systemPrompt);
    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => { stdout += data.toString(); });
    proc.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `claude exited with code ${code}`));
        return;
      }
      // Parse stream-json output — extract text from assistant messages
      const text = extractTextFromStreamJSON(stdout);
      resolve(text);
    });

    proc.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("Claude Code CLI not found. Install it with: npm install -g @anthropic-ai/claude-code"));
      } else {
        reject(err);
      }
    });
  });
}

function extractTextFromStreamJSON(raw: string): string {
  const parts: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      // stream-json format: each line is a JSON object with type field
      if (msg.type === "assistant" && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === "text") {
            parts.push(block.text);
          }
        }
      }
      // Also handle simple text result
      if (msg.type === "result" && msg.result) {
        parts.push(msg.result);
      }
    } catch { /* not JSON, skip */ }
  }
  return parts.join("") || raw; // fallback to raw if no JSON parsed
}

async function* streamCLI(prompt: string, model?: string, systemPrompt?: string): AsyncGenerator<{ text: string }, void, unknown> {
  const proc = spawnClaude(prompt, model, systemPrompt);
  let buffer = "";

  const iterator = async function* () {
    for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === "assistant" && msg.message?.content) {
            for (const block of msg.message.content) {
              if (block.type === "text") {
                yield { text: block.text };
              }
            }
          }
          if (msg.type === "content_block_delta" && msg.delta?.text) {
            yield { text: msg.delta.text };
          }
        } catch { /* not JSON */ }
      }
    }
    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const msg = JSON.parse(buffer);
        if (msg.type === "assistant" && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "text") {
              yield { text: block.text };
            }
          }
        }
      } catch { /* not JSON */ }
    }
  };

  yield* iterator();

  // Wait for process to exit
  await new Promise<void>((resolve, reject) => {
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}`));
      } else {
        resolve();
      }
    });
    proc.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("Claude Code CLI not found. Install it with: npm install -g @anthropic-ai/claude-code"));
      } else {
        reject(err);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Job tracking
// ---------------------------------------------------------------------------

interface ActiveJob {
  id: string;
  type: string;
  startedAt: string;
  queryInstance: Query | null;
  process: ChildProcess | null;
}

const activeJobs = new Map<string, ActiveJob>();
const MAX_CONCURRENT_JOBS = 3;

export function isAIBusy(): boolean {
  return activeJobs.size > 0;
}

export function getActiveJobs(): { id: string; type: string; startedAt: string }[] {
  return [...activeJobs.values()].map((j) => ({ id: j.id, type: j.type, startedAt: j.startedAt }));
}

export function getCurrentJob(): { id: string; type: string; startedAt: string } | null {
  const jobs = getActiveJobs();
  return jobs.length > 0 ? jobs[0] : null;
}

export function abortJob(jobId: string): boolean {
  const job = activeJobs.get(jobId);
  if (!job) return false;
  try { job.queryInstance?.close(); } catch { /* */ }
  try { job.process?.kill(); } catch { /* */ }
  activeJobs.delete(jobId);
  return true;
}

export function abortCurrentJob(): boolean {
  if (activeJobs.size === 0) return false;
  const first = activeJobs.values().next().value;
  if (!first) return false;
  return abortJob(first.id);
}

function registerJob(id: string, type: string, q: Query | null = null, proc: ChildProcess | null = null): void {
  activeJobs.set(id, { id, type, startedAt: new Date().toISOString(), queryInstance: q, process: proc });
}

function unregisterJob(id: string): void {
  activeJobs.delete(id);
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function mapSDKError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("authentication_failed") || msg.includes("unauthorized")) {
    return "Authentication failed. Make sure you're logged into Claude Code (run `claude login`).";
  }
  if (msg.includes("rate_limit")) {
    return "Subscription quota exceeded. Try again later.";
  }
  if (msg.includes("billing")) {
    return "Billing issue with your Claude subscription.";
  }
  if (msg.includes("max_output_tokens")) {
    return "Response was too long. Try with a shorter input.";
  }
  if (msg.includes("ENOENT")) {
    return "Claude Code CLI not found. Install it with: npm install -g @anthropic-ai/claude-code";
  }
  return msg;
}

// ---------------------------------------------------------------------------
// queryAgent — single-turn generation, returns full text
// ---------------------------------------------------------------------------

export interface QueryAgentOpts {
  jobId: string;
  jobType: string;
  prompt: string;
  systemPrompt?: string;
  maxTurns?: number;
  disallowedTools?: string[];
  outputFormat?: { type: string; schema?: unknown };
}

export async function queryAgent(opts: QueryAgentOpts): Promise<string> {
  // Demo mode
  if (isDemoMode()) {
    registerJob(opts.jobId, opts.jobType);
    const output = opts.jobType.includes("ruleset") || opts.jobType.includes("rules")
      ? DEMO_RULESET_OUTPUT
      : DEMO_POLICY_OUTPUT;
    await new Promise((r) => setTimeout(r, 500));
    unregisterJob(opts.jobId);
    return output;
  }

  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    throw new Error("Too many concurrent AI jobs. Please wait for a running job to finish.");
  }

  const mode = getMode();
  const config = getAIConfig();

  // --- CLI mode: spawn `claude -p` ---
  if (mode === "cli") {
    registerJob(opts.jobId, opts.jobType);
    try {
      const result = await runCLI(opts.prompt, config.model, opts.systemPrompt);
      return result;
    } catch (e) {
      throw new Error(mapSDKError(e));
    } finally {
      unregisterJob(opts.jobId);
    }
  }

  // --- SDK mode: use query() with OAuth token ---
  const env: Record<string, string> = {
    CLAUDE_CODE_OAUTH_TOKEN: config.oauthToken,
  };

  const options: Record<string, unknown> = {
    model: config.model,
    maxTurns: opts.maxTurns ?? 3,
    maxBudgetUsd: config.maxBudgetUsd,
    permissionMode: "bypassPermissions",
    env,
  };

  if (opts.systemPrompt) options.systemPrompt = opts.systemPrompt;
  if (opts.disallowedTools) options.disallowedTools = opts.disallowedTools;
  if (opts.outputFormat) options.outputFormat = opts.outputFormat;

  const q = query({ prompt: opts.prompt, options: options as never });
  registerJob(opts.jobId, opts.jobType, q);

  let result = "";

  try {
    for await (const message of q) {
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if ("text" in block) {
            result += block.text;
          }
        }
      }
      if (message.type === "result") {
        if (message.is_error) {
          throw new Error((message as { errors?: string[] }).errors?.[0] || "Agent SDK returned an error");
        }
        break;
      }
    }
  } catch (e) {
    throw new Error(mapSDKError(e));
  } finally {
    unregisterJob(opts.jobId);
  }

  return result;
}

// ---------------------------------------------------------------------------
// queryAgentStream — streaming text deltas (async generator)
// ---------------------------------------------------------------------------

export interface QueryAgentStreamOpts {
  jobId: string;
  jobType: string;
  prompt: string;
  systemPrompt?: string;
}

export async function* queryAgentStream(opts: QueryAgentStreamOpts): AsyncGenerator<{ text: string }, void, unknown> {
  // Demo mode
  if (isDemoMode()) {
    registerJob(opts.jobId, opts.jobType);
    const output = opts.jobType.includes("ruleset") || opts.jobType.includes("rules")
      ? DEMO_RULESET_OUTPUT
      : DEMO_POLICY_OUTPUT;
    const chunks = output.match(/.{1,40}/gs) || [output];
    for (const chunk of chunks) {
      await new Promise((r) => setTimeout(r, 50));
      yield { text: chunk };
    }
    unregisterJob(opts.jobId);
    return;
  }

  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    throw new Error("Too many concurrent AI jobs. Please wait for a running job to finish.");
  }

  const mode = getMode();
  const config = getAIConfig();

  // --- CLI mode ---
  if (mode === "cli") {
    registerJob(opts.jobId, opts.jobType);
    try {
      yield* streamCLI(opts.prompt, config.model, opts.systemPrompt);
    } catch (e) {
      throw new Error(mapSDKError(e));
    } finally {
      unregisterJob(opts.jobId);
    }
    return;
  }

  // --- SDK mode ---
  const env: Record<string, string> = {
    CLAUDE_CODE_OAUTH_TOKEN: config.oauthToken,
  };

  const options: Record<string, unknown> = {
    model: config.model,
    maxTurns: 3,
    maxBudgetUsd: config.maxBudgetUsd,
    permissionMode: "bypassPermissions",
    includePartialMessages: true,
    disallowedTools: ["Bash", "Edit", "Write", "Read"],
    env,
  };

  if (opts.systemPrompt) options.systemPrompt = opts.systemPrompt;

  const q = query({ prompt: opts.prompt, options: options as never });
  registerJob(opts.jobId, opts.jobType, q);

  try {
    for await (const message of q) {
      if (message.type === "stream_event") {
        const event = message.event as unknown as Record<string, unknown>;
        if (event.type === "content_block_delta") {
          const delta = event.delta as Record<string, unknown>;
          if (delta.type === "text_delta" && typeof delta.text === "string") {
            yield { text: delta.text };
          }
        }
      }
      if (message.type === "result") {
        if (message.is_error) {
          throw new Error((message as { errors?: string[] }).errors?.[0] || "Agent SDK returned an error");
        }
        break;
      }
    }
  } catch (e) {
    throw new Error(mapSDKError(e));
  } finally {
    unregisterJob(opts.jobId);
  }
}

// ---------------------------------------------------------------------------
// queryCopilot — multi-turn with MCP tools, streaming text
// ---------------------------------------------------------------------------

export interface QueryCopilotOpts {
  jobId: string;
  prompt: string;
  systemPrompt?: string;
  mcpServers?: Record<string, unknown>;
  allowedTools?: string[];
}

export async function* queryCopilot(opts: QueryCopilotOpts): AsyncGenerator<{ text: string }, void, unknown> {
  // Demo mode
  if (isDemoMode()) {
    const demoReply = "I'm AMLClaw Copilot running in demo mode. Connect Claude Code to enable full AI capabilities including regulatory search, screening analysis, and monitoring insights.";
    const chunks = demoReply.match(/.{1,40}/gs) || [demoReply];
    for (const chunk of chunks) {
      await new Promise((r) => setTimeout(r, 50));
      yield { text: chunk };
    }
    return;
  }

  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    throw new Error("Too many concurrent AI jobs. Please wait for a running job to finish.");
  }

  const mode = getMode();
  const config = getAIConfig();

  // --- CLI mode: simple single-turn via CLI (no MCP tool support) ---
  if (mode === "cli") {
    const fullPrompt = opts.systemPrompt
      ? `${opts.systemPrompt}\n\n---\n\nUser question: ${opts.prompt}`
      : opts.prompt;
    registerJob(opts.jobId, "copilot");
    try {
      yield* streamCLI(fullPrompt, config.model);
    } catch (e) {
      throw new Error(mapSDKError(e));
    } finally {
      unregisterJob(opts.jobId);
    }
    return;
  }

  // --- SDK mode: full agent loop with MCP tools ---
  const env: Record<string, string> = {
    CLAUDE_CODE_OAUTH_TOKEN: config.oauthToken,
  };

  const options: Record<string, unknown> = {
    model: config.model,
    maxTurns: config.maxTurns,
    maxBudgetUsd: config.maxBudgetUsd,
    permissionMode: "bypassPermissions",
    includePartialMessages: true,
    env,
  };

  if (opts.systemPrompt) options.systemPrompt = opts.systemPrompt;
  if (opts.mcpServers) options.mcpServers = opts.mcpServers;
  if (opts.allowedTools) options.allowedTools = opts.allowedTools;

  const q = query({ prompt: opts.prompt, options: options as never });
  registerJob(opts.jobId, "copilot", q);

  try {
    for await (const message of q) {
      if (message.type === "stream_event") {
        const event = message.event as unknown as Record<string, unknown>;
        if (event.type === "content_block_delta") {
          const delta = event.delta as Record<string, unknown>;
          if (delta.type === "text_delta" && typeof delta.text === "string") {
            yield { text: delta.text };
          }
        }
      }
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if ("text" in block && typeof block.text === "string") {
            yield { text: block.text };
          }
        }
      }
      if (message.type === "result") {
        if (message.is_error) {
          throw new Error((message as { errors?: string[] }).errors?.[0] || "Agent SDK returned an error");
        }
        break;
      }
    }
  } catch (e) {
    throw new Error(mapSDKError(e));
  } finally {
    unregisterJob(opts.jobId);
  }
}

// ---------------------------------------------------------------------------
// Test connection — check if claude CLI is available or SDK token is valid
// ---------------------------------------------------------------------------

export async function testAgentConnection(tokenOverride?: string): Promise<{ ok: boolean; error?: string; model?: string; mode?: string }> {
  const config = getAIConfig();
  const token = tokenOverride || config.oauthToken;

  // If token provided, test SDK mode
  if (token) {
    try {
      const env: Record<string, string> = { CLAUDE_CODE_OAUTH_TOKEN: token };
      const q = query({
        prompt: "Reply with exactly: OK",
        options: {
          model: config.model,
          maxTurns: 1,
          maxBudgetUsd: 0.01,
          permissionMode: "bypassPermissions",
          disallowedTools: ["Bash", "Edit", "Write", "Read"],
          env,
        } as never,
      });
      for await (const message of q) {
        if (message.type === "result") {
          if (message.is_error) {
            const errors = (message as { errors?: string[] }).errors;
            return { ok: false, error: mapSDKError(new Error(errors?.[0] || "Unknown error")) };
          }
          return { ok: true, model: config.model, mode: "sdk" };
        }
      }
      return { ok: true, model: config.model, mode: "sdk" };
    } catch (e) {
      return { ok: false, error: mapSDKError(e) };
    }
  }

  // No token — test CLI mode
  try {
    const result = await runCLI("Reply with exactly: OK", config.model);
    if (result.includes("OK")) {
      return { ok: true, model: config.model, mode: "cli" };
    }
    return { ok: true, model: config.model, mode: "cli" };
  } catch (e) {
    return { ok: false, error: mapSDKError(e), mode: "cli" };
  }
}
