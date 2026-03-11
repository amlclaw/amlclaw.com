# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅        |

## Reporting a Vulnerability

If you discover a security vulnerability in AMLClaw, please report it responsibly.

**Do NOT open a public issue.** Instead:

1. **Email**: Send details to **security@amlclaw.com**
2. **Include**: Description, reproduction steps, potential impact
3. **Response**: We will acknowledge within 48 hours and provide a timeline for a fix

## Scope

We take the following especially seriously given the compliance nature of this product:

- API authentication bypass
- Data exfiltration from `data/` directory
- Audit log tampering
- Settings/API key exposure
- Cross-site scripting (XSS) in rendered content
- Server-side request forgery (SSRF) via AI provider or webhook URLs

## Security Architecture

- **Self-hosted**: All data stays on your server — nothing is sent externally except to configured AI and blockchain API providers
- **API auth**: Bearer token authentication on all API endpoints (configurable in Settings)
- **Audit trail**: Append-only JSONL log of all operations
- **No database**: File-based storage eliminates SQL injection vectors
- **API keys**: Stored in `data/settings.json` (server-side only, masked in API responses)

## Disclosure Policy

We follow coordinated disclosure. Once a fix is released, we will credit the reporter (unless anonymity is requested) in the release notes.
