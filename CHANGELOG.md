# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).

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
