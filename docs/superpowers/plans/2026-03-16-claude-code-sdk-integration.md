# Claude Code SDK Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace multi-provider AI engine with Claude Agent SDK, using OAuth token auth.

**Architecture:** Single `lib/ai-agent.ts` module wrapping `@anthropic-ai/claude-agent-sdk` `query()` function with 3 internal helpers (queryAgent, queryAgentStream, queryCopilot). Copilot tools migrated to MCP via `lib/mcp-tools.ts`. Settings simplified to OAuth token + model + maxTurns + maxBudget.

**Tech Stack:** `@anthropic-ai/claude-agent-sdk`, `zod`, Next.js 16, TypeScript 5

**Spec:** `docs/superpowers/specs/2026-03-16-claude-code-sdk-integration-design.md`

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `lib/ai-agent.ts` | Agent SDK wrapper: queryAgent, queryAgentStream, queryCopilot, job tracking, demo mode | Create |
| `lib/mcp-tools.ts` | 4 MCP tool definitions for Copilot using createSdkMcpServer | Create |
| `lib/settings.ts` | Settings types + defaults + migration from old ai format | Modify |
| `components/settings/SettingsForm.tsx` | Replace AIProviderSection with ClaudeCodeSection | Modify |
| `app/api/settings/test-connection/route.ts` | Use Agent SDK to verify OAuth token | Modify |
| `app/api/policies/generate/route.ts` | Replace spawnAI + batch logic with queryAgent | Modify |
| `app/api/rulesets/generate/route.ts` | Replace spawnAI with queryAgent + outputFormat | Modify |
| `app/api/sar/generate/route.ts` | Replace spawnAI with queryAgentStream | Modify |
| `app/api/copilot/route.ts` | Replace streamCopilotChat with queryCopilot + MCP | Modify |
| `app/api/ai/status/route.ts` | Import from ai-agent instead of ai | Modify |
| `package.json` | Add claude-agent-sdk + zod, remove openai + @google/genai | Modify |
| `lib/vectorstore.ts` | Old embedding-based vector search | Delete |
| `lib/chunker.ts` | Old document chunker for vectorstore | Delete |
| `app/api/vectors/index/route.ts` | Old vector index API | Delete |
| `app/api/vectors/status/route.ts` | Old vector status API | Delete |
| `lib/ai.ts` | Old multi-provider engine | Delete |
| `lib/ai-providers/claude.ts` | Old Claude adapter | Delete |
| `lib/ai-providers/deepseek.ts` | Old DeepSeek adapter | Delete |
| `lib/ai-providers/gemini.ts` | Old Gemini adapter | Delete |
| `lib/copilot-ai.ts` | Old multi-provider copilot | Delete |
| `lib/copilot-tools.ts` | Old tool definitions (migrated to mcp-tools.ts) | Delete |

---

## Chunk 1: Foundation — Branch, Dependencies, Settings

### Task 1: Create feature branch and update dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Create feature branch**

```bash
cd /Users/max/Desktop/amlclaw/amlclaw-web
git checkout -b feat/claude-code-sdk
```

- [ ] **Step 2: Install new dependencies**

```bash
npm install @anthropic-ai/claude-agent-sdk zod
```

- [ ] **Step 3: Remove old provider SDKs from dependencies**

Edit `package.json` — remove `openai` and `@google/genai` from `dependencies`. Keep `@anthropic-ai/sdk` but move it to `devDependencies` (needed for type definitions used by Agent SDK).

```json
{
  "dependencies": {
    "@dagrejs/dagre": "^2.0.4",
    "@anthropic-ai/claude-agent-sdk": "^x.x.x",
    "@xyflow/react": "^12.10.1",
    "next": "16.1.6",
    "node-cron": "^4.2.1",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "recharts": "^3.8.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@anthropic-ai/sdk": "^0.78.0",
    ...existing devDependencies...
  }
}
```

- [ ] **Step 4: Run npm install and verify**

```bash
npm install
```

Expected: Clean install, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add claude-agent-sdk and zod, remove openai and google genai"
```

---

### Task 2: Update settings types and add migration

**Files:**
- Modify: `lib/settings.ts:1-253`

- [ ] **Step 1: Replace AI types and interface**

Replace lines 10-23 in `lib/settings.ts`:

```typescript
// Old:
export type AIProvider = "claude" | "deepseek" | "gemini";

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface Settings {
  // AI Provider
  ai: {
    activeProvider: AIProvider;
    providers: Record<AIProvider, AIProviderConfig>;
  };
```

With:

```typescript
export interface Settings {
  // AI Engine (Claude Code SDK)
  ai: {
    oauthToken: string;
    model: string;
    maxTurns: number;
    maxBudgetUsd: number;
  };
```

- [ ] **Step 2: Update DEFAULT_SETTINGS ai section**

Replace lines 94-113:

```typescript
// Old:
ai: {
  activeProvider: "claude",
  providers: {
    claude: { apiKey: "", model: "claude-sonnet-4-6", baseUrl: "" },
    deepseek: { apiKey: "", model: "deepseek-chat", baseUrl: "https://api.deepseek.com" },
    gemini: { apiKey: "", model: "gemini-2.0-flash", baseUrl: "" },
  },
},
```

With:

```typescript
ai: {
  oauthToken: "",
  model: "claude-sonnet-4-6",
  maxTurns: 10,
  maxBudgetUsd: 1.00,
},
```

- [ ] **Step 3: Add settings migration in getSettings()**

Add a `migrateSettings()` function after `getSettings()`, and call it once at module load. This avoids side effects inside the getter:

```typescript
/**
 * One-time migration: old multi-provider format → Claude Code SDK format.
 */
function migrateSettingsIfNeeded(): void {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return;
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const saved = JSON.parse(raw);
    if (saved.ai && (saved.ai.activeProvider || saved.ai.providers)) {
      saved.ai = {
        oauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN || "",
        model: saved.ai.providers?.claude?.model || "claude-sonnet-4-6",
        maxTurns: 10,
        maxBudgetUsd: 1.00,
      };
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(saved, null, 2));
      console.log("[settings] Migrated AI settings to Claude Code SDK format");
    }
  } catch { /* best-effort */ }
}

