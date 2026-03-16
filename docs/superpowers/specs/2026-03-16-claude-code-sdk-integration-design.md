# Claude Code SDK Integration Design

**Date**: 2026-03-16
**Status**: Approved
**Branch**: `feat/claude-code-sdk`

## Summary

Replace the multi-provider AI engine (Claude API / DeepSeek / Gemini) with the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), using OAuth token authentication (`CLAUDE_CODE_OAUTH_TOKEN`) to leverage the user's Claude Pro/Max subscription. Retain the full Web UI — users interact via browser, Claude Agent SDK serves as the backend AI engine.

## Motivation

- Current multi-provider setup requires users to configure API keys, select models, and manage token limits across 3 providers — unnecessary complexity
- Claude Agent SDK provides 1M context window, eliminating the need for batch document splitting
- Single provider simplifies codebase significantly (delete 6 files, replace with 2)
- Users with Claude Pro/Max subscriptions can use their existing quota without separate API billing

## Prerequisites

- **Node.js 18+**
- **Claude Code CLI** must be installed on the server (`npm install -g @anthropic-ai/claude-code` or via Homebrew)
- User must run `claude setup-token` to generate an OAuth token
- **Not serverless compatible** — Agent SDK spawns subprocesses, requires persistent Node.js server (matches current `npm run dev` / self-hosted deployment model)

## Architecture

### Current

```
lib/ai.ts (spawnAI)
  ├── lib/ai-providers/claude.ts    (@anthropic-ai/sdk)
  ├── lib/ai-providers/deepseek.ts  (openai SDK)
  └── lib/ai-providers/gemini.ts    (@google/genai)

lib/copilot-ai.ts (3 provider-specific tool-calling implementations)
lib/copilot-tools.ts (tool definitions + execution)
```

### New

```
lib/ai-agent.ts
  ├── queryAgent(prompt, opts)           — internal wrapper over SDK query(), single-turn
  ├── queryAgentStream(prompt, opts)     — internal wrapper, yields text deltas
  └── queryCopilot(messages, tools, opts) — internal wrapper, multi-turn with MCP tools

lib/mcp-tools.ts
  └── amlclawMcpServer (4 MCP tools: search_regulations, get_screening_history,
                         get_screening_detail, get_monitor_status)
```

