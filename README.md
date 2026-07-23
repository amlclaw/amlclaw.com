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
KYA Screening  ·  KYT Screening  ·  Address Monitoring  ·  KYT Monitoring
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

- Risk level (`low / medium / high / critical`) + 0–100 risk score
- Address identity checks (is the address itself sanctioned?)
- Exposure breakdown by category and direction
- Per-rule hits with full path evidence and an interactive fund-flow graph
- Scenario filtering: deposit / withdrawal / CDD / monitoring / screening / full scan

### 2. Transaction Screening (KYT)

Paste a transaction hash and screen its **source of funds (in)**, **destination (out)**, or **both**. Each direction uses its own dedicated server-side ruleset (KYT-IN / KYT-OUT builtins by default). Results are Chainalysis-aligned: alert list with exposure types (DIRECT/INDIRECT), recommended actions (block / review / alert / monitor), plus per-hit path evidence.

### 3. Address Monitoring — watch future transactions

Add an address and AMLClaw watches its **future** stablecoin transfers (Ethereum: USDT + USDC; Tron: USDT) via Etherscan/TronGrid on your schedule (hourly to daily). Every new transfer above your minimum amount is automatically KYT-screened — receiving = `in`, sending = `out`. High-risk hits fire webhook alerts.

### 4. KYT Monitoring — watch a counterparty

From any KYT result, put the transaction's `from` or `to` address under watch. Each cycle re-runs a KYA screen, tracks the risk trend, and alerts the moment the counterparty's risk level **escalates**.

---

## Features

- **Server-side rulesets** — no local rule maintenance; `ruleset_id 0` = builtin defaults, or manage custom rulesets on width.info
- **Evidence graph** — interactive fund-flow visualization (React Flow + dagre), cluster aggregation for same-tag risk sources
- **Webhook alerts** — real-time notifications on high/critical results and risk escalations
- **Screening history** — typed KYA/KYT history with one-click recall
- **API authentication** — optional Bearer token protection on all endpoints
- **Bilingual** (English / Chinese) with dark/light theme
- **No database** — file-based storage, backup-friendly, deploy anywhere
- **Self-hosted** — your data never leaves your server (MIT license)

---

## Project Structure

```
app/(app)/        # Product pages: dashboard, screening (KYA), kyt, monitoring, kyt-monitoring, settings
app/api/          # API routes: screening, kyt, monitors, dashboard, settings
components/       # React components by domain (screening, monitoring, settings, landing, shared)
lib/              # Core logic:
                  #   width-api.ts   — width.info V3 client (KYA/KYT sync screening)
                  #   chain-txs.ts   — Etherscan/TronGrid tx feeds + cursor management
                  #   scheduler.ts   — node-cron monitor execution (both monitor types)
                  #   storage.ts     — file-based history + monitors
                  #   settings.ts    — settings with key masking + legacy migration
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
- Use a reverse proxy (nginx/Caddy) for HTTPS
- Set `security.apiToken` in Settings for API authentication
- Add your own Etherscan/TronGrid keys to avoid shared rate limits on monitoring

---

## Translation / i18n

English and Chinese out of the box. Translation files in [`locales/`](locales/):

```
locales/en.json   # English (default)
locales/zh.json   # Chinese
```

---

## Roadmap

- **More chains** — as supported by the width.info API
- **Batch screening** — multi-address KYA submissions
- **Report export** — Markdown & PDF with custom branding
- **Analytics** — trend analysis, risk heatmaps, compliance KPIs
- **Case workflow** — investigation and disposition on top of screening history

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and PR process.

## Security

See [SECURITY.md](SECURITY.md). AMLClaw is self-hosted by design — your data never leaves your server. API keys live only in `data/settings.json` (gitignored) or environment variables.

## License

[MIT](LICENSE)
