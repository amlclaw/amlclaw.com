# Settings

The Settings page (`/settings`) is the central configuration hub. All settings are stored in `data/settings.json` — no `.env` file editing required.

## Configuration Sections

### AI Provider

- **Active provider** — Claude, DeepSeek, or Gemini
- **API key** — per-provider key
- **Model** — select which model to use
- **Base URL** — custom endpoint (useful for proxies)
- **Test Connection** — verify your API key works

### Blockchain

- **TrustIn API key** — required for on-chain screening
- **Base URL** — TrustIn API endpoint (default: `https://api.trustin.info`)
- Fallback: `TRUSTIN_API_KEY` env var is supported

### Screening Defaults

- **Inflow hops** — how many hops to trace inbound (1-5)
- **Outflow hops** — how many hops to trace outbound (1-5)
- **Max nodes** — limit on graph nodes (10-1000)
- **Default scenario** — deposit, withdrawal, cdd, monitoring, or all
- **Default ruleset** — which ruleset to use by default
- **Polling timeout** — max wait for TrustIn results

### Monitoring

- **Max addresses per task** — limit per monitor to avoid rate limits
- **Default schedule** — default cron schedule for new monitors

### Notifications

- **Webhook URL** — HTTP endpoint for alerts (Slack, Teams, PagerDuty)
- **Enable/disable** — toggle webhook notifications
- **Alert on high risk only** — filter to Severe/High events

### Security

- **API token** — when set, all API requests require `Authorization: Bearer <token>`
- Empty token = open access (default for local development)

### Application

- **App name** — branding shown in UI and exported reports
- **Report header** — custom header text for PDF/Markdown exports
- **Default theme** — dark or light

## Settings Validation

The API validates all settings on save:

- Only known sections accepted (`ai`, `blockchain`, `screening`, `monitoring`, `storage`, `notifications`, `security`, `app`)
- Numeric range checks (hops 1-5, nodes 10-1000)
- Webhook URL format validation
- API keys are masked in GET responses for security

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Get current settings (keys masked) |
| `PUT` | `/api/settings` | Update settings (partial merge) |
| `POST` | `/api/settings/test-connection` | Test AI provider connection |
