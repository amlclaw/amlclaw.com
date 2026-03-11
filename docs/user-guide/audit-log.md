# Audit Log

The Audit Log page (`/audit`) provides a tamper-evident record of all key operations in the system.

## What's Logged

All significant operations are automatically recorded:

- **Screening** — start, complete, error, export
- **Rulesets** — create, update, delete
- **Policies** — create, update, delete
- **Monitors** — create, update, delete, run results
- **Settings** — configuration changes
- **Webhooks** — delivery attempts and results

## Viewing the Audit Log

Navigate to **Audit Log** in the sidebar. The log view supports:

- **Filtering** by event type
- **Pagination** for browsing through entries
- **Timestamps** for each event

Each entry includes:

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "event": "screening.complete",
  "data": {
    "jobId": "...",
    "address": "0x...",
    "riskLevel": "High"
  }
}
```

## Storage

The audit log is an **append-only JSON Lines** file at `data/audit/log.jsonl`. Each line is a self-contained JSON object.

- **Format:** JSONL (one JSON object per line)
- **Cap:** 10,000 events maximum (oldest entries are rotated out)
- **Immutable:** Events are only appended, never modified

## API Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit` | Query audit log with filtering and pagination |

Query parameters: `type` (event type filter), `limit`, `offset`.
