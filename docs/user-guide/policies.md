# Policies — AI Policy Generation

The Policies page (`/policies`) lets you generate structured AML compliance policies from regulatory documents using AI.

## How It Works

1. Select one or more regulatory documents from your library
2. Click **Generate** — the AI reads the documents and produces a structured compliance policy
3. The policy is streamed in real-time via SSE (Server-Sent Events)
4. The result is saved as a Markdown file in `data/policies/`

## Generating a Policy

1. Navigate to **Policies** in the sidebar
2. Click **Generate New Policy**
3. Select source documents (e.g., MAS PSN02, FATF recommendations)
4. The AI will analyze the regulations and generate a structured policy covering:
   - Scope and applicability
   - Customer due diligence (CDD) requirements
   - Transaction monitoring thresholds
   - Suspicious activity reporting
   - Record-keeping obligations
   - Sanctions screening requirements

The generation streams in real-time — you can watch the policy being written.

## Managing Policies

- **View** — Click any policy to read its full content
- **Delete** — Remove policies you no longer need
- **Upload** — Import an existing policy document (Markdown format)

Policies are stored as Markdown files at `data/policies/{id}.md` with an index at `data/policies/_index.json`.

## Using Policies in the Pipeline

Policies feed into the next step — **Rule Generation**:

1. Go to **Rules** page
2. Select a policy as source material
3. The AI converts the policy's requirements into machine-readable detection rules (JSON)

## AI Provider

Policy generation uses whichever AI provider is active in Settings:

| Provider | Models |
|----------|--------|
| Claude (Anthropic) | claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5 |
| DeepSeek | deepseek-chat, deepseek-reasoner |
| Gemini (Google) | gemini-2.0-flash, gemini-2.5-pro, gemini-2.5-flash |

Only one AI job runs at a time (file-based lock at `data/.ai-lock.json`).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/policies` | List all policies |
| `GET` | `/api/policies/{policyId}` | Get policy content |
| `POST` | `/api/policies/generate` | Generate policy (SSE stream) |
| `POST` | `/api/policies/upload` | Upload existing policy |
| `DELETE` | `/api/policies/{policyId}` | Delete a policy |
