# Docker Deployment

AMLClaw Web ships with a production-ready Dockerfile and docker-compose configuration.

## Quick Start

```bash
git clone https://github.com/amlclaw/amlclaw-web.git
cd amlclaw-web
docker compose up -d
```

Open http://localhost:3000 and configure API keys in **Settings**.

## Docker Compose

The included `docker-compose.yml`:

```yaml
services:
  amlclaw-web:
    build: .
    container_name: amlclaw-web
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      # Optional: set via environment instead of Settings UI
      # - TRUSTIN_API_KEY=your_trustin_api_key
    restart: unless-stopped
```

## Build Details

The Dockerfile uses a multi-stage build for minimal image size:

1. **deps** — Install production dependencies only (`npm ci --omit=dev`)
2. **builder** — Install all dependencies and build the Next.js app
3. **runner** — Alpine-based production image with:
   - Non-root user (`nextjs:nodejs`, UID/GID 1001)
   - Standalone Next.js output
   - Built-in data files (default rulesets, schemas, references, prompts)

Base image: `node:22-alpine`

## Data Persistence

The `./data` directory is mounted as a volume. It contains:

- `settings.json` — all configuration
- `policies/` — generated policies
- `rulesets/` — custom rulesets
- `history/` — screening results
- `monitors/` — monitor configs and run history
- `audit/` — audit log

**Important:** Back up the `data/` directory regularly. It contains all your configuration and results.

## Environment Variables

You can pass API keys via environment variables instead of the Settings UI:

```yaml
environment:
  - TRUSTIN_API_KEY=your_trustin_api_key
```

Settings UI values take priority over env vars. The env var serves as a fallback.

## Build from Source

```bash
docker compose up -d --build
```

Or build the image directly:

```bash
docker build -t amlclaw-web .
docker run -d -p 3000:3000 -v ./data:/app/data --name amlclaw-web amlclaw-web
```

## Production Recommendations

### Reverse Proxy (HTTPS)

Use nginx or Caddy as a reverse proxy for TLS termination:

```nginx
server {
    listen 443 ssl;
    server_name aml.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_buffering off;
        proxy_cache off;
    }
}
```

### API Authentication

Set an API token for production:

1. Go to **Settings > Security**
2. Set an API token
3. All API requests now require `Authorization: Bearer <token>`

### Resource Requirements

- **CPU:** 1 core minimum, 2+ recommended
- **RAM:** 512MB minimum (Node.js + Next.js)
- **Disk:** 1GB+ for data storage (depends on screening volume)