// Run migration on first import
migrateSettingsIfNeeded();
```

- [ ] **Step 4: Replace getActiveAIConfig with getAIConfig**

Replace lines 247-252:

```typescript
// Old:
export function getActiveAIConfig(): { provider: AIProvider; config: AIProviderConfig } {
  const settings = getSettings();
  const provider = settings.ai.activeProvider;
  const config = settings.ai.providers[provider];
  return { provider, config };
}
```

With:

```typescript
/**
 * Get the Claude Code SDK configuration.
 */
export function getAIConfig(): { oauthToken: string; model: string; maxTurns: number; maxBudgetUsd: number } {
  const settings = getSettings();
  return {
    oauthToken: settings.ai.oauthToken || process.env.CLAUDE_CODE_OAUTH_TOKEN || "",
    model: settings.ai.model || "claude-sonnet-4-6",
    maxTurns: settings.ai.maxTurns || 10,
    maxBudgetUsd: settings.ai.maxBudgetUsd || 1.00,
  };
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | head -50
```

Expected: Build errors about imports of removed types in other files — this is expected and will be fixed in subsequent tasks.

- [ ] **Step 6: Commit**

```bash
git add lib/settings.ts
git commit -m "feat: update settings types for Claude Code SDK, add migration"
```

---

## Chunk 2: Core AI Engine + MCP Tools

### Task 3: Create lib/ai-agent.ts

**Files:**
- Create: `lib/ai-agent.ts`

- [ ] **Step 1: Create the new AI engine file**

```typescript
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
  try { job.queryInstance?.abort(); } catch { /* already done */ }
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
        if (message.subtype === "error") {
          throw new Error(message.error || "Agent SDK returned an error");
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
        const event = message.event as Record<string, unknown>;
        if (event.type === "content_block_delta") {
          const delta = event.delta as Record<string, unknown>;
          if (delta.type === "text_delta" && typeof delta.text === "string") {
            yield { text: delta.text };
          }
        }
      }
      if (message.type === "result") {
        if (message.subtype === "error") {
          throw new Error(message.error || "Agent SDK returned an error");
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
        const event = message.event as Record<string, unknown>;
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
        if (message.subtype === "error") {
          throw new Error(message.error || "Agent SDK returned an error");
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
        if (message.subtype === "error") {
          return { ok: false, error: mapSDKError(new Error(message.error || "Unknown error")) };
        }
        return { ok: true, model: config.model };
      }
    }

    return { ok: true, model: config.model };
  } catch (e) {
    return { ok: false, error: mapSDKError(e) };
  }
}
```

- [ ] **Step 2: Verify file compiles**

```bash
npx tsc --noEmit lib/ai-agent.ts 2>&1 | head -20
```

Note: There may be type errors due to the Agent SDK types — fix any issues that arise. The `as never` casts are intentional to handle SDK option type flexibility.

- [ ] **Step 3: Commit**

```bash
git add lib/ai-agent.ts
git commit -m "feat: create ai-agent.ts — Claude Agent SDK wrapper"
```

---

### Task 4: Create lib/mcp-tools.ts

**Files:**
- Create: `lib/mcp-tools.ts`
- Reference: `lib/copilot-tools.ts:79-195` (tool execution logic to port)

- [ ] **Step 1: Create MCP tools file**

```typescript
/**
 * MCP tool definitions for Copilot.
 * Migrated from copilot-tools.ts to use Agent SDK's createSdkMcpServer.
 * search_regulations now reads files directly (1M context makes embedding unnecessary).
 */
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { loadHistoryIndex, loadHistoryJob, loadMonitorIndex } from "./storage";
import defaultDocs from "@/data/documents.json";

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleSearchRegulations(args: { query: string }) {
  // Direct file reading — load all regulatory documents and return content
  // Claude's 1M context handles the search naturally, no embedding needed
  const referencesDir = path.join(process.cwd(), "references");
  const results: { source: string; content: string }[] = [];

  for (const doc of defaultDocs) {
    const filepath = path.join(process.cwd(), "references", doc.path);
    try {
      const content = fs.readFileSync(filepath, "utf-8");
      // Simple keyword match to filter relevant docs (Claude will do deeper analysis)
      const queryLower = args.query.toLowerCase();
      const contentLower = content.toLowerCase();
      const nameLower = (doc.name || "").toLowerCase();
      if (contentLower.includes(queryLower) || nameLower.includes(queryLower) || queryLower.split(/\s+/).some(w => contentLower.includes(w))) {
        results.push({
          source: doc.name || doc.id,
          content: content.slice(0, 3000), // First 3K chars per doc
        });
      }
    } catch { /* file not found */ }
  }

  if (results.length === 0) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ message: "No matching regulatory documents found." }) }],
    };
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(results.slice(0, 5)) }],
  };
}

