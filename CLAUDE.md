# CLAUDE.md — AMLClaw Web

AI-driven crypto AML compliance platform. Five-tier architecture: Documents → Policies → Rules → Screening → Monitoring.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling**: Tailwind CSS 4 + CSS custom properties (dark theme)
- **AI**: Claude CLI (`claude -p --output-format stream-json --verbose`) via child_process
- **Storage**: File-based (Node.js `fs`) with in-memory fallback
- **Testing**: Native Node.js test runner (`node --test`)
- **Scheduler**: node-cron for continuous monitoring
- **API**: TrustIn KYA v2 for blockchain graph data


## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm test             # Run integration tests (requires dev server running)
npm run lint         # ESLint
```

## Project Structure

```
app/
├── documents/page.tsx       # Document library (browse, search, upload)
├── policies/page.tsx        # Compliance policy management + AI generation
├── rules/page.tsx           # Ruleset management + AI generation
├── screening/page.tsx       # Address screening with results visualization
├── monitoring/page.tsx      # Continuous monitoring task management
└── api/
    ├── documents/           # CRUD + upload + content
    ├── policies/            # CRUD + generate (SSE)
    ├── rulesets/            # CRUD + generate (SSE) + validate + rules CRUD
    ├── screening/           # Submit job + poll status + export + history
    ├── monitors/            # CRUD + manual run + history + scheduler status
    └── ai/status/           # AI job status + abort

components/                  # Client components (19 files)
├── TopNav.tsx               # 5-tab navigation (Documents, Policies, Rules, Screening, Monitoring)
├── Document*.tsx            # Library, List, Modal, Upload
├── Policy*.tsx              # List, Viewer, Generator
├── Ruleset*.tsx             # List, Viewer, Generator
├── Rule*.tsx                # Editor (WYSIWYG)
├── Screening*.tsx           # Form, Result
├── HistoryPanel.tsx         # Screening history sidebar
├── Monitor*.tsx             # List, Editor, RunHistory
└── AIStreamPanel.tsx        # Reusable SSE streaming display

lib/
├── claude.ts                # Claude CLI spawner (file-based lock, NDJSON parser)
├── storage.ts               # File-based CRUD for policies, rulesets, history, monitors
├── scheduler.ts             # Singleton cron scheduler for continuous monitoring
├── trustin-api.ts           # TrustIn KYA v2 API wrapper
├── extract-risk-paths.ts    # Scenario-based rule filtering engine
├── prompts.ts               # Template loader with {{VAR}} interpolation
├── validate-rules.ts        # Rule JSON Schema validation
├── export-md.ts             # Markdown report generator
├── types.ts                 # Shared TypeScript interfaces
└── utils.ts                 # Markdown renderer, formatters, toast

data/
├── documents.json           # 50 default document entries
├── defaults/                # Built-in rulesets (SG MAS, HK SFC, Dubai VARA)
├── policies/                # Runtime: generated policies (_index.json + .md)
├── rulesets/                # Runtime: custom rulesets (_meta.json + .json)
├── history/                 # Runtime: screening job results
├── monitors/                # Runtime: monitoring tasks + run history
└── schema/rule_schema.json  # JSON Schema for rules validation

prompts/                     # AI prompt templates
├── generate-policy.md       # Documents → compliance policy
├── generate-rules.md        # Policy → JSON rules array
├── refine-rules.md          # User instruction → modified rules
└── explain.md               # Content → natural language explanation

references/                  # 40+ regulatory documents
├── fatf/                    # 5 FATF guidelines
├── sanctions/               # 3 sanctions lists (FATF, OFAC, UN)
├── singapore/               # 12 MAS DPT compliance docs
├── hongkong/                # 12 SFC/HKMA compliance docs
├── dubai/                   # 13 VARA/CBUAE compliance docs
└── Trustin AML labels.md    # Canonical tag taxonomy for rule conditions
```

## Architecture

### Data Flow
```
Documents (40+ regulatory docs + user uploads)
    ↓ user selects docs
Policy (Claude generates structured compliance policy)
    ↓ user selects policy
Ruleset (Claude generates JSON rules array)
    ↓ user selects ruleset + address
Screening Job (TrustIn API → risk path extraction → report)
    ↓ user creates monitoring tasks
Continuous Monitoring (cron-scheduled batch screening → cross-linked history)
```

### AI Integration (`lib/claude.ts`)
- Spawns `claude -p` subprocess with `--output-format stream-json --verbose`
- File-based lock (`data/.ai-lock.json`) with PID liveness check — prevents stuck jobs
- NDJSON parser: extracts `type:"assistant"` text, skips `system`/`user`/`rate_limit_event`
- `resultText` (from `type:"result"`) used as authoritative output for saving
- `CLAUDECODE` env var removed to avoid nested session rejection

### SSE Streaming Pattern
```
Server: spawnClaude.onData(text) → controller.enqueue(`data: {"text":"..."}\n\n`)
        spawnClaude.onComplete() → controller.enqueue(`event: done\ndata: {"id":"..."}\n\n`)
Client: AIStreamPanel → fetch() → reader.read() → parse SSE → render markdown
```

### Screening Pipeline
1. POST `/api/screening` → returns `jobId` immediately
2. Background: `kyaProDetect()` → TrustIn API (30-60s polling)
3. Background: `extractRiskPaths()` → filter by scenario + rules
4. Client polls `GET /api/screening/[jobId]` every 3s
5. Result: risk entities, matched rules, evidence paths, export to MD

### Continuous Monitoring (`lib/scheduler.ts`)
- Singleton in-process scheduler using `node-cron`
- `ensureSchedulerInitialized()` — lazy init called by every API route; loads enabled tasks, registers cron jobs
- `executeMonitorTask()` — runs batch screening for all addresses in a task, saves results to both monitor runs and screening history
- Schedule presets: every_1h, every_4h, every_8h, every_12h, every_24h, or custom cron
- Storage: `data/monitors/_index.json` + `{taskId}.json` + `{taskId}/runs/{runId}.json`
- Each screening result cross-links to screening history via `saveHistoryEntry()` with `source: "monitor"`

### Scenario-Based Rule Filtering
| Scenario | Rule Categories | Direction |
|----------|----------------|-----------|
| `deposit` | Deposit | all |
| `withdrawal` | Withdrawal | outflow |
| `cdd` | CDD | all |
| `monitoring` | Ongoing Monitoring | all |
| `all` | ALL (default) | all |

## Key Patterns

- **No external state management** — React hooks only (`useState`, `useCallback`, `useRef`)
- **Inline styles** for layout, CSS classes for risk pills/badges/markdown
- **`safeSend`/`safeClose` wrappers** on SSE controllers to prevent "controller already closed" errors
- **Suspense boundaries** required on pages using `useSearchParams()`
- **File storage paths**: `data/policies/`, `data/rulesets/`, `data/history/`, `data/monitors/`
- **Built-in rulesets** are read-only from `data/defaults/`; custom rulesets go to `data/rulesets/`

## Environment

```bash
# .env.local
TRUSTIN_API_KEY=your_key_here   # Required for screening (free at trustin.info)
```

## Testing

Tests require dev server running on `http://localhost:3000`:
```bash
npm run dev &
npm test    # 64 integration tests covering all API endpoints
```

Test suites: server health, documents API, policies API, rulesets API, screening API, schema API, document content integrity, upload roundtrip.
