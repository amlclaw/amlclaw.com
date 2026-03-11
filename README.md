<!-- Badges -->
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](CHANGELOG.md)
[![Build](https://img.shields.io/github/actions/workflow/status/amlclaw/amlclaw.com/ci.yml?branch=main)](https://github.com/amlclaw/amlclaw.com/actions)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org)

# AMLClaw Web

> 🛡️ Open-source, self-hosted, AI-driven crypto AML compliance platform.

**Regulations in, compliance out — five-step automated pipeline powered by AI.**

Documents → Policies → Rules → Screening → Monitoring

---

## Table of Contents

- [Why AMLClaw?](#why-amlclaw)
- [What It Does](#what-it-does)
- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
- [Features](#features)
- [Supported AI Providers](#supported-ai-providers)
- [Built-in Rulesets & Scenarios](#built-in-rulesets--scenarios)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Development](#development)
- [Docker Deployment](#docker-deployment)
- [Translation / i18n](#translation--i18n)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Why AMLClaw?

Crypto AML compliance is broken. A new regulation drops — lawyers spend 2 weeks interpreting it, compliance experts spend a week writing rules, engineers spend another week shipping. Screening a single address? Half a day of manual work. Repeat next month.

**AMLClaw replaces that entire cycle with AI.**

| | Traditional | AMLClaw |
|---|---------|---------|
| **Understand regulations** | Lawyers + experts, 1–2 weeks | AI reads & generates policy in minutes |
| **Write detection rules** | Manual, days of work | AI auto-generates, visual editor to fine-tune |
| **Screen an address** | Manual, half a day | One click, report in < 5 min |
| **Continuous monitoring** | Manual spot-checks | 7×24 automated scheduling |
| **Audit trail** | Dig through emails | Full audit log, one-click export |

The end game of compliance isn't more people — it's a better system.

---

## What It Does

```
  Documents        Policies          Rules           Screening        Monitoring
 ───────────     ───────────     ───────────      ───────────      ───────────
│  40+ intl  │   │  AI reads  │   │ AI converts│   │ On-chain  │   │  Cron     │
│ regulations│ → │ & generates│ → │ to JSON    │ → │ tracing + │ → │ scheduler │
│ + uploads  │   │  policies  │   │  rules     │   │ risk match│   │ 7×24 auto │
 ───────────     ───────────     ───────────      ───────────      ───────────
     ①               ②               ③               ④               ⑤
```

1. **Documents** — Curated library of 40+ international AML regulations (FATF, MAS, SFC, VARA) plus custom uploads
2. **Policies** — AI reads regulatory docs and generates structured compliance policies (streaming)
3. **Rules** — AI converts policies into machine-readable detection rules (JSON) with visual editor
4. **Screening** — On-chain address screening via TrustIn KYA API, cross-referenced against your rules
5. **Monitoring** — Scheduled recurring screening with cron-based task scheduler & webhook alerts

Every step can run fully automated or with human-in-the-loop. Every action is audit-logged.

---

## Screenshots

### Dashboard
![Dashboard](public/screenshots/dashboard.png)

### Address Screening
![Screening Input & Report](public/screenshots/screening-1.png)
![Rule Triggers & Evidence Chains](public/screenshots/screening-2.png)

### On-Chain Graph
![Transaction Flow Graph](public/screenshots/screening-graph.png)

### AI-Generated Rules
![Rule Sets](public/screenshots/rules-1.png)
![Rule Details](public/screenshots/rules-2.png)

### Compliance Policies
![AI Policy Generation](public/screenshots/policies.png)

### Document Library
![40+ Regulatory Documents](public/screenshots/documents.png)

---

## Quick Start

```bash
git clone https://github.com/amlclaw/amlclaw.com.git
cd amlclaw.com
npm install
npm run dev
```

Open `http://localhost:3000` and go to **Settings** to configure your API keys.

### Required API Keys

| Key | What For | Where to Get |
|-----|----------|--------------|
| **AI Provider** (Claude / DeepSeek / Gemini) | Policy & rule generation | [Anthropic](https://console.anthropic.com) / [DeepSeek](https://platform.deepseek.com) / [Google AI](https://aistudio.google.com) |
| **TrustIn API Key** | Blockchain address screening | [trustin.info](https://trustin.info) (free tier: 100 req/day) |

All keys are configured through the in-app Settings page — no `.env` file editing required.

---

## Features

### ✨ Core Highlights

- 🤖 **Multi-AI** — Claude, DeepSeek, Gemini — switch anytime, no vendor lock-in
- 📋 **40+ regulations** built-in (FATF, MAS, SFC, VARA) across 3 jurisdictions
- 🔍 **On-chain screening** via TrustIn KYA API with evidence graph (1–5 hops, up to 1000 nodes)
- 📊 **Continuous monitoring** with cron scheduler & webhook alerts (Slack, Teams, PagerDuty)
- 🌍 **Bilingual** (English / 中文) with dark/light theme
- 🐳 **Docker ready** — one command to deploy
- 📁 **No database** — file-based storage, backup-friendly, deploy anywhere

### 🏢 Enterprise-Grade

- **API authentication** — Bearer token protection on all endpoints
- **Audit logging** — Append-only JSONL, tamper-resistant, full operation trail
- **Webhook integration** — Real-time alerts for high-risk events
- **Batch screening** — Up to 100 addresses per submission
- **Report export** — Markdown & PDF with custom branding
- **Self-hosted** — Data never leaves your server

---

## Supported AI Providers

| Provider | SDK | Models |
|----------|-----|--------|
| **Claude** (Anthropic) | `@anthropic-ai/sdk` | claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5 |
| **DeepSeek** | OpenAI-compatible | deepseek-chat, deepseek-reasoner |
| **Gemini** (Google) | `@google/genai` | gemini-2.0-flash, gemini-2.5-pro, gemini-2.5-flash |

Switch providers anytime from Settings. All AI features work with any provider.

---

## Built-in Rulesets & Scenarios

3 jurisdictions (Singapore MAS, Hong Kong SFC, Dubai VARA) × 5 screening scenarios (deposit, withdrawal, CDD, monitoring, full scan). See [docs/user-guide/rules.md](docs/user-guide/rules.md) and [docs/user-guide/screening.md](docs/user-guide/screening.md) for details.

---

## Configuration

All settings are managed through the in-app **Settings** page (`/settings`) — no `.env` file editing required. See [docs/user-guide/settings.md](docs/user-guide/settings.md) for details.

For Docker/headless deployments, copy `.env.example` to `.env.local` and set environment variables.

---

## Project Structure

```
app/(app)/        # Product pages (dashboard, documents, policies, rules, screening, ...)
app/api/          # API routes
components/       # React components by domain (documents/, policies/, rules/, ...)
lib/              # Core logic (ai.ts, storage.ts, settings.ts, scheduler.ts, ...)
data/             # Runtime data + built-in rulesets (file-based, no database)
references/       # 40+ regulatory source documents
prompts/          # AI prompt templates
docs/             # Full documentation
tests/            # Unit (vitest) + integration tests
```

See [docs/development/architecture.md](docs/development/architecture.md) for the full architecture guide.

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

### Quick Start with Docker

```bash
docker compose up -d
```

Open http://localhost:3000 and configure API keys in **Settings**.

### Build from Source

```bash
docker compose up -d --build
```

### Environment Variables

You can pass environment variables instead of using the Settings UI:

```yaml
environment:
  - TRUSTIN_API_KEY=your_key_here
```

Data is persisted in the `./data` directory via volume mount.

### Production Tips

- Mount `./data` to a persistent volume for data durability
- Use a reverse proxy (nginx/Caddy) for HTTPS
- Set `security.apiToken` in Settings for API authentication

---

## Translation / i18n

AMLClaw supports English and Chinese out of the box. Translation files live in [`locales/`](locales/):

```
locales/en.json   # English (default)
locales/zh.json   # 中文
```

Want to add a new language? See [`locales/README.md`](locales/README.md) for the full guide.

---

## Roadmap

- 🔗 **More chains** — Solana, Polygon, BSC, Arbitrum support
- 🇪🇺 **MiCA compliance** — EU Markets in Crypto-Assets regulation rulesets
- 🇺🇸 **US FinCEN** — BSA/AML rules for US-based entities
- 🌐 **SaaS version** — Managed cloud offering with team collaboration
- 📊 **Analytics dashboard** — Trend analysis, risk heatmaps, compliance KPIs
- 🔌 **Plugin system** — Custom data sources and screening providers
- 🤝 **Case management** — SAR filing workflow and investigation tools

---

## 📖 Documentation

Full documentation is available in the [`docs/`](docs/) directory:

- **[Getting Started](docs/getting-started.md)** — Clone, install, configure, and run
- **User Guide:** [Documents](docs/user-guide/documents.md) · [Policies](docs/user-guide/policies.md) · [Rules](docs/user-guide/rules.md) · [Screening](docs/user-guide/screening.md) · [Monitoring](docs/user-guide/monitoring.md) · [Audit Log](docs/user-guide/audit-log.md) · [Settings](docs/user-guide/settings.md)
- **API:** [Overview](docs/api/overview.md) · [Endpoints](docs/api/endpoints.md)
- **Deployment:** [Docker](docs/deployment/docker.md) · [Manual](docs/deployment/manual.md) · [Configuration](docs/deployment/configuration.md)
- **Development:** [Architecture](docs/development/architecture.md) · [Writing Rules](docs/development/writing-rules.md)

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting. AMLClaw is self-hosted by design — your data never leaves your server.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=amlclaw/amlclaw.com&type=Date)](https://star-history.com/#amlclaw/amlclaw.com&Date)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code standards, and PR process.

---

## License

[MIT](LICENSE)