async function handleGetScreeningHistory(args: { limit?: number; risk_level?: string }) {
  const limit = args.limit || 10;
  let index = loadHistoryIndex();

  if (args.risk_level) {
    index = index.filter((e) => e.risk_level === args.risk_level);
  }

  const results = index.slice(0, limit);

  return {
    content: [{ type: "text" as const, text: results.length === 0
      ? JSON.stringify({ message: "No screening history found." })
      : JSON.stringify(results)
    }],
  };
}

async function handleGetScreeningDetail(args: { job_id: string }) {
  if (!args.job_id) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: "job_id is required" }) }] };
  }

  const job = loadHistoryJob(args.job_id);
  if (!job) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Screening job ${args.job_id} not found` }) }] };
  }

  const req = (job.request as Record<string, unknown>) || {};
  const result = (job.result as Record<string, unknown>) || {};
  const summary = (result.summary as Record<string, unknown>) || {};
  const entities = (result.risk_entities as unknown[]) || [];
  const rules = (result.triggered_rules as unknown[]) || [];

  return {
    content: [{ type: "text" as const, text: JSON.stringify({
      job_id: args.job_id,
      chain: req.chain,
      address: req.address,
      scenario: req.scenario,
      ruleset: req.ruleset,
      risk_level: summary.highest_severity,
      risk_score: summary.risk_score,
      risk_entities_count: entities.length,
      risk_entities: entities.slice(0, 10),
      triggered_rules: rules.slice(0, 10),
      completed_at: job.completed_at,
    }) }],
  };
}

async function handleGetMonitorStatus() {
  const monitors = loadMonitorIndex();

  if (monitors.length === 0) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ message: "No monitoring tasks found." }) }] };
  }

  const summary = monitors.map((m) => ({
    id: m.id,
    name: m.name,
    enabled: m.enabled,
    running: m.running,
    addresses_count: m.addresses?.length || 0,
    schedule: m.schedule,
    last_run: m.last_run_at,
    created_at: m.created_at,
  }));

  return { content: [{ type: "text" as const, text: JSON.stringify(summary) }] };
}

// ---------------------------------------------------------------------------
// MCP Server definition
// ---------------------------------------------------------------------------

export const amlclawMcpServer = createSdkMcpServer({
  name: "amlclaw",
  tools: [
    tool(
      "search_regulations",
      "Search AML regulatory documents by keyword. Use when user asks about regulations, compliance requirements, or legal obligations.",
      { query: z.string().describe("Search keyword or topic about AML regulations") },
      handleSearchRegulations,
    ),
    tool(
      "get_screening_history",
      "Get recent address screening results. Use when user asks about past screenings.",
      {
        limit: z.number().optional().describe("Max results (default 10)"),
        risk_level: z.enum(["Severe", "High", "Medium", "Low"]).optional().describe("Filter by risk level"),
      },
      handleGetScreeningHistory,
    ),
    tool(
      "get_screening_detail",
      "Get detailed screening result for a specific job. Use when user asks to explain a specific screening.",
      { job_id: z.string().describe("Screening job ID") },
      handleGetScreeningDetail,
    ),
    tool(
      "get_monitor_status",
      "Get status of monitoring tasks. Use when user asks about active monitors.",
      {},
      handleGetMonitorStatus,
    ),
  ],
});
```

- [ ] **Step 2: Commit**

```bash
git add lib/mcp-tools.ts
git commit -m "feat: create mcp-tools.ts — Copilot tools as MCP server"
```

---

## Chunk 3: API Route Migration

### Task 5: Update AI status route

**Files:**
- Modify: `app/api/ai/status/route.ts:1-22`

- [ ] **Step 1: Update imports**

Replace entire file:

```typescript
import { NextResponse } from "next/server";
import { isAIBusy, getActiveJobs, abortCurrentJob, abortJob } from "@/lib/ai-agent";

export async function GET() {
  return NextResponse.json({
    busy: isAIBusy(),
    jobs: getActiveJobs(),
    job: getActiveJobs()[0] || null,
  });
}

export async function POST(req: Request) {
  let jobId: string | undefined;
  try {
    const body = await req.json();
    jobId = body.jobId;
  } catch { /* empty body */ }

  const aborted = jobId ? abortJob(jobId) : abortCurrentJob();
  return NextResponse.json({ aborted, busy: isAIBusy() });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/ai/status/route.ts
git commit -m "refactor: update ai/status route to use ai-agent"
```

---

### Task 6: Update test-connection route

**Files:**
- Modify: `app/api/settings/test-connection/route.ts:1-33`

- [ ] **Step 1: Replace entire file**

