<!-- Badges -->
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)](CHANGELOG.md)
[![Build](https://img.shields.io/github/actions/workflow/status/amlclaw/amlclaw.com/ci.yml?branch=main)](https://github.com/amlclaw/amlclaw.com/actions)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org)

# AMLClaw

> Open-source crypto AML screening desk by the **Width DAIA team** — KYA address screening, KYT transaction screening, and 24/7 monitoring, powered by the [width.info](https://width.info) V3 compliance API.

AMLClaw packages the underlying KYA/KYT APIs into payment-industry workflows: deposit/withdrawal screening, continuous monitoring (per-tx KYT on an address's future transfers; counterparty label-change watch that alerts the moment an address gets tagged Sanctions/Freeze), risk alerting and evidence-chain reports.

**One API key, professional server-side rulesets, full path evidence.**

```
KYA Screening  ·  KYT Screening  ·  Address Monitoring  ·  TX Monitoring
```

---

## Quick Start

```bash
git clone https://github.com/amlclaw/amlclaw.com.git
cd amlclaw.com
npm install
npm run dev
```

Open `http://localhost:3000`, go to **Settings → API Keys**, paste your width.info API key, and start screening.

### Prerequisites

- **Node.js 18+**
- **Width.info API key** — free at [width.info/api-keys](https://width.info/api-keys). Powers all KYA/KYT screening; compliance rulesets run server-side.
- **Etherscan / TronGrid API keys** (optional) — feed the address-monitoring tx stream. Without your own keys, shared defaults are used and may be rate-limited.

---

## What It Does

### 1. Address Screening (KYA)

Screen any Ethereum or Tron address against professional compliance rulesets — Sanctions, Terrorism Financing, Cybercrime, Gambling, Public Freezing Actions, and more. Multi-hop fund tracing (0–5 hops each direction) with:

- Risk level (`low / medium / high / critical`) — decided by your ruleset, not a fixed score
- Address identity checks (is the address itself sanctioned?)
- Exposure breakdown by category and direction
- Per-rule hits with full path evidence and an interactive fund-flow graph
- Advanced settings: hops, node/path caps, min amount, time window, contract penetration

### 2. Transaction Screening (KYT)

Paste a transaction hash and screen its **source of funds (in)**, **destination (out)**, or **both**. Each direction uses its own dedicated server-side ruleset (KYT-IN / KYT-OUT builtins by default). Results are Chainalysis-aligned: alert list with exposure types (DIRECT/INDIRECT), recommended actions (block / review / alert / monitor), plus per-hit path evidence.

### 3. Address Monitoring — watch future transactions

Add an address and AMLClaw watches its **future** stablecoin transfers (Ethereum: USDT + USDC; Tron: USDT) via Etherscan/TronGrid on your schedule (hourly to daily). Every new transfer above your minimum amount is automatically KYT-screened — receiving = `in`, sending = `out`. High-risk hits fire webhook alerts.

### 4. TX Monitoring — watch a counterparty

From any KYT result, put the transaction's `from` or `to` address under watch. Each cycle re-runs a KYA screen (1-hop, rolling time window since the last run), tracks the risk trend, and alerts the moment the counterparty is tagged Sanctions/Freeze or its risk level **escalates**.

### 5. Batch screening — many addresses / txs at once

`/batch-screening` (KYA) and `/batch-kyt` (KYT) run up to 50 addresses or transaction hashes per batch through the same width.info async pipeline, using the **Settings → Screening Defaults** as parameters (hops, node caps, `force_time_sequence`, `cex_immune`, scoring/ruleset ids). Chain is auto-detected per item (format / tx prefix), items process with small concurrency to respect rate limits. Results stream in a live table with per-item risk + fund score (server-side), each row expands to the full report, and the summary exports to CSV. Batch jobs persist under `data/batches/` (index + per-item payloads); they do **not** pollute the normal screening history.

---

## Features

- **Fund-attribution score (资金占比评分, server-side)** — the width.info engine scores every KYA/KYT report (`score` / `inScore` / `outScore` in the response): hit paths are deduped to subject-adjacent edges (money counted once — paths are evidence, not score), each cell contributes `base(direction × hop bucket) × severity weight × fund ratio`, SELFHIT overrides, total clamped to 100. Bands: 0-20 accept · 20-50 review · 50-80 enhanced DD · 80-100 block. The UI renders the score exactly as the API returns it — no local re-computation.
- **Server-side rulesets** — no local rule maintenance; `ruleset_id 0` = builtin defaults, or reference your own rulesets by id from width.info → Compliance → Rulesets
- **Explorer-style ledgers** — every monitored transaction / scan in a filterable table (by risk level, time range) with per-row evidence; failed screens auto-retry
- **Evidence graph** — interactive fund-flow visualization (React Flow + dagre), cluster aggregation for same-tag risk sources
- **Webhook alerts** — real-time notifications on high/critical results and risk escalations
- **Screening history** — typed KYA/KYT history with one-click recall
- **Bilingual** (Chinese default / English) with dark/light theme
- **No database** — file-based storage, backup-friendly, deploy anywhere
- **Self-hosted** — your data never leaves your server (MIT license)

---

## Project Structure

```
app/(app)/        # Product pages: dashboard, screening (KYA), kyt, monitoring, tx-monitoring, docs, settings
app/api/          # API routes: screening, kyt, monitors, dashboard, settings
components/       # React components by domain (screening, monitoring, settings, landing, shared)
lib/              # Core logic:
                  #   width-api.ts   — width.info V3 client (KYA/KYT sync screening)
                  #   chain-txs.ts   — Etherscan/TronGrid tx feeds + cursor management
                  #   scheduler.ts   — node-cron monitor execution (global sequential queue)
                  #   monitor-txs.ts — per-monitor tx ledger (capture / screen / retry)
                  #   storage.ts     — file-based history + monitors
                  #   settings.ts    — settings with key masking
data/             # Runtime data (gitignored: settings.json with API keys, history, monitors)
tests/            # Unit (vitest) + integration tests
```

---

## Development

```bash
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint
npm run test:unit    # Unit tests (vitest)
npm test             # Integration tests (requires dev server running)
```

---

## Docker Deployment

```bash
docker compose up -d
```

Open http://localhost:3000. Data is persisted in the `./data` directory via volume mount.

### Production Tips

- Mount `./data` to a persistent volume for data durability
- Use a reverse proxy (nginx/Caddy) for HTTPS — the app's local endpoints are open by default, so put it behind your own gateway/auth if exposed
- Add your own Etherscan/TronGrid keys to avoid shared rate limits on monitoring

---

## Translation / i18n

Chinese (default) and English out of the box, toggled from the sidebar. Translation files in [`locales/`](locales/):

```
locales/zh.json   # Chinese (default)
locales/en.json   # English
```

---

## Roadmap

- **More chains** — as supported by the width.info API
- **Batch screening** — multi-address KYA submissions
- **Report export** — Markdown & PDF
- **Analytics** — trend analysis, risk heatmaps, compliance KPIs
- **Case workflow** — investigation and disposition on top of screening history

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and PR process.

## Security

See [SECURITY.md](SECURITY.md). AMLClaw is self-hosted by design — your data never leaves your server. API keys live only in `data/settings.json` (gitignored) or environment variables.

## License

[MIT](LICENSE)
