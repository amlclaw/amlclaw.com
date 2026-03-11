# AMLClaw Web Documentation

> 🛡️ Open-source, self-hosted, AI-driven crypto AML compliance platform.

Welcome to the AMLClaw Web documentation. This guide covers everything from getting started to advanced deployment and API integration.

## Overview

AMLClaw Web provides a five-step automated AML compliance pipeline:

```
Documents → Policies → Rules → Screening → Monitoring
```

1. **Documents** — Curated library of 40+ international AML regulations
2. **Policies** — AI-generated structured compliance policies from regulatory docs
3. **Rules** — Machine-readable detection rules (JSON) converted from policies
4. **Screening** — On-chain address screening via TrustIn KYA API
5. **Monitoring** — Scheduled recurring screening with cron-based scheduler

## Documentation Index

### 🚀 [Getting Started](getting-started.md)
Clone, install, configure, and run — including Docker deployment.

### 📘 User Guide
- [Documents — Regulatory Document Library](user-guide/documents.md)
- [Policies — AI Policy Generation](user-guide/policies.md)
- [Rules — Rule Engine & Visual Editor](user-guide/rules.md)
- [Screening — Address Screening](user-guide/screening.md)
- [Monitoring — Continuous Monitoring](user-guide/monitoring.md)
- [Audit Log](user-guide/audit-log.md)
- [Settings](user-guide/settings.md)

### 🔌 API Reference
- [API Overview — Authentication & Conventions](api/overview.md)
- [API Endpoints](api/endpoints.md)

### 🚢 Deployment
- [Docker Deployment](deployment/docker.md)
- [Manual Deployment](deployment/manual.md)
- [Configuration Reference](deployment/configuration.md)

### 🛠 Development
- [Architecture](development/architecture.md)
- [Writing Custom Rules](development/writing-rules.md)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + Tailwind CSS 4 |
| AI | Claude, DeepSeek, Gemini (multi-provider) |
| Blockchain Data | TrustIn KYA v2 API |
| Storage | File-based (no database) |
| i18n | English / 中文 |

## License

[MIT](../LICENSE)