```typescript
import { NextResponse } from "next/server";
import { testAgentConnection } from "@/lib/ai-agent";

export async function POST(req: Request) {
  const body = await req.json();
  const { oauthToken } = body as { oauthToken?: string };

  // Test with provided token (does not save — only saves on explicit Settings save)
  const result = await testAgentConnection(oauthToken);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/settings/test-connection/route.ts
git commit -m "refactor: update test-connection to use Agent SDK"
```

---

### Task 7: Update policy generation route

**Files:**
- Modify: `app/api/policies/generate/route.ts:1-325`

- [ ] **Step 1: Rewrite route — remove batch/RAG, use queryAgent**

```typescript
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { queryAgent } from "@/lib/ai-agent";
import { loadPrompt } from "@/lib/prompts";
import { updatePolicy } from "@/lib/storage";
import defaultDocs from "@/data/documents.json";

const UPLOADS_META_PATH = path.join(process.cwd(), "data", "uploads", "_meta.json");

function loadUploadsMeta(): Record<string, unknown>[] {
  try {
    if (fs.existsSync(UPLOADS_META_PATH)) {
      return JSON.parse(fs.readFileSync(UPLOADS_META_PATH, "utf-8"));
    }
  } catch { /* */ }
  return [];
}

function loadDocContent(docId: string): string | null {
  const doc = defaultDocs.find((d) => d.id === docId);
  if (doc) {
    const filepath = path.join(process.cwd(), "references", doc.path);
    try { return fs.readFileSync(filepath, "utf-8"); } catch { return null; }
  }
  const uploads = loadUploadsMeta();
  const upload = uploads.find((u) => u.id === docId) as Record<string, unknown> | undefined;
  if (upload) {
    const filepath = path.join(process.cwd(), "data", upload.path as string);
    try { return fs.readFileSync(filepath, "utf-8"); } catch { return null; }
  }
  return null;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { policyId, documentIds, jurisdiction } = body as {
    policyId: string;
    documentIds: string[];
    jurisdiction: string;
  };

  if (!policyId || !documentIds?.length) {
    return NextResponse.json({ error: "policyId and documentIds are required" }, { status: 400 });
  }

  // Load document contents
  const allDocs = [...defaultDocs, ...loadUploadsMeta()];
  const docs: { id: string; name: string; content: string }[] = [];
  for (const id of documentIds) {
    const content = loadDocContent(id);
    const meta = allDocs.find((d) => d.id === id);
    if (content && meta) {
      docs.push({
        id,
        name: (meta as Record<string, unknown>).name as string || id,
        content,
      });
    }
  }

  if (docs.length === 0) {
    return NextResponse.json({ error: "No document content found" }, { status: 400 });
  }

  // Mark policy as generating
  updatePolicy(policyId, {
    status: "generating",
    updated_at: new Date().toISOString(),
  });

  // Build prompt — single call, no batching (1M context)
  const docText = docs.map((d) => `## ${d.name}\n\n${d.content}`).join("\n\n---\n\n");
  const prompt = loadPrompt("generate-policy", {
    JURISDICTION: jurisdiction || "General",
    DOCUMENTS: docText,
  });

  // Fire and forget
  queryAgent({
    jobId: `policy_gen_${policyId}`,
    jobType: "generate-policy",
    prompt,
    maxTurns: 3,
    disallowedTools: ["Bash", "Edit", "Write", "Read"],
  }).then((output) => {
    updatePolicy(policyId, {
      content: output,
      status: "ready",
      updated_at: new Date().toISOString(),
    });
    console.log(`[generate] Policy ${policyId} completed`);
  }).catch((error) => {
    updatePolicy(policyId, {
      status: "error",
      updated_at: new Date().toISOString(),
    });
    console.error(`[generate] Policy ${policyId} failed:`, error.message);
  });

  return NextResponse.json(
    {
      message: "Generation started",
      policyId,
      status: "generating",
      totalDocs: docs.length,
    },
    { status: 202 }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/policies/generate/route.ts
git commit -m "refactor: policy generation — use queryAgent, remove batch/RAG"
```

---

### Task 8: Update ruleset generation route

**Files:**
- Modify: `app/api/rulesets/generate/route.ts:1-122`

- [ ] **Step 1: Rewrite route**

```typescript
import { NextResponse } from "next/server";
import { queryAgent } from "@/lib/ai-agent";
import { loadPrompt, loadRuleSchema, loadLabels } from "@/lib/prompts";
import { loadPolicy, loadCustomMeta, saveCustomMeta, saveRuleset } from "@/lib/storage";
import path from "path";

const RULESETS_DIR = path.join(process.cwd(), "data", "rulesets");

export async function POST(req: Request) {
  const body = await req.json();
  const { policyId, name, jurisdiction } = body as {
    policyId: string;
    name?: string;
    jurisdiction?: string;
  };

  if (!policyId) {
    return NextResponse.json({ error: "policyId is required" }, { status: 400 });
  }

  const policy = loadPolicy(policyId);
  if (!policy || !policy.content) {
    return NextResponse.json({ error: "Policy not found or has no content" }, { status: 404 });
  }

  const schema = loadRuleSchema();
  const labels = loadLabels();

  const prompt = loadPrompt("generate-rules", {
    POLICIES: policy.content,
    SCHEMA: schema,
    LABELS: labels,
  });

  const rulesetId = `custom_ai_${Date.now()}`;
  const rulesetName = name || `${policy.name} Rules`;
  const rulesetJurisdiction = jurisdiction || policy.jurisdiction;

  // Save meta with "generating" status
  const meta = loadCustomMeta();
  meta.push({
    id: rulesetId,
    name: rulesetName,
    jurisdiction: rulesetJurisdiction,
    icon: rulesetJurisdiction === "Singapore" ? "sg" :
      rulesetJurisdiction === "Hong Kong" ? "hk" :
        rulesetJurisdiction === "Dubai" ? "ae" : "rules",
    source_policies: [policyId],
    generated_by: "ai",
    status: "generating",
  });
  saveCustomMeta(meta);

  // Fire and forget
  queryAgent({
    jobId: `rules_gen_${rulesetId}`,
    jobType: "generate-rules",
    prompt,
    maxTurns: 3,
    disallowedTools: ["Bash", "Edit", "Write", "Read"],
  }).then((finalOutput) => {
    try {
      let rules: unknown[] | null = null;

      // Strategy 1: Direct parse
      try {
        const parsed = JSON.parse(finalOutput.trim());
        if (Array.isArray(parsed)) rules = parsed;
      } catch { /* not pure JSON */ }

      // Strategy 2: Extract JSON from markdown fences
      if (!rules) {
        const cleaned = finalOutput.replace(/```json\s*/g, "").replace(/```\s*/g, "");
        const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try { rules = JSON.parse(jsonMatch[0]); } catch { /* bad JSON */ }
        }
      }

      if (!rules || !Array.isArray(rules) || rules.length === 0) {
        throw new Error("No valid JSON rules array found in AI output");
      }

      const filepath = path.join(RULESETS_DIR, `${rulesetId}.json`);
      saveRuleset(filepath, rules);

      const currentMeta = loadCustomMeta();
      const entry = currentMeta.find((m) => m.id === rulesetId);
      if (entry) {
        entry.status = "ready";
        entry.rules_count = rules.length;
        saveCustomMeta(currentMeta);
      }

      console.log(`[generate] Ruleset ${rulesetId} completed: ${rules.length} rules`);
    } catch (e) {
      const currentMeta = loadCustomMeta();
      const entry = currentMeta.find((m) => m.id === rulesetId);
      if (entry) {
        entry.status = "error";
        saveCustomMeta(currentMeta);
      }
      console.error(`[generate] Ruleset ${rulesetId} parse failed:`, e instanceof Error ? e.message : e);
    }
  }).catch((error) => {
    const currentMeta = loadCustomMeta();
    const entry = currentMeta.find((m) => m.id === rulesetId);
    if (entry) {
      entry.status = "error";
      saveCustomMeta(currentMeta);
    }
    console.error(`[generate] Ruleset ${rulesetId} failed:`, error.message);
  });

  return NextResponse.json(
    { message: "Generation started", rulesetId, status: "generating" },
    { status: 202 }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/rulesets/generate/route.ts
git commit -m "refactor: ruleset generation — use queryAgent with JSON fallback"
```

---

### Task 9: Update SAR generation route

**Files:**
- Modify: `app/api/sar/generate/route.ts:1-109`

- [ ] **Step 1: Rewrite route — use queryAgentStream with SSE named events**

```typescript
import { queryAgentStream } from "@/lib/ai-agent";
import { loadPrompt } from "@/lib/prompts";
import { loadHistoryJob } from "@/lib/storage";
import { createSAR, getNextReference, updateSAR } from "@/lib/sar-storage";
import { logAudit } from "@/lib/audit-log";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  const body = await req.json();
  const { screening_job_id, jurisdiction = "generic" } = body as {
    screening_job_id: string;
    jurisdiction?: string;
  };

  if (!screening_job_id) {
    return new Response(JSON.stringify({ error: "screening_job_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const job = loadHistoryJob(screening_job_id);
  if (!job) {
    return new Response(JSON.stringify({ error: "Screening job not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reference = getNextReference();
  const settings = getSettings();
  const sarSettings = (settings as unknown as Record<string, unknown>).sar as Record<string, unknown> | undefined;

  const institution = {
    name: (sarSettings?.institution_name as string) || settings.app.name || "AMLClaw",
    license: (sarSettings?.license_number as string) || "",
    compliance_officer: (sarSettings?.compliance_officer as string) || "",
  };

  const sar = createSAR({
    reference,
    screening_job_id,
    jurisdiction,
    status: "generating",
    content: "",
    institution,
  });

  // Load prompt template
  const promptName = `sar-${jurisdiction}`;
  let prompt: string;
  try {
    prompt = loadPrompt(promptName, {
      screening_data: JSON.stringify(job, null, 2),
      institution_info: JSON.stringify(institution, null, 2),
      reference_id: reference,
    });
  } catch {
    prompt = loadPrompt("sar-generic", {
      screening_data: JSON.stringify(job, null, 2),
      institution_info: JSON.stringify(institution, null, 2),
      reference_id: reference,
    });
  }

  // Stream response via SSE — preserve named event format
  const encoder = new TextEncoder();
  let closed = false;

  const safeSend = (controller: ReadableStreamDefaultController, event: string, data: Record<string, unknown>) => {
    if (closed) return;
    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch { /* controller already closed */ }
  };

  const safeClose = (controller: ReadableStreamDefaultController) => {
    if (closed) return;
    closed = true;
    try { controller.close(); } catch { /* already closed */ }
  };

  const stream = new ReadableStream({
    async start(controller) {
      let fullOutput = "";
      try {
        for await (const delta of queryAgentStream({
          jobId: `sar_gen_${sar.id}`,
          jobType: "generate-sar",
          prompt,
        })) {
          fullOutput += delta.text;
          safeSend(controller, "data", { text: delta.text });
        }

        updateSAR(sar.id, { content: fullOutput, status: "draft" });
        logAudit("sar.generated" as Parameters<typeof logAudit>[0], {
          sar_id: sar.id,
          reference: sar.reference,
          screening_job_id,
          jurisdiction,
        });
        safeSend(controller, "done", { id: sar.id, reference: sar.reference });
      } catch (e) {
        updateSAR(sar.id, { status: "draft", content: "" });
        safeSend(controller, "error", { error: e instanceof Error ? e.message : String(e) });
      } finally {
        safeClose(controller);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/sar/generate/route.ts
git commit -m "refactor: SAR generation — use queryAgentStream with SSE"
```

---

### Task 10: Update Copilot route

**Files:**
- Modify: `app/api/copilot/route.ts:1-63`

- [ ] **Step 1: Rewrite route — use queryCopilot with MCP tools**

```typescript
import { loadPrompt } from "@/lib/prompts";
import { queryCopilot } from "@/lib/ai-agent";
import { amlclawMcpServer } from "@/lib/mcp-tools";

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, context } = body as {
    messages: { role: "user" | "assistant"; content: string }[];
    context?: { page?: string; jobId?: string; screeningData?: unknown };
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages array is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build system prompt
  let systemPrompt: string;
  try {
    systemPrompt = loadPrompt("copilot-system");
  } catch {
    systemPrompt = "You are AMLClaw Copilot, an AI compliance assistant. Answer AML/CFT questions professionally.";
  }

  if (context?.screeningData) {
    systemPrompt += `\n\n## Current Screening Context\nThe user is viewing a screening result. Here is the data:\n\`\`\`json\n${JSON.stringify(context.screeningData, null, 2).slice(0, 5000)}\n\`\`\``;
  }
  if (context?.page) {
    systemPrompt += `\n\nThe user is currently on the "${context.page}" page.`;
  }

  // Build prompt from latest user message + conversation history context
  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  const conversationContext = messages.length > 1
    ? `\n\nConversation history:\n${messages.slice(0, -1).map((m) => `${m.role}: ${m.content}`).join("\n")}\n\n`
    : "";
  const prompt = conversationContext + (lastUserMsg?.content || "");

  // Create SSE stream — preserve data: + [DONE] format
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of queryCopilot({
          jobId: `copilot_${Date.now()}`,
          prompt,
          systemPrompt,
          mcpServers: { amlclaw: amlclawMcpServer } as never,
          allowedTools: ["mcp__amlclaw__search_regulations", "mcp__amlclaw__get_screening_history", "mcp__amlclaw__get_screening_detail", "mcp__amlclaw__get_monitor_status"],
        })) {
          if (!closed) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`));
            } catch { closed = true; }
          }
        }
      } catch (e) {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e instanceof Error ? e.message : String(e) })}\n\n`));
          } catch { /* */ }
        }
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch { /* */ }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/copilot/route.ts
git commit -m "refactor: copilot route — use queryCopilot with MCP tools"
```

---

## Chunk 4: Settings UI + Cleanup

### Task 11: Update SettingsForm.tsx

**Files:**
- Modify: `components/settings/SettingsForm.tsx:1-580`

- [ ] **Step 1: Update Settings interface and constants**

Replace lines 1-83 (types, constants):

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

interface Settings {
  ai: {
    oauthToken: string;
    model: string;
    maxTurns: number;
    maxBudgetUsd: number;
  };
  blockchain: {
    trustinApiKey: string;
    trustinBaseUrl: string;
  };
  screening: {
    defaultInflowHops: number;
    defaultOutflowHops: number;
    maxNodes: number;
    defaultScenario: string;
    defaultRuleset: string;
    pollingTimeout: number;
  };
  monitoring: {
    maxAddressesPerTask: number;
    defaultSchedule: string;
  };
  storage: {
    historyCap: number;
    dataDirectory: string;
  };
  notifications: {
    webhookUrl: string;
    webhookEnabled: boolean;
    alertOnHighRisk: boolean;
  };
  security: {
    apiToken: string;
  };
  demo: {
    enabled: boolean;
  };
  sar: {
    institution_name: string;
    license_number: string;
    compliance_officer: string;
    default_jurisdiction: string;
    auto_reference_prefix: string;
  };
  app: {
    name: string;
    reportHeader: string;
    themeDefault: "dark" | "light";
  };
}

const AI_MODELS = ["claude-sonnet-4-6", "claude-opus-4-6"];

const SCENARIO_OPTIONS = ["deposit", "withdrawal", "cdd", "monitoring", "all"];
const SCHEDULE_OPTIONS = [
  { value: "every_1h", label: "Every 1 hour" },
  { value: "every_4h", label: "Every 4 hours" },
  { value: "every_8h", label: "Every 8 hours" },
  { value: "every_12h", label: "Every 12 hours" },
  { value: "every_24h", label: "Every 24 hours" },
];

type Tab = "ai" | "blockchain" | "sar";
```

- [ ] **Step 2: Update save function to handle new ai shape**

Replace the `save` callback (lines 103-142). Remove the provider key merging logic:

```typescript
const save = useCallback(async (patch: Partial<Settings>) => {
  setSaving(true);
  setSaved(false);
  setError("");
  try {
    const toSave = structuredClone(patch);
    // Merge raw keys
    if (toSave.ai && rawKeys["oauthToken"] !== undefined) {
      toSave.ai.oauthToken = rawKeys["oauthToken"];
    }
    if (toSave.blockchain && rawKeys["trustin"] !== undefined) {
      toSave.blockchain.trustinApiKey = rawKeys["trustin"];
    }
    if (rawKeys["apiToken"] !== undefined) {
      if (!toSave.security) toSave.security = { apiToken: "" };
      toSave.security.apiToken = rawKeys["apiToken"];
    }

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSave),
    });
    if (!res.ok) throw new Error("Save failed");
    const fresh = await fetch("/api/settings").then((r) => r.json());
    setSettings(fresh);
    setRawKeys({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  } catch {
    setError("Failed to save settings");
  } finally {
    setSaving(false);
  }
}, [rawKeys]);
```

- [ ] **Step 3: Update testConnection callback**

Replace the `testConnection` callback (lines 144-162):

```typescript
const testConnection = useCallback(async () => {
  setTestStatus((s) => ({ ...s, claude: { testing: true } }));
  try {
    const body: Record<string, string> = {};
    if (rawKeys["oauthToken"]) body.oauthToken = rawKeys["oauthToken"];
    const res = await fetch("/api/settings/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setTestStatus((s) => ({
      ...s,
      claude: { testing: false, ok: data.ok, result: data.ok ? `Connected (${data.model || "Claude"})` : data.error },
    }));
  } catch {
    setTestStatus((s) => ({ ...s, claude: { testing: false, ok: false, result: "Connection failed" } }));
  }
}, [rawKeys]);
```

- [ ] **Step 4: Update tab rendering — replace AIProviderSection with ClaudeCodeSection**

Replace the `AIProviderSection` usage in tabs (lines 208-217) and the `AIProviderSection` component (lines 245-388).

In the tab bar, change the AI tab label:

```typescript
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "ai", label: "AI Engine", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  ...rest unchanged...
];
```

Replace `{activeTab === "ai" && (<AIProviderSection .../>)}` with:

```tsx
{activeTab === "ai" && (
  <ClaudeCodeSection
    settings={settings}
    update={update}
    rawKeys={rawKeys}
    setRawKeys={setRawKeys}
    testStatus={testStatus}
    testConnection={testConnection}
  />
)}
```

- [ ] **Step 5: Replace AIProviderSection component with ClaudeCodeSection**

Delete the entire `AIProviderSection` function and replace with:

```tsx
function ClaudeCodeSection({
  settings,
  update,
  rawKeys,
  setRawKeys,
  testStatus,
  testConnection,
}: {
  settings: Settings;
  update: (path: string, val: unknown) => void;
  rawKeys: Record<string, string>;
  setRawKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  testStatus: Record<string, { testing: boolean; result?: string; ok?: boolean }>;
  testConnection: () => void;
}) {
  return (
    <>
      <h3 className="settings-section-title">AI Engine (Claude Code)</h3>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", margin: "0 0 var(--sp-4) 0" }}>
        This application uses the Claude Agent SDK powered by your Claude Pro/Max subscription.
        Run <code style={{ background: "var(--surface-3)", padding: "1px 4px", borderRadius: 3, fontFamily: "var(--mono)", fontSize: "var(--text-xs)" }}>claude setup-token</code> in your terminal to generate an OAuth token.
      </p>

      <div className="settings-field">
        <label>OAuth Token</label>
        <div style={{ display: "flex", gap: "var(--sp-2)" }}>
          <input
            type="password"
            className="input input-sm"
            style={{ flex: 1 }}
            value={rawKeys["oauthToken"] !== undefined ? rawKeys["oauthToken"] : settings.ai.oauthToken}
            onChange={(e) => setRawKeys((k) => ({ ...k, oauthToken: e.target.value }))}
            placeholder="sk-ant-oat01-..."
          />
          <button
            className="btn btn-sm"
            style={{ whiteSpace: "nowrap" }}
            onClick={() => testConnection()}
            disabled={testStatus.claude?.testing}
          >
            {testStatus.claude?.testing ? "Testing..." : "Test"}
          </button>
        </div>
        {testStatus.claude?.result && (
          <span
            className="settings-test-result"
            style={{ color: testStatus.claude.ok ? "var(--success)" : "var(--danger)" }}
          >
            {testStatus.claude.result}
          </span>
        )}
        <span className="settings-hint">
          Run <code style={{ fontFamily: "var(--mono)", fontSize: "inherit" }}>claude setup-token</code> in terminal, then paste the token here.
        </span>
      </div>

      <div className="settings-field">
        <label>Model</label>
        <select
          className="input input-sm"
          value={settings.ai.model}
          onChange={(e) => update("ai.model", e.target.value)}
        >
          {AI_MODELS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)" }}>
        <div className="settings-field">
          <label>Max Turns <span style={{ color: "var(--text-tertiary)" }}>(Copilot)</span></label>
          <input
            type="number"
            className="input input-sm"
            value={settings.ai.maxTurns}
            onChange={(e) => update("ai.maxTurns", parseInt(e.target.value) || 10)}
            min={1}
            max={50}
          />
          <span className="settings-hint">Maximum agent iterations for Copilot</span>
        </div>
        <div className="settings-field">
          <label>Max Budget (USD)</label>
          <input
            type="number"
            className="input input-sm"
            value={settings.ai.maxBudgetUsd}
            onChange={(e) => update("ai.maxBudgetUsd", parseFloat(e.target.value) || 1.0)}
            min={0.01}
            max={100}
            step={0.1}
          />
          <span className="settings-hint">Per-task cost cap</span>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/settings/SettingsForm.tsx
git commit -m "refactor: replace AI Provider UI with Claude Code settings"
```

---

### Task 12: Delete old files

**Files:**
- Delete: `lib/ai.ts`
- Delete: `lib/ai-providers/claude.ts`
- Delete: `lib/ai-providers/deepseek.ts`
- Delete: `lib/ai-providers/gemini.ts`
- Delete: `lib/copilot-ai.ts`
- Delete: `lib/copilot-tools.ts`
- Delete: `lib/vectorstore.ts`
- Delete: `lib/chunker.ts`
- Delete: `app/api/vectors/index/route.ts`
- Delete: `app/api/vectors/status/route.ts`

- [ ] **Step 1: Remove old AI engine files**

```bash
cd /Users/max/Desktop/amlclaw/amlclaw-web
git rm lib/ai.ts
git rm lib/ai-providers/claude.ts lib/ai-providers/deepseek.ts lib/ai-providers/gemini.ts
git rm lib/copilot-ai.ts lib/copilot-tools.ts
```

- [ ] **Step 2: Remove vectorstore and related files**

```bash
git rm lib/vectorstore.ts lib/chunker.ts
git rm app/api/vectors/index/route.ts app/api/vectors/status/route.ts
```

- [ ] **Step 3: Check for any remaining imports of deleted files**

```bash
grep -r "from.*['\"]@/lib/ai['\"]" app/ lib/ components/ --include="*.ts" --include="*.tsx"
grep -r "from.*['\"]@/lib/copilot-ai['\"]" app/ lib/ components/ --include="*.ts" --include="*.tsx"
grep -r "from.*['\"]@/lib/copilot-tools['\"]" app/ lib/ components/ --include="*.ts" --include="*.tsx"
grep -r "from.*['\"]@/lib/ai-providers" app/ lib/ components/ --include="*.ts" --include="*.tsx"
grep -r "from.*['\"]@/lib/vectorstore['\"]" app/ lib/ components/ --include="*.ts" --include="*.tsx"
grep -r "from.*['\"]./vectorstore['\"]" app/ lib/ components/ --include="*.ts" --include="*.tsx"
grep -r "from.*['\"]./chunker['\"]" app/ lib/ components/ --include="*.ts" --include="*.tsx"
```

Expected: No results. If any found, update those imports.

- [ ] **Step 4: Remove empty directories**

```bash
rmdir lib/ai-providers 2>/dev/null || true
rmdir app/api/vectors/index 2>/dev/null || true
rmdir app/api/vectors/status 2>/dev/null || true
rmdir app/api/vectors 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete old multi-provider AI engine files"
```

---

### Task 13: Build verification and fix

- [ ] **Step 1: Run build**

```bash
npm run build
```

- [ ] **Step 2: Fix any TypeScript errors**

Common expected issues:
- Old `AIProvider` type imports in other files — replace with new settings shape
- `getActiveAIConfig` calls — replace with `getAIConfig` from `lib/settings.ts`
- Missing `embedding` property in Settings interface — verify it's still in the interface

Fix all errors until build succeeds.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Fix any lint issues.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve build errors after AI engine migration"
```

---

### Task 14: Run tests

- [ ] **Step 1: Run unit tests**

```bash
npm run test:unit
```

Expected: All 12 existing unit tests pass (they test `extract-risk-paths.ts` which is unchanged).

- [ ] **Step 2: Start dev server and run integration tests**

```bash
npm run dev &
sleep 5
npm test
```

Expected: Most tests pass. Settings-related tests may need updating if they check old AI provider format.

- [ ] **Step 3: Fix any failing tests**

Update test expectations for new settings shape if needed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: verify all tests pass after migration"
```

---

### Task 15: Manual smoke test

- [ ] **Step 1: Open app and verify Settings page**

```bash
npm run dev
# Open http://localhost:3000/settings
```

Verify:
- AI Engine tab shows Claude Code configuration (OAuth token, model, max turns, budget)
- No provider tabs (Claude/DeepSeek/Gemini)
- Test Connection button works (will fail without real token — verify error message is user-friendly)
- Save works without errors

- [ ] **Step 2: Verify other pages load without errors**

Check browser console for errors on:
- `/dashboard`
- `/screening`
- `/monitoring`
- `/documents`
- `/policies`
- `/rules`

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Claude Code SDK integration"
```
