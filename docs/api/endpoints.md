# API Endpoints

Complete reference of all AMLClaw Web API endpoints.

## Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/documents` | List all documents (built-in + uploaded) |
| `GET` | `/api/documents/{docId}` | Get document metadata |
| `GET` | `/api/documents/{docId}/content` | Get document full content |
| `POST` | `/api/documents/upload` | Upload a custom document (`multipart/form-data`) |

### GET /api/documents

Returns array of document objects with id, title, category, jurisdiction, and source info.

### POST /api/documents/upload

Upload a Markdown or text file as a custom regulatory document.

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@my-regulation.md"
```

---

## Policies

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/policies` | List all policies |
| `GET` | `/api/policies/{policyId}` | Get policy content |
| `POST` | `/api/policies/generate` | Generate policy from documents (SSE stream) |
| `POST` | `/api/policies/upload` | Upload existing policy |
| `DELETE` | `/api/policies/{policyId}` | Delete a policy |

### POST /api/policies/generate

Streams a new policy via SSE. Request body:

```json
{
  "documentIds": ["doc-id-1", "doc-id-2"]
}
```

Response: SSE stream (see [API Overview](overview.md#sse-streaming)).

---

## Rulesets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rulesets` | List all rulesets (built-in + custom) |
| `GET` | `/api/rulesets/{rulesetId}` | Get ruleset with all rules |
| `POST` | `/api/rulesets/generate` | Generate ruleset from policy (SSE stream) |
| `PUT` | `/api/rulesets/{rulesetId}` | Update ruleset metadata |
| `DELETE` | `/api/rulesets/{rulesetId}` | Delete a custom ruleset |
| `POST` | `/api/rulesets/{rulesetId}/validate` | Validate ruleset structure |

### Individual Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rulesets/{rulesetId}/rules` | List rules in a ruleset |
| `GET` | `/api/rulesets/{rulesetId}/rules/{ruleId}` | Get a single rule |
| `PUT` | `/api/rulesets/{rulesetId}/rules/{ruleId}` | Update a rule |
| `DELETE` | `/api/rulesets/{rulesetId}/rules/{ruleId}` | Delete a rule |

### POST /api/rulesets/generate

```json
{
  "policyId": "policy-id"
}
```

Response: SSE stream producing JSON rules.

---

## Screening

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/screening` | Start a screening job |
| `GET` | `/api/screening/{jobId}` | Poll job status and results |
| `GET` | `/api/screening/{jobId}/export` | Export results (`?format=md\|pdf`) |
| `POST` | `/api/screening/batch` | Batch screen multiple addresses |
| `GET` | `/api/screening/history` | List screening history |

### POST /api/screening

```json
{
  "address": "0x...",
  "chain": "ETH",
  "scenario": "deposit",
  "ruleset_id": "singapore_mas",
  "inflow_hops": 2,
  "outflow_hops": 2,
  "max_nodes": 100
}
```

Response: `{ "jobId": "job_xxx" }`

All parameters except `address` and `chain` fall back to Settings defaults.

### POST /api/screening/batch

```json
{
  "addresses": [
    { "chain": "ETH", "address": "0x..." },
    { "chain": "BTC", "address": "bc1..." }
  ],
  "scenario": "deposit",
  "ruleset_id": "singapore_mas"
}
```

Max 100 addresses per batch. Poll via `GET /api/screening/batch?id=batch_xxx`.

---

## Monitors

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/monitors` | List all monitors |
| `POST` | `/api/monitors` | Create a monitor |
| `GET` | `/api/monitors/{monitorId}` | Get monitor details |
| `PUT` | `/api/monitors/{monitorId}` | Update monitor |
| `DELETE` | `/api/monitors/{monitorId}` | Delete monitor |
| `POST` | `/api/monitors/{monitorId}/run` | Trigger immediate run |
| `GET` | `/api/monitors/{monitorId}/history` | Get run history |
| `GET` | `/api/monitors/scheduler/status` | Scheduler health status |

### POST /api/monitors

```json
{
  "name": "Hot wallet monitor",
  "addresses": [
    { "chain": "ETH", "address": "0x..." }
  ],
  "schedule": "every_4h",
  "scenario": "monitoring",
  "ruleset_id": "singapore_mas"
}
```

---

## Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/settings` | Get current settings (API keys masked) |
| `PUT` | `/api/settings` | Update settings (deep merge) |
| `POST` | `/api/settings/test-connection` | Test AI provider connection |

### PUT /api/settings

Accepts partial updates — only include sections you want to change:

```json
{
  "ai": {
    "activeProvider": "claude",
    "claude": {
      "apiKey": "sk-ant-...",
      "model": "claude-sonnet-4-6"
    }
  }
}
```

---

## Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit` | Query audit log (`?type=...&limit=...&offset=...`) |
| `GET` | `/api/dashboard` | Dashboard statistics |
| `GET` | `/api/schema/enums` | Valid enum values for scenarios, categories, etc. |
| `GET` | `/api/ai/status` | AI job lock status |
