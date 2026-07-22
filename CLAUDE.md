# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Open-source crypto AML screening platform, powered by the **width.info / TrustIn V3 API** (rulesets run server-side). Four modules: KYA address screening, KYT transaction screening, Address Monitoring (future txs), KYT Monitoring (counterparty KYA). Self-hosted, file-based storage, no database.

**Tech**: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind CSS 4 + CSS custom properties (dark theme). Blockchain feeds via Etherscan v2 / TronGrid. MIT license.

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint (flat config)
npm test             # Integration tests (requires dev server running on :3000)
npm run test:unit    # Unit tests (vitest, no server needed)
```

## Architecture

### Width.info V3 API (`lib/width-api.ts`)

- Docs UI: https://width.info/api-reference — actual API base: **https://api.trustin.bond**
- Auth: `?apikey=` query param (key stored in `data/settings.json`, gitignored)
- `kyaScreen()` → `POST /api/v3/screen/kya` (sync mode) — address screening, server-side ruleset engine (`ruleset_id` 0 = builtin default), returns risk/riskScore/exposures/addressIdentifications/hits
- `kytScreen()` → `POST /api/v3/screen/kyt` (sync) — tx screening, `screen_direction` in/out/both, per-direction `in_ruleset_id`/`out_ruleset_id` (0 = KYT-IN/KYT-OUT builtins), returns Chainalysis-style alerts + hits
- Risk vocabulary: `low | medium | high | critical`. UI maps critical → legacy `severe` CSS pill classes via `lib/risk-ui.ts`
- `hits[].pathNodes` are full objects `{address, amount, deep, tags[]}` (richer than the docs claim) — deep 0 = opponent

### Screening flow (KYA and KYT identical pattern)

1. POST `/api/screening` (KYA) or `/api/kyt` (KYT) → returns `jobId` immediately; defaults from settings
2. Backend calls width.info sync endpoint in background (in-memory job map)
3. Client polls `GET /api/screening/[jobId]` / `GET /api/kyt/[jobId]` every 3s
4. Completed results saved to history (`data/history/`) with typed index entries (`type: kya|kyt`)
5. Evidence graph: `hitsToEntities()` in `lib/parse-evidence-flow.ts` adapts v3 hits into the legacy entity shape consumed by `buildGraphData()`/FlowGraph — do not bypass this adapter

### Monitoring (`lib/scheduler.ts`, node-cron singleton)

Both monitor types watch **FUTURE** activity (type field on `MonitorTask`):

- **`address`**: each cycle pulls NEW stablecoin transfers via `lib/chain-txs.ts` (Etherscan v2 for ETH USDT+USDC, TronGrid for Tron USDT), filters by `min_amount`, KYT-screens each tx — monitored address receiving = `screen_direction: "in"`, sending = `"out"`. Cursor (`lastBlock`/`lastTimestamp`) initialized to NOW on creation (`initCursor`) so history is never scanned; advanced before screening so crashes don't re-screen. Per-run cap `monitoring.maxTxPerRun` (excess → `skipped`).
- **`kyt`**: created from a tx hash + `watch_side` (from/to); `resolveTxEndpoints()` resolves the address; each cycle runs KYA and compares vs `last_risk_level` — escalation always alerts.

Monitor runs saved under `data/monitors/{id}/runs/`; each screened item also becomes a history entry (`source: "monitor"`).

### Storage (`lib/storage.ts`)

File-based with in-memory fallback. History index and monitor index **filter out pre-v3 entries** (no `type` field). History capped at 200.

| Entity | Files |
|--------|-------|
| Settings | `data/settings.json` (gitignored — contains API keys; legacy shapes auto-migrated on import) |
| History | `data/history/index.json` + `{jobId}.json` |
| Monitors | `data/monitors/_index.json` + `{id}.json` + `{id}/runs/{runId}.json` |

### Settings (`lib/settings.ts`)

Sections: `api` (widthApiKey/widthBaseUrl/etherscanApiKey/trongridApiKey), `screening`, `monitoring`, `notifications` (webhook), `security` (Bearer token), `app`. Empty Etherscan/TronGrid keys → shared defaults (rate-limited). GET `/api/settings` masks secrets; PUT restores masked (`*...`) values from disk.

### Navigation (6 pages)

Dashboard `/dashboard` · KYA `/screening` · KYT `/kyt` · Address Monitoring `/monitoring` · KYT Monitoring `/kyt-monitoring` · Settings `/settings`. Landing at `/` (route group `(app)` wraps product pages with Sidebar + SetupBanner).

Removed in v3 (do not resurrect): Documents/Policies/Rules (local rule engine — now server-side), Cases, SAR, Audit Log, AI Copilot/providers, batch screening, demo mode.

## Key Patterns

- **Path alias**: `@/*` maps to repo root
- **No external state management** — React hooks only
- **Suspense boundaries** required on pages using `useSearchParams()`
- **Theme**: default dark; `data-theme="light"` overrides. Inline script in root layout prevents flash
- **CSS splitting**: `globals.css` imports module CSS files (`sidebar.css`, `screening.css`, etc.); landing classes prefixed `landing-`
- **i18n**: en/zh via `lib/i18n.ts` + `useI18n()`; nav labels translated
- **Cross-component reuse**: `RiskBadge`/`KriCard`/`EntityCard` exported from `ScreeningResult.tsx`; `MonitorPage` component parameterized by monitor type

## Testing

- Unit (`tests/unit/`, vitest): settings, storage, webhook, auth, parse-evidence-flow, hits-to-entities
- Integration (`tests/integration.test.mjs`): settings/screening/kyt/monitors/dashboard APIs + page rendering + removed-route 404s. Does NOT run real screenings.

## Secrets discipline

This is an open-source repo. API keys live ONLY in `data/settings.json` (gitignored) or env vars. Never commit keys, and never re-track `data/settings.json`.
