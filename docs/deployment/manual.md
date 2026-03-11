# Manual Deployment

Deploy AMLClaw Web without Docker on any system with Node.js.

## Prerequisites

- **Node.js 22+**
- **npm** (included with Node.js)

## Steps

### 1. Clone and Install

```bash
git clone https://github.com/amlclaw/amlclaw-web.git
cd amlclaw-web
npm ci
```

### 2. Build

```bash
npm run build
```

This creates an optimized production build in `.next/`.

### 3. Run

```bash
npm start
```

The server starts on port 3000 by default. Set the `PORT` environment variable to change:

```bash
PORT=8080 npm start
```

### 4. Configure

Open http://localhost:3000/settings and configure your API keys.

## Process Management

For production, use a process manager to keep the app running:

### Using PM2

```bash
npm install -g pm2
pm2 start npm --name amlclaw-web -- start
pm2 save
pm2 startup  # auto-start on reboot
```

### Using systemd

Create `/etc/systemd/system/amlclaw-web.service`:

```ini
[Unit]
Description=AMLClaw Web
After=network.target

[Service]
Type=simple
User=amlclaw
WorkingDirectory=/opt/amlclaw-web
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable amlclaw-web
sudo systemctl start amlclaw-web
```

## Data Directory

All data is stored in `./data/` relative to the project root. Ensure this directory:

- Is writable by the application user
- Is backed up regularly
- Has sufficient disk space

## Updates

```bash
cd /path/to/amlclaw-web
git pull
npm ci
npm run build
# Restart the process (pm2 restart / systemctl restart)
```

## HTTPS

Use a reverse proxy (nginx, Caddy) for TLS. See [Docker deployment](docker.md#reverse-proxy-https) for an example nginx config.