**Note**: `queryAgent`, `queryAgentStream`, and `queryCopilot` are internal wrapper functions we create on top of the SDK's `query()` function. They are NOT SDK exports. All three internally call:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// All wrappers use the same SDK function with different options
for await (const message of query({ prompt, options })) {
  // Filter SDKMessage by type: "assistant", "result", "stream_event"
}
```

### Authentication

- OAuth token via `CLAUDE_CODE_OAUTH_TOKEN` environment variable
- Token obtained by running `claude setup-token` locally (opens browser, outputs token)
- Also stored in `data/settings.json` → `ai.oauthToken` (Settings UI writes to env)
- Settings UI provides input field + setup instructions

### Concurrency & Job Tracking

The Agent SDK spawns a subprocess per `query()` call. Job tracking migrated from current in-memory `Map<string, ActiveJob>`:

- `activeJobs: Map<string, { query: Query, type, timestamp }>` — store SDK `Query` objects
- Abort via `query.abort()` (replaces `AbortController`)
- Concurrency: allow up to 3 simultaneous jobs (configurable), reject with 429 if exceeded

### Error Handling

Map SDK-specific errors to user-friendly messages:

| SDK Error | User Message |
|-----------|-------------|
| `authentication_failed` | "OAuth token expired. Run `claude setup-token` to refresh." |
| `rate_limit` | "Subscription quota exceeded. Try again later." |
| `billing_error` | "Billing issue with your Claude subscription." |
| `max_output_tokens` | "Response was too long. Try with a shorter input." |

## Settings Redesign

### Old `ai` section

```json
{
  "ai": {
    "activeProvider": "claude",
    "providers": {
      "claude": { "apiKey": "...", "model": "...", "baseUrl": "..." },
      "deepseek": { "apiKey": "...", "model": "...", "baseUrl": "..." },
      "gemini": { "apiKey": "...", "model": "..." }
    }
  }
}
```

### New `ai` section

```json
{
  "ai": {
    "oauthToken": "sk-ant-oat01-...",
    "model": "claude-sonnet-4-6",
    "maxTurns": 10,
    "maxBudgetUsd": 1.00
  }
}
```

### Settings Migration

On first load with old-format settings, `getSettings()` detects `ai.activeProvider` or `ai.providers` keys → replaces with new defaults → writes back. Old keys are dropped silently.

### Settings UI

```
AI Engine (Claude Code)
├── OAuth Token — password input, masked; helper text: "Run `claude setup-token` in terminal"
├── Model — dropdown: claude-sonnet-4-6 (default) / claude-opus-4-6
├── Max Turns — number input, Copilot agent max iterations (default 10)
├── Max Budget (USD) — number input, per-task cost cap (default $1.00)
├── Test Connection — button, sends minimal Agent SDK query to verify token
└── Status indicator — Connected / Not configured / Token expired
```

## Scenario Migration Details

### 1. Policy Generation (`/api/policies/generate`)

**Before**: Split large document sets into 40K char batches, multiple spawnAI calls, AI-driven merge step.

**After**: Single `queryAgent()` call with all documents (1M context eliminates batching).

```typescript
// queryAgent is our internal wrapper — calls SDK query() internally
const result = await queryAgent({
  prompt: policyPrompt + allDocumentsContent,
  systemPrompt: "You are an AML compliance policy writer...",
  maxTurns: 3,  // allow a few turns for safety, but no tools = single generation
  disallowedTools: ["Bash", "Edit", "Write", "Read"]  // text-only, no agentic tools
});
// Save result as policy markdown
```

Delete: batch splitting logic, merge logic.

**RAG mode**: Removed. With 1M context, all documents fit in a single prompt. The vectorstore subsystem (`lib/vectorstore.ts`) remains available for Copilot's `search_regulations` tool but is no longer used for policy generation.

### 2. Ruleset Generation (`/api/rulesets/generate`)

**Before**: spawnAI → extract JSON from text → validate against schema.

**After**: `queryAgent()` with `outputFormat` for structured JSON output, with fallback JSON extraction.

```typescript
const result = await queryAgent({
  prompt: rulesPrompt + policyContent,
  maxTurns: 3,
  disallowedTools: ["Bash", "Edit", "Write", "Read"],
  outputFormat: { type: 'json_schema', schema: ruleSchema }
});
// Attempt structured output first, fallback to JSON extraction from text
// Validate against schema before saving
```

**Fallback**: If `outputFormat` does not produce clean JSON (Agent SDK may not honor it the same way as Messages API), retain existing JSON extraction strategies (pure JSON, markdown fences).

### 3. SAR Generation (`/api/sar/generate`)

**Before**: spawnAI with onData callback → SSE stream.

**After**: `queryAgentStream()` with `includePartialMessages: true`.

```typescript
const stream = new ReadableStream({
  async start(controller) {
    for await (const delta of queryAgentStream({
      prompt: sarPrompt + screeningData,
    })) {
      // Preserve existing SSE format: named events
      safeSend(controller, "data", { text: delta.text });
    }
    safeSend(controller, "done", { id: sarId, reference: referenceId });
    safeClose(controller);
  }
});
```

**SSE format preserved**: Uses existing `safeSend`/`safeClose` wrappers and named events (`event: data`, `event: done`, `event: error`) to maintain frontend contract.

### 4. Copilot (`/api/copilot`)

**Before**: 3 provider-specific tool-calling implementations in `copilot-ai.ts`, 4 tools in `copilot-tools.ts`.

**After**: MCP tools via `createSdkMcpServer`, single `queryCopilot()` with agent loop.

```typescript
// lib/mcp-tools.ts — uses createSdkMcpServer + tool() from Agent SDK + zod for schemas
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

export const amlclawMcpServer = createSdkMcpServer({
  name: "amlclaw",
  tools: [
    tool("search_regulations", "Search regulatory documents", { query: z.string() }, handler),
    tool("get_screening_history", "Fetch screening results", { risk_level: z.string().optional() }, handler),
    tool("get_screening_detail", "Get screening job details", { job_id: z.string() }, handler),
    tool("get_monitor_status", "Check monitoring tasks", {}, handler),
  ]
});

