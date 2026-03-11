# API Overview

AMLClaw Web exposes a REST API via Next.js API routes. All endpoints are under `/api/`.

## Base URL

```
http://localhost:3000/api
```

## Authentication

When `security.apiToken` is set in Settings, all API requests require a Bearer token:

```
Authorization: Bearer <your-api-token>
```

If no token is configured (default), all endpoints are open. This is suitable for local development or when access is controlled at the network level.

Configure the token in **Settings > Security** or via the API:

```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"security": {"apiToken": "my-secret-token"}}'
```

## Request Format

- **Content-Type:** `application/json` for POST/PUT requests
- **File uploads:** `multipart/form-data` for document/policy upload endpoints

## Response Format

All responses return JSON:

```json
{
  "data": { ... }
}
```

Error responses:

```json
{
  "error": "Description of what went wrong"
}
```

HTTP status codes follow standard conventions:
- `200` — Success
- `201` — Created
- `400` — Bad request / validation error
- `401` — Unauthorized (missing or invalid token)
- `404` — Not found
- `500` — Server error

## SSE Streaming

AI generation endpoints (`/api/policies/generate`, `/api/rulesets/generate`) use Server-Sent Events:

```
Content-Type: text/event-stream

data: {"text":"Generated content chunk..."}

data: {"text":"More content..."}

event: done
data: {"id":"generated-item-id"}
```

Client implementation:

```javascript
const response = await fetch('/api/policies/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ documentIds: ['doc1', 'doc2'] })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  // Parse SSE lines: "data: {...}\n\n"
}
```

## Async Job Pattern

Screening endpoints use an async polling pattern:

1. `POST /api/screening` → returns `{ jobId: "..." }` immediately
2. `GET /api/screening/{jobId}` → poll every 3s until `status === "complete"`

## Enums & Schema

`GET /api/schema/enums` returns valid enum values for scenarios, categories, severities, etc.

## AI Lock

Only one AI job (policy/rule generation) runs at a time. A file-based lock at `data/.ai-lock.json` prevents concurrent jobs. If a job is already running, the generate endpoint returns an error.

`GET /api/ai/status` returns the current lock status.
