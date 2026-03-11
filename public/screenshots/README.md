# Screenshots Contribution Guide

## Specifications

- **Format:** PNG (preferred) or WebP
- **Resolution:** 1440×900 px (retina: 2880×1800 px, displayed at 1440×900)
- **Theme:** Capture both light and dark variants if possible
- **Naming:** `{page}-{variant}.png` (e.g., `dashboard-dark.png`, `screening-light.png`)
- **Max file size:** 500 KB per image (use [TinyPNG](https://tinypng.com) to compress)

## Required Screenshots

| Filename | Page | What to Capture |
|----------|------|-----------------|
| `dashboard.png` | Dashboard | Overview with sample data showing risk distribution chart and recent screenings |
| `documents.png` | Documents | Regulation library with built-in documents listed |
| `policies.png` | Policies | AI-generated policy with streaming output visible |
| `rules.png` | Rules | Visual rule editor showing threshold conditions |
| `screening.png` | Screening | Completed screening result with risk graph and evidence chain |
| `monitoring.png` | Monitoring | Active monitoring tasks with schedule and status |
| `settings.png` | Settings | Settings page showing AI provider configuration |
| `landing.png` | Landing Page | Hero section of the public landing page |

## How to Capture

1. Run the app locally: `npm run dev`
2. Populate with sample data (use the built-in MAS ruleset)
3. Use browser DevTools device toolbar → set viewport to **1440×900**
4. Take full-page or viewport screenshots
5. Compress before committing

## Submitting

Add screenshots via PR. Update the `README.md` image references if adding new ones.
