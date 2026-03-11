# Locales — Translation Files

This directory contains JSON translation files for AMLClaw Web's i18n system.

## Structure

```
locales/
├── en.json          # English (default / fallback)
├── zh.json          # Chinese (简体中文)
└── README.md        # This file
```

## How to Add a New Language

1. **Copy** `en.json` to `<locale>.json` (e.g. `ja.json` for Japanese)
2. **Translate** all values (keep keys unchanged)
3. **Register** the new locale in `lib/i18n.ts`:
   - Add `import <locale> from "@/locales/<locale>.json";`
   - Add it to the `Locale` type: `export type Locale = "en" | "zh" | "<locale>";`
   - Add it to the `translations` record
4. **Update** the language switcher in `components/Sidebar.tsx` if needed
5. **Run** `npm run build && npm run lint && npm run test:unit` to verify

## Key Naming Convention

Keys use **dot-separated namespaces**:

| Prefix | Usage | Example |
|--------|-------|---------|
| `nav.*` | Sidebar navigation | `nav.dashboard` |
| `dashboard.*` | Dashboard page | `dashboard.title` |
| `screening.*` | Screening page | `screening.startScreening` |
| `batch.*` | Batch screening | `batch.title` |
| `report.*` | Screening report | `report.riskScore` |
| `audit.*` | Audit log page | `audit.title` |
| `settings.*` | Settings page | `settings.save` |
| `common.*` | Shared UI elements | `common.loading` |
| `risk.*` | Risk level labels | `risk.severe` |

### Rules

- Use **camelCase** after the dot: `dashboard.totalScreenings` ✅ `dashboard.total-screenings` ❌
- Keep keys **descriptive but concise**
- Every key in `en.json` **must** exist in all other locale files (TypeScript will catch mismatches at build time)

## Contribution Workflow

1. Fork the repository
2. Create a branch: `git checkout -b i18n/<locale>`
3. Add/update the locale JSON file
4. Ensure all keys from `en.json` are present
5. Run `npm run build` to verify type safety
6. Submit a pull request with title: `i18n: add <language> translation`
