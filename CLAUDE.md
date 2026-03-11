# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Open-source, AI-driven crypto AML compliance platform. Five-tier pipeline: Documents > Policies > Rules > Screening > Monitoring. Self-hosted, file-based storage, multi-provider AI engine.

**Tech**: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4 + CSS custom properties (dark theme). AI via multi-provider SDK (`lib/ai.ts`). File-based storage (no database). TrustIn KYA v2 for blockchain data. MIT license.

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint (flat config, next/core-web-vitals + next/typescript)
npm test             # Integration tests (requires dev server running on :3000)
npm run test:unit    # Unit tests (vitest, no server needed)
```

Run a single test suite by name:
```bash
node --test --test-name-pattern="Documents API" tests/integration.test.mjs
```

## Architecture

### Route Groups: Landing vs App

Two separate layout trees share `app/layout.tsx` (root: html/body + fonts + theme anti-flash script):

- **`app/page.tsx`** — Landing page at `/`. Server Component. Renders 10 `components/landing/*.tsx` sections. No Sidebar, no app shell. All landing CSS classes prefixed `landing-` to avoid conflicts.
- **`app/(app)/layout.tsx`** — App shell wrapping all product pages. Renders `<Sidebar />` + `<SetupBanner />` + `<div className="app-content">`. The `(app)` route group does NOT appear in URLs — pages are at `/documents`, `/policies`, `/settings`, etc.

### AI Engine (`lib/ai.ts`)

Multi-provider streaming engine replacing the old CLI-based `lib/claude.ts` (deleted).

- **`spawnAI(opts)`** — main entry point. Reads active provider + API key from `lib/settings.ts`, dispatches to the matching adapter in `lib/ai-providers/`.
- **Providers**: Claude (`@anthropic-ai/sdk`), DeepSeek (`openai` — OpenAI-compatible), Gemini (`@google/genai`)
- **Single-job lock**: file-based at `data/.ai-lock.json` — prevents concurrent AI jobs.
- **`testConnection(provider, config)`** — pings provider with a minimal request, used by Settings UI.

### Settings (`lib/settings.ts`)

All configuration stored at `data/settings.json`. No `.env` file editing required (env vars still work as fallback).

- **`getSettings()`** — reads file, deep-merges with defaults to fill missing keys
- **`updateSettings(partial)`** — deep-merge partial update, write back
- **`getTrustInApiKey()`** / **`getTrustInBaseUrl()`** — convenience helpers with env var fallback
- **`getActiveAIConfig()`** — returns `{ provider, config }` for the active AI provider

Settings API: `GET /api/settings` (masked keys), `PUT /api/settings`, `POST /api/settings/test-connection`.

### SSE Streaming Pattern

Server-side AI generation routes (`/api/policies/generate`, `/api/rulesets/generate`) stream via SSE:
```
Server: spawnAI.onData(text) → controller.enqueue(`data: {"text":"..."}\n\n`)
        spawnAI.onComplete() → controller.enqueue(`event: done\ndata: {"id":"..."}\n\n`)
Client: AIStreamPanel → fetch() → reader.read() → parse SSE → render markdown
```
Use `safeSend`/`safeClose` wrappers on SSE controllers to prevent "controller already closed" errors.

### Screening Pipeline

1. POST `/api/screening` → returns `jobId` immediately. Reads defaults (hops, nodes, scenario, ruleset) from settings.
2. Background: `kyaProDetect()` (TrustIn API, base URL from settings, 30-60s polling) → `extractRiskPaths()` (filter by scenario + rules)
3. Client polls `GET /api/screening/[jobId]` every 3s
4. Result includes risk entities, matched rules, evidence paths; exportable to Markdown/PDF (branding from settings)
5. Graph visualization uses `@xyflow/react` + `@dagrejs/dagre` for layout; parsing in `lib/parse-evidence-flow.ts`

### Continuous Monitoring (`lib/scheduler.ts`)

- Singleton in-process `node-cron` scheduler
- `ensureSchedulerInitialized()` — lazy init called by every monitor API route
- `executeMonitorTask()` — batch screening for all addresses. TrustIn API key from `getTrustInApiKey()`.
- Schedule presets: every_1h, every_4h, every_8h, every_12h, every_24h, or custom cron

### Storage (`lib/storage.ts`)

File-based CRUD with in-memory `Record<string, string>` fallback for serverless environments where `fs.writeFileSync` fails.

| Entity | Index | Files | Notes |
|--------|-------|-------|-------|
| Settings | — | `data/settings.json` | Single file, deep-merged with defaults |
| Policies | `data/policies/_index.json` | `data/policies/{id}.md` | Index + Markdown written together |
| Rulesets | `data/rulesets/_meta.json` | `data/rulesets/{id}.json` | 3 built-in at `data/defaults/` (read-only) |
| History | `data/history/index.json` | `data/history/{jobId}.json` | Capped at 100 entries, newest first |
| Monitors | `data/monitors/_index.json` | `data/monitors/{id}.json` + `{id}/runs/{runId}.json` | Runs dir kept on delete for audit |
| Audit Log | — | `data/audit/log.jsonl` | Append-only JSON Lines, capped at 10k events |

### Dashboard (`/dashboard`)

Overview page showing: total screenings, weekly activity, risk distribution chart, recent screenings, active monitors count, system status (API connectivity, scheduler state).

### Batch Screening (`/api/screening/batch`)

POST endpoint accepting `{ addresses: [{chain, address}], scenario, ruleset_id }`. Screens up to 100 addresses sequentially, saves each as individual history entry. Polling via GET `?id=batch_xxx`. UI accessible via "Batch" button on Screening page.

### Audit Log (`lib/audit-log.ts`)

Append-only JSONL event log at `data/audit/log.jsonl`. All key operations are logged: screening (start/complete/error/export), ruleset/policy CRUD, monitor runs, settings changes, webhook deliveries. Viewable at `/audit` with filtering and pagination.

### Webhook Notifications (`lib/webhook.ts`)

HTTP POST notifications to configured URL when high-risk events are detected. Configurable in Settings > Notifications tab. Fires on screening/monitor results with Severe or High risk level. Payload: `{ event, timestamp, data }`.

### Settings Validation

PUT `/api/settings` validates: only known sections accepted (`ai`, `blockchain`, `screening`, `monitoring`, `storage`, `notifications`, `security`, `app`), numeric range checks (hops 1-5, nodes 10-1000), webhook URL format validation.

### API Authentication (`lib/auth.ts`)

Simple Bearer token authentication for self-hosted deployments. When `security.apiToken` is set in settings, all API requests require `Authorization: Bearer <token>` header. Empty token = open access (backward compatible). Configurable in Settings > Security tab.

### i18n (`lib/i18n.ts` + `lib/useI18n.ts`)

Lightweight en/zh translation system without external dependencies. `~150 keys per locale. Auto-detects browser language, persists in `localStorage("locale")`. React hook: `useI18n()` returns `{locale, setLocale, t}`. Sidebar has language switcher button.

### Scenario-Based Rule Filtering

| Scenario | Rule Categories | Direction |
|----------|----------------|-----------|
| `deposit` | Deposit | all |
| `withdrawal` | Withdrawal | outflow |
| `cdd` | CDD | all |
| `monitoring` | Ongoing Monitoring | all |
| `all` | ALL (default) | all |

## UI Style Guide

**Before writing any UI code, read `docs/UI_STYLE_GUIDE.md`** — it contains the complete design system reference: CSS variables, component classes, layout patterns, icons, and do's/don'ts. This is mandatory for maintaining visual consistency.

## Key Patterns

- **Path alias**: `@/*` maps to repo root (tsconfig paths)
- **No external state management** — React hooks only (`useState`, `useCallback`, `useRef`)
- **Inline styles** for layout, CSS classes for risk pills/badges/markdown rendering
- **Suspense boundaries** required on pages using `useSearchParams()` — the outer component wraps `<Suspense><InnerPage /></Suspense>`
- **Theme**: default is dark (no `data-theme` attribute). `data-theme="light"` on `<html>` overrides CSS variables. Persists in `localStorage("theme")`. Inline `<script>` in root layout prevents flash.
- **Sidebar**: 220px fixed on desktop, collapses to 56px icons on tablet (768-1024px, expands on hover), hamburger overlay on mobile (<768px). Theme toggle in sidebar footer. 9 nav links: Dashboard, Documents, Policies, Rules, Screening, Monitoring, Audit Log, Tech Docs, Settings.
- **Page guides**: `PageGuide` component per page, dismiss persisted in `localStorage("guide_dismissed_{pageKey}")`
- **Setup banner**: `SetupBanner` component in app layout, shows warning when API keys not configured, dismissible per session via `sessionStorage`
- **Landing page animations**: zero external libraries — pure CSS keyframes + `useScrollReveal` hook (IntersectionObserver, one-shot `.visible` class toggle)
- **CSS namespacing**: landing classes prefixed `landing-`, settings classes prefixed `settings-`, setup banner prefixed `setup-banner`
- **CSS splitting**: `globals.css` (core design system ~800 lines) imports module CSS files: `sidebar.css`, `screening.css`, `monitoring.css`, `rules.css`, `settings.css`, `dashboard.css`, `landing.css`
- **i18n**: Sidebar nav labels, language switcher (en/zh) in sidebar footer. `lib/i18n.ts` + `lib/useI18n.ts` hook

## Configuration

All settings managed through the Settings page (`/settings`):

| Section | Settings |
|---------|----------|
| AI Provider | Active provider (claude/deepseek/gemini), per-provider API key + model + base URL |
| Blockchain | TrustIn API key + base URL |
| Screening | Default inflow/outflow hops, max nodes, default scenario, default ruleset, polling timeout |
| Monitoring | Max addresses per task, default schedule |
| Notifications | Webhook URL, enable/disable, alert on high risk only |
| Security | API token (Bearer auth for all API endpoints) |
| Application | App name (branding), report header, default theme |

Legacy support: `TRUSTIN_API_KEY` in `.env.local` still works as fallback.

## Testing

### Unit Tests (vitest)

```bash
npm run test:unit
```

Unit tests in `tests/unit/` using vitest. Currently covers `lib/extract-risk-paths.ts` (12 tests: scenario filtering, direction constraints, hop limits, target self-tags, severity sorting, operator matching). CI runs `test:unit` before build.

### Integration Tests

Integration tests hitting the running dev server at `http://localhost:3000`:
```bash
npm run dev &
npm test
```

Test suites cover: server health, documents API, policies API, rulesets API, screening API, schema API, document content integrity, upload roundtrip.
