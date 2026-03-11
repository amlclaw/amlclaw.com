# Getting Started

Get AMLClaw Web running in under 5 minutes.

## Prerequisites

- **Node.js 22+** (for manual install)
- **Docker** (for containerized deployment)
- At least one AI provider API key (Claude, DeepSeek, or Gemini)
- TrustIn API key for blockchain screening (optional for initial setup)

## Option 1: Docker (Recommended)

```bash
git clone https://github.com/amlclaw/amlclaw-web.git
cd amlclaw-web
docker compose up -d
```

Open http://localhost:3000. That's it. Data persists in `./data/` via volume mount.

## Option 2: Manual Install

```bash
git clone https://github.com/amlclaw/amlclaw-web.git
cd amlclaw-web
npm install
npm run dev
```

Open http://localhost:3000.

For production:

```bash
npm run build
npm start
```

## Initial Configuration

1. Navigate to **Settings** (`/settings`) in the sidebar
2. Configure your **AI Provider**:
   - Select a provider (Claude / DeepSeek / Gemini)
   - Enter the API key and select a model
   - Click "Test Connection" to verify
3. Configure **Blockchain** (for screening):
   - Enter your TrustIn API key
   - Test connection
4. Adjust screening defaults, monitoring schedule, and other settings as needed

> **No `.env` file required.** All configuration is done through the Settings UI and stored in `data/settings.json`. Legacy `TRUSTIN_API_KEY` env var is supported as fallback.

## Required API Keys

| Key | Purpose | Where to Get |
|-----|---------|-------------|
| AI Provider | Policy & rule generation | [Anthropic](https://console.anthropic.com) / [DeepSeek](https://platform.deepseek.com) / [Google AI](https://aistudio.google.com) |
| TrustIn API | Blockchain screening | [trustin.info](https://trustin.info) (free tier: 100 req/day) |

## First Workflow

Once configured, follow the five-step pipeline:

1. **Documents** → Browse the built-in regulatory library (40+ documents) or upload your own
2. **Policies** → Select documents and generate an AI compliance policy
3. **Rules** → Generate machine-readable detection rules from your policy
4. **Screening** → Enter a blockchain address to screen against your rules
5. **Monitoring** → Set up recurring screening for ongoing compliance

## What's Next

- [User Guide](user-guide/documents.md) — Detailed walkthrough of each feature
- [API Reference](api/overview.md) — Integrate via REST API
- [Deployment Guide](deployment/docker.md) — Production deployment best practices
