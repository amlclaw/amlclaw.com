# Configuration Reference

All configuration is managed through the Settings UI (`/settings`) and stored in `data/settings.json`.

## Settings Structure

```json
{
  "ai": {
    "activeProvider": "claude",
    "claude": { "apiKey": "sk-ant-...", "model": "claude-sonnet-4-6", "baseUrl": "" },
    "deepseek": { "apiKey": "sk-...", "model": "deepseek-chat", "baseUrl": "" },
    "gemini": { "apiKey": "...", "model": "gemini-2.0-flash", "baseUrl": "" }
  },
  "blockchain": {
    "trustinApiKey": "...",
    "trustinBaseUrl": "https://api.trustin.info"
  },
  "screening": {
    "inflowHops": 2,
    "outflowHops": 2,
    "maxNodes": 100,
    "defaultScenario": "all",
    "defaultRuleset": "",
    "pollingTimeout": 120
  },
  "monitoring": {
    "maxAddressesPerTask": 50,
    "defaultSchedule": "every_24h"
  },
  "notifications": {
    "webhookUrl": "",
    "enabled": false,
    "alertHighRiskOnly": true
  },
  "security": {
    "apiToken": ""
  },
  "app": {
    "name": "AMLClaw",
    "reportHeader": "",
    "defaultTheme": "dark"
  }
}
```

## Configuration Details

### AI Provider (`ai`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `activeProvider` | string | `"claude"` | Active provider: `claude`, `deepseek`, or `gemini` |
| `{provider}.apiKey` | string | `""` | API key for the provider |
| `{provider}.model` | string | varies | Model identifier |
| `{provider}.baseUrl` | string | `""` | Custom API endpoint (optional, for proxies) |

### Blockchain (`blockchain`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `trustinApiKey` | string | `""` | TrustIn KYA v2 API key |
| `trustinBaseUrl` | string | `"https://api.trustin.info"` | TrustIn API base URL |

### Screening (`screening`)

| Field | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| `inflowHops` | number | 1-5 | `2` | Inbound transaction hops to trace |
| `outflowHops` | number | 1-5 | `2` | Outbound transaction hops to trace |
| `maxNodes` | number | 10-1000 | `100` | Maximum nodes in transaction graph |
| `defaultScenario` | string | — | `"all"` | Default screening scenario |
| `defaultRuleset` | string | — | `""` | Default ruleset ID |
| `pollingTimeout` | number | — | `120` | Max seconds to wait for TrustIn results |

### Monitoring (`monitoring`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxAddressesPerTask` | number | `50` | Max addresses per monitor task |
| `defaultSchedule` | string | `"every_24h"` | Default cron schedule for new monitors |

### Notifications (`notifications`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `webhookUrl` | string | `""` | HTTP endpoint for webhook alerts |
| `enabled` | boolean | `false` | Enable/disable webhook notifications |
| `alertHighRiskOnly` | boolean | `true` | Only alert on Severe/High risk |

### Security (`security`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apiToken` | string | `""` | Bearer token for API auth (empty = open) |

### Application (`app`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | `"AMLClaw"` | App name (UI branding + reports) |
| `reportHeader` | string | `""` | Custom header for exported reports |
| `defaultTheme` | string | `"dark"` | Default theme: `dark` or `light` |

## Environment Variables

For legacy compatibility and Docker deployments:

| Variable | Fallback For | Description |
|----------|-------------|-------------|
| `TRUSTIN_API_KEY` | `blockchain.trustinApiKey` | TrustIn API key |
| `NODE_ENV` | — | `production` or `development` |
| `PORT` | — | Server port (default: 3000) |
| `HOSTNAME` | — | Bind address (default: `0.0.0.0` in Docker) |

Settings UI values always take priority over environment variables.

## File Locations

| Path | Description |
|------|-------------|
| `data/settings.json` | All configuration |
| `data/policies/` | Generated/uploaded policies |
| `data/rulesets/` | Custom rulesets |
| `data/defaults/` | Built-in rulesets (read-only) |
| `data/history/` | Screening results |
| `data/monitors/` | Monitor configs and runs |
| `data/audit/log.jsonl` | Audit log |
| `data/.ai-lock.json` | AI job lock file |
| `references/` | Built-in regulatory documents |
| `prompts/` | AI prompt templates |
