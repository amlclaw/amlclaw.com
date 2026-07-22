# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [2.0.0] - 2026-07-22

Complete pivot to the width.info / TrustIn V3 screening API — rulesets now run server-side.

### Added
- **KYT Transaction Screening** (`/kyt`) — screen a tx hash with direction in/out/both, per-direction ruleset IDs (KYT-IN / KYT-OUT builtins), Chainalysis-aligned alerts
- **Address Monitoring** — watch an address's FUTURE stablecoin transfers (Etherscan v2 / TronGrid feeds); every new tx above the threshold is KYT-screened (receiving = in, sending = out); cursor starts at creation time so history is never re-scanned
- **KYT Monitoring** — watch a tx's from/to counterparty with periodic KYA re-screening and risk-escalation alerts
- `lib/width-api.ts` V3 client (sync KYA/KYT), `lib/chain-txs.ts` (tx feeds, cursor, tx endpoint resolution incl. Tron base58)
- "Go on Monitoring" / "Monitor from|to address" one-click buttons on screening results
- v3 risk vocabulary (low/medium/high/critical) across UI, history, webhooks

### Changed
- KYA screening now calls `POST /api/v3/screen/kya` — server-side ruleset engine (`ruleset_id`, `scenario`)
- Evidence graph fed by v3 `hits[].pathNodes` via a legacy-shape adapter (`hitsToEntities`)
- Settings rebuilt: width.info / Etherscan / TronGrid API keys, screening + monitoring defaults
- Dashboard rebuilt around KYA/KYT stats, dual monitor status, recent high-risk alerts
- Landing page rewritten for the KYA/KYT + dual-monitoring positioning

### Removed
- Documents / Policies / Rules modules (local rule engine superseded by server-side rulesets)
- Cases, SAR reports, Audit Log, AI Copilot and all AI-provider integrations
- Batch screening, demo mode, report PDF/MD export (to return in a later release)

## [1.0.0] - 2025-03-08

### Added

- Five-step AML compliance pipeline: Documents → Policies → Rules → Screening → Monitoring
- Multi-provider AI engine (Claude, DeepSeek, Gemini) with streaming support
- 40+ built-in international AML regulatory documents (FATF, MAS, SFC, VARA)
- AI-powered policy generation from regulatory documents
- AI-powered rule extraction from policies (JSON format)
- On-chain address screening via TrustIn KYA v2 API
- Batch screening (up to 100 addresses)
- Cron-based continuous monitoring scheduler
- 3 built-in rulesets: Singapore MAS, Hong Kong SFC, Dubai VARA
- 5 screening scenarios: deposit, withdrawal, CDD, monitoring, all
- Evidence graph visualization (@xyflow/react + dagre)
- Markdown and PDF report export
- Append-only audit log (JSONL)
- Webhook notifications for high-risk alerts
- Bearer token API authentication
- Bilingual UI (English / 中文)
- Dark/light theme
- File-based storage (no database required)
- Docker support
