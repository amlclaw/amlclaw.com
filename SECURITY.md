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

- Data exfiltration from the `data/` directory
- Settings / API key exposure
- Cross-site scripting (XSS) in rendered content
- Server-side request forgery (SSRF) via webhook URLs

## Security Architecture

- **Self-hosted**: All data stays on your server — nothing is sent externally except to the configured Width.info, Etherscan and TronGrid API endpoints
- **Open by default**: AMLClaw is an open-source demo for the Width API; its local REST endpoints have no built-in auth — put it behind your own gateway / reverse proxy if you expose it
- **No database**: File-based storage eliminates SQL injection vectors
- **API keys**: Stored in `data/settings.json` (gitignored, server-side only, masked in API responses)

## Disclosure Policy

We follow coordinated disclosure. Once a fix is released, we will credit the reporter (unless anonymity is requested) in the release notes.