// In route handler — preserves existing SSE format: data: {"text":"..."} + data: [DONE]
for await (const message of queryCopilot({
  messages,
  mcpServers: { "amlclaw": amlclawMcpServer },
  allowedTools: ["mcp__amlclaw__*"],
  maxTurns: 10
})) {
  controller.enqueue(`data: ${JSON.stringify({ text: message.text })}\n\n`);
}
controller.enqueue(`data: [DONE]\n\n`);
```

### Demo Mode

**Preserved.** `queryAgent` / `queryAgentStream` / `queryCopilot` all check `isDemoMode()` first. If demo mode is active, return pre-built demo content (ported from current `lib/ai.ts` demo logic) without calling the Agent SDK.

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `lib/ai-agent.ts` | Unified Agent SDK engine — 3 wrapper functions over `query()`, job tracking, demo mode |
| `lib/mcp-tools.ts` | 4 MCP tool definitions for Copilot (migrated from copilot-tools.ts) |

### Modified Files

| File | Changes |
|------|---------|
| `lib/settings.ts` | ai section → oauthToken/model/maxTurns/maxBudgetUsd; add settings migration; remove provider helpers |
| `components/settings/SettingsForm.tsx` | AI Provider tabs → Claude Code config panel |
| `app/api/settings/test-connection/route.ts` | Use Agent SDK to verify token |
| `app/api/policies/generate/route.ts` | spawnAI → queryAgent; delete batch/merge logic |
| `app/api/rulesets/generate/route.ts` | spawnAI → queryAgent + outputFormat + fallback |
| `app/api/sar/generate/route.ts` | spawnAI → queryAgentStream; preserve SSE named events |
| `app/api/copilot/route.ts` | Rewrite to use queryCopilot + MCP tools; preserve SSE format |
| `app/api/ai/status/route.ts` | Job tracking via Query objects; abort via query.abort() |
| `package.json` | Add `@anthropic-ai/claude-agent-sdk`, `zod`; keep `@anthropic-ai/sdk` as devDependency (types); remove `openai`, `@google/genai` |

### Deleted Files

| File | Reason |
|------|--------|
| `lib/ai.ts` | Replaced by ai-agent.ts |
| `lib/ai-providers/claude.ts` | No longer needed |
| `lib/ai-providers/deepseek.ts` | No longer needed |
| `lib/ai-providers/gemini.ts` | No longer needed |
| `lib/copilot-ai.ts` | Merged into ai-agent.ts |
| `lib/copilot-tools.ts` | Migrated to lib/mcp-tools.ts |

### Unchanged

- Frontend components (AIStreamPanel, CopilotDrawer, etc.) — API request/response format preserved
- Screening pipeline — no AI involvement
- Monitoring, audit, storage layers — no AI involvement
- Prompt templates (`prompts/*.md`) — continue to use as-is
- ~~Vectorstore / embedding subsystem~~ — **deleted**: replaced by direct file reading in search_regulations MCP tool (1M context makes embedding unnecessary)
- SAR settings (`settings.sar.*`) — unchanged
- All other settings sections (blockchain, screening, monitoring, notifications, security, app) — unchanged

## Frontend Impact

**Minimal.** All API routes maintain the same request/response contract:

- Policy/Ruleset generation: POST → 202 Accepted + polling (unchanged)
- SAR generation: POST → SSE stream with named events (unchanged)
- Copilot: POST → SSE stream with `data:` + `[DONE]` (unchanged)
- Settings: PUT/GET with new `ai` shape (SettingsForm.tsx updated)

No changes to: AIStreamPanel, CopilotDrawer, CopilotFAB, CopilotMessage, ScreeningResult, or any other frontend component.

## User-Facing Changes

1. Settings page: "AI Provider" section replaced with "AI Engine (Claude Code)" section
2. Setup requirement: Users must install Claude Code CLI and run `claude setup-token`
3. Model selection simplified to 2 options (sonnet / opus)
4. No more multi-provider configuration
5. Performance improvement: 1M context = no batch splitting = faster policy generation
6. Not compatible with serverless deployment — requires persistent Node.js server
