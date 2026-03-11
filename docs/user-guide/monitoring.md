# Monitoring — Continuous Monitoring

The Monitoring page (`/monitoring`) lets you set up recurring automated screening for blockchain addresses on a schedule.

## How It Works

- Create a **monitor** with one or more addresses and a cron schedule
- The built-in `node-cron` scheduler automatically runs screening jobs at the configured interval
- Each run screens all addresses in the monitor using `executeMonitorTask()`
- Results are stored per-run for historical review
- High-risk results trigger **webhook notifications** if configured

## Creating a Monitor

1. Go to **Monitoring** in the sidebar
2. Click **Create Monitor**
3. Configure:
   - **Addresses** — list of blockchain addresses to watch (chain + address)
   - **Schedule** — how often to run (see presets below)
   - **Scenario** — which screening scenario to use
   - **Ruleset** — which detection rules to apply
4. Save — the monitor starts running on schedule

## Schedule Presets

| Preset | Cron Expression |
|--------|----------------|
| Every 1 hour | `0 * * * *` |
| Every 4 hours | `0 */4 * * *` |
| Every 8 hours | `0 */8 * * *` |
| Every 12 hours | `0 */12 * * *` |
| Every 24 hours | `0 0 * * *` |
| Custom | Any valid cron expression |

## Managing Monitors

- **View** — see monitor details, address list, and schedule
- **Run Now** — trigger an immediate run outside the schedule
- **View History** — browse past run results with timestamps
- **Edit** — change addresses, schedule, or screening parameters
- **Delete** — remove the monitor (run history is preserved for audit purposes)

## Scheduler Architecture

The scheduler is a singleton in-process `node-cron` instance:

- `ensureSchedulerInitialized()` is called lazily by every monitor API route
- The scheduler runs inside the Next.js server process
- On restart, active monitors are re-registered automatically

**Limitation:** Max addresses per task is configurable in Settings > Monitoring (to avoid API rate limits with TrustIn).

## Webhook Notifications

When a monitoring run detects **Severe** or **High** risk, a webhook notification is sent:

1. Configure webhook URL in **Settings > Notifications**
2. Enable "Alert on high risk only" (optional)
3. Webhook fires HTTP POST with payload:

```json
{
  "event": "monitor.high_risk",
  "timestamp": "2025-01-15T10:00:00Z",
  "data": {
    "monitorId": "...",
    "address": "0x...",
    "riskLevel": "High",
    "matchedRules": [...]
  }
}
```

Compatible with Slack incoming webhooks, Microsoft Teams, PagerDuty, and any HTTP endpoint.

## Storage

| File | Purpose |
|------|---------|
| `data/monitors/_index.json` | Monitor index |
| `data/monitors/{id}.json` | Monitor configuration |
| `data/monitors/{id}/runs/{runId}.json` | Individual run results |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/monitors` | List all monitors |
| `POST` | `/api/monitors` | Create a monitor |
| `GET` | `/api/monitors/{monitorId}` | Get monitor details |
| `PUT` | `/api/monitors/{monitorId}` | Update monitor |
| `DELETE` | `/api/monitors/{monitorId}` | Delete monitor |
| `POST` | `/api/monitors/{monitorId}/run` | Trigger immediate run |
| `GET` | `/api/monitors/{monitorId}/history` | Get run history |
| `GET` | `/api/monitors/scheduler/status` | Scheduler health check |
