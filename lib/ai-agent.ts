/**
 * Claude Code Agent SDK engine.
 * Replaces the old multi-provider lib/ai.ts.
 * Three wrapper functions over the SDK's query():
 *   - queryAgent()       — single-turn text generation
 *   - queryAgentStream() — streaming text deltas (async generator)
 *   - queryCopilot()     — multi-turn agent loop with MCP tools
 */
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
// Job tracking
// ---------------------------------------------------------------------------

interface ActiveJob {
  id: string;
  type: string;
  startedAt: string;
  queryInstance: Query | null;
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
  try { job.queryInstance?.close(); } catch { /* already done */ }
  activeJobs.delete(jobId);
  return true;
}

export function abortCurrentJob(): boolean {
  if (activeJobs.size === 0) return false;
  const first = activeJobs.values().next().value;
  if (!first) return false;
  return abortJob(first.id);
}

function registerJob(id: string, type: string, q: Query | null): void {
  activeJobs.set(id, { id, type, startedAt: new Date().toISOString(), queryInstance: q });
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
    return "OAuth token expired or invalid. Run `claude setup-token` in your terminal to refresh.";
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
    registerJob(opts.jobId, opts.jobType, null);
    const output = opts.jobType.includes("ruleset") || opts.jobType.includes("rules")
      ? DEMO_RULESET_OUTPUT
      : DEMO_POLICY_OUTPUT;
    // Simulate brief delay
    await new Promise((r) => setTimeout(r, 500));
    unregisterJob(opts.jobId);
    return output;
  }

  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    throw new Error("Too many concurrent AI jobs. Please wait for a running job to finish.");
  }

  const config = getAIConfig();
  if (!config.oauthToken) {
    throw new Error("Claude Code OAuth token not configured. Go to Settings > AI Engine to add one, or run `claude setup-token` in your terminal.");
  }

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

  if (opts.systemPrompt) {
    options.systemPrompt = opts.systemPrompt;
  }
  if (opts.disallowedTools) {
    options.disallowedTools = opts.disallowedTools;
  }
  if (opts.outputFormat) {
    options.outputFormat = opts.outputFormat;
  }

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
    registerJob(opts.jobId, opts.jobType, null);
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

  const config = getAIConfig();
  if (!config.oauthToken) {
    throw new Error("Claude Code OAuth token not configured. Go to Settings > AI Engine to add one.");
  }

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

  if (opts.systemPrompt) {
    options.systemPrompt = opts.systemPrompt;
  }

  const q = query({
    prompt: opts.prompt,
    options: options as never,
  });
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
    const demoReply = "I'm AMLClaw Copilot running in demo mode. Connect a Claude Code OAuth token in Settings to enable full AI capabilities including regulatory search, screening analysis, and monitoring insights.";
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

  const config = getAIConfig();
  if (!config.oauthToken) {
    throw new Error("Claude Code OAuth token not configured. Go to Settings > AI Engine to add one.");
  }

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

  if (opts.systemPrompt) {
    options.systemPrompt = opts.systemPrompt;
  }
  if (opts.mcpServers) {
    options.mcpServers = opts.mcpServers;
  }
  if (opts.allowedTools) {
    options.allowedTools = opts.allowedTools;
  }

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
        // For non-streaming messages, extract text
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
// Test connection — minimal query to verify OAuth token
// ---------------------------------------------------------------------------

export async function testAgentConnection(tokenOverride?: string): Promise<{ ok: boolean; error?: string; model?: string }> {
  const config = getAIConfig();
  const token = tokenOverride || config.oauthToken;
  if (!token) {
    return { ok: false, error: "No OAuth token configured" };
  }

  try {
    const env: Record<string, string> = {
      CLAUDE_CODE_OAUTH_TOKEN: token,
    };

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
        return { ok: true, model: config.model };
      }
    }

    return { ok: true, model: config.model };
  } catch (e) {
    return { ok: false, error: mapSDKError(e) };
  }
}
