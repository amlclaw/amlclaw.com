# Architecture

Technical architecture of AMLClaw Web.

## Tech Stack

- **Next.js 16** (App Router) — server-side rendering, API routes
- **React 19** — UI components
- **TypeScript 5** — type safety
- **Tailwind CSS 4** + CSS custom properties — styling with dark/light themes
- **File-based storage** — no database dependency

## Project Structure

```
app/
  layout.tsx           # Root layout (html/body, fonts, theme anti-flash)
  page.tsx             # Landing page (/)
  globals.css          # Core design system + CSS module imports
  (app)/
    layout.tsx         # App shell (Sidebar + SetupBanner + content area)
    dashboard/         # Dashboard overview page
    documents/         # Regulatory document library
    policies/          # AI policy generation
    rules/             # Rule engine + visual editor
    screening/         # Address screening
    monitoring/        # Continuous monitoring
    audit/             # Audit log viewer
    docs/              # In-app tech docs
    settings/          # Configuration UI
  api/                 # API routes (see API docs)
components/
  landing/             # Landing page sections (11 files)
  Sidebar.tsx          # Navigation sidebar
  SetupBanner.tsx      # API key setup warning
  AIStreamPanel.tsx    # SSE streaming display
  PageGuide.tsx        # Per-page onboarding guide
lib/
  ai.ts               # Multi-provider AI engine
  ai-providers/        # Claude, DeepSeek, Gemini adapters
  settings.ts          # Settings read/write + helpers
  storage.ts           # File-based CRUD
  auth.ts              # Bearer token authentication
  i18n.ts              # Translation dictionary (en/zh)
  useI18n.ts           # React i18n hook
  trustin-api.ts       # TrustIn KYA v2 API wrapper
  scheduler.ts         # node-cron monitoring scheduler
  extract-risk-paths.ts # Scenario-based rule matching
  audit-log.ts         # Append-only JSONL audit logger
  webhook.ts           # Webhook notification sender
  export-md.ts         # Markdown report export
  export-pdf.ts        # PDF export (zero dependencies)
  parse-evidence-flow.ts # Evidence graph parser for visualization
```

## Route Groups

Two layout trees share the root `app/layout.tsx`:

- **Landing page** (`app/page.tsx`) — Server Component at `/`. Renders landing sections. No sidebar, no app shell. CSS classes prefixed `landing-`.
- **App shell** (`app/(app)/layout.tsx`) — Wraps all product pages. Renders Sidebar + SetupBanner + content. The `(app)` route group is invisible in URLs — pages live at `/documents`, `/policies`, etc.

## AI Engine

`lib/ai.ts` → `spawnAI(opts)` is the main entry point:

1. Reads active provider + API key from `lib/settings.ts`
2. Dispatches to the matching adapter in `lib/ai-providers/`
3. Streams output via callbacks: `onData(text)`, `onComplete()`

**Providers:** Claude (`@anthropic-ai/sdk`), DeepSeek (OpenAI-compatible), Gemini (`@google/genai`)

**Concurrency:** File-based lock at `data/.ai-lock.json` — one AI job at a time.

## SSE Streaming

AI generation routes stream via Server-Sent Events:

```
spawnAI.onData(text) → controller.enqueue(`data: {"text":"..."}\n\n`)
spawnAI.onComplete() → controller.enqueue(`event: done\ndata: {"id":"..."}\n\n`)
```

Client side: `AIStreamPanel` → `fetch()` → `reader.read()` → parse SSE → render markdown.

## Screening Pipeline

1. `POST /api/screening` → returns `jobId` immediately
2. Background: `kyaProDetect()` calls TrustIn API (30-60s polling)
3. `extractRiskPaths()` filters by scenario + direction, evaluates rules
4. Client polls `GET /api/screening/{jobId}` every 3s
5. Result: risk entities, matched rules, evidence paths
6. Graph visualization: `@xyflow/react` + `@dagrejs/dagre`

## Storage

File-based CRUD with in-memory fallback for serverless:

| Entity | Index File | Data Files |
|--------|-----------|------------|
| Settings | — | `data/settings.json` |
| Policies | `data/policies/_index.json` | `data/policies/{id}.md` |
| Rulesets | `data/rulesets/_meta.json` | `data/rulesets/{id}.json` |
| History | `data/history/index.json` | `data/history/{jobId}.json` |
| Monitors | `data/monitors/_index.json` | `data/monitors/{id}.json` |
| Audit | — | `data/audit/log.jsonl` |

## Scheduler

Singleton in-process `node-cron` scheduler for monitoring:

- `ensureSchedulerInitialized()` — lazy init, called by monitor API routes
- `executeMonitorTask()` — batch screens all addresses in a monitor
- Runs inside the Next.js server process

## Theme System

- Default: dark (no `data-theme` attribute)
- Light: `data-theme="light"` on `<html>` overrides CSS variables
- Persisted in `localStorage("theme")`
- Inline `<script>` in root layout prevents flash

## i18n

Lightweight en/zh translation without external deps:

- `lib/i18n.ts` — ~150 keys per locale
- `lib/useI18n.ts` — React hook returning `{locale, setLocale, t}`
- Auto-detects browser language, persists in `localStorage("locale")`
- Language switcher in sidebar footer

## Testing

- **Unit:** `npm run test:unit` — Vitest, covers `extract-risk-paths.ts`
- **Integration:** `npm test` — hits running dev server, covers all API routes
