/**
 * Settings storage — file-based at data/settings.json
 * Single-user self-hosted model: API keys stored in settings file.
 */
import fs from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

export interface Settings {
  // API Keys
  api: {
    /** Width.info / TrustIn V3 screening API key (required for screening). */
    widthApiKey: string;
    /** V3 API base URL. width.info is the docs site; requests go to api.trustin.bond. */
    widthBaseUrl: string;
    /** Etherscan API key — optional; empty = shared default key (rate-limited). */
    etherscanApiKey: string;
    /** TronGrid API key — optional; empty = anonymous access (rate-limited). */
    trongridApiKey: string;
  };

  // Screening Defaults
  screening: {
    defaultInflowHops: number;
    defaultOutflowHops: number;
    maxNodesPerHop: number;
    maxOpponentPaths: number;
    minAmount: number;
    defaultScenario: string;
    /** Server-side ruleset id. 0 = builtin default. */
    defaultKyaRulesetId: number;
    defaultKytInRulesetId: number;
    defaultKytOutRulesetId: number;
    pollingTimeout: number; // seconds
  };

  // Monitoring Defaults
  monitoring: {
    defaultSchedule: string;
    /** Address monitors: max transactions screened per run (excess skipped). */
    maxTxPerRun: number;
    /** Address monitors: default minimum transfer amount (token units). */
    defaultMinAmount: number;
  };

  // Notifications
  notifications: {
    webhookUrl: string;
    webhookEnabled: boolean;
    alertOnHighRisk: boolean;
  };

  // Security
  security: {
    apiToken: string; // empty = open access (no auth required)
  };

  // Application
  app: {
    name: string;
    reportHeader: string;
    themeDefault: "dark" | "light";
  };
}

export const DEFAULT_SETTINGS: Settings = {
  api: {
    widthApiKey: "",
    widthBaseUrl: "https://api.trustin.bond",
    etherscanApiKey: "",
    trongridApiKey: "",
  },
  screening: {
    defaultInflowHops: 3,
    defaultOutflowHops: 3,
    maxNodesPerHop: 200,
    maxOpponentPaths: 50,
    minAmount: 10,
    defaultScenario: "all",
    defaultKyaRulesetId: 0,
    defaultKytInRulesetId: 0,
    defaultKytOutRulesetId: 0,
    pollingTimeout: 180,
  },
  monitoring: {
    defaultSchedule: "every_4h",
    maxTxPerRun: 20,
    defaultMinAmount: 10,
  },
  notifications: {
    webhookUrl: "",
    webhookEnabled: false,
    alertOnHighRisk: true,
  },
  security: {
    apiToken: "",
  },
  app: {
    name: "AMLClaw",
    reportHeader: "",
    themeDefault: "dark",
  },
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/** Sections that belong to the current settings shape. */
const VALID_SECTIONS = new Set(["api", "screening", "monitoring", "notifications", "security", "app"]);

export function getSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
      const saved = JSON.parse(raw);
      return deepMerge(
        DEFAULT_SETTINGS as unknown as Record<string, unknown>,
        pruneUnknown(saved)
      ) as unknown as Settings;
    }
  } catch { /* corrupt file — return defaults */ }

  const settings = structuredClone(DEFAULT_SETTINGS);
  if (process.env.WIDTH_API_KEY) {
    settings.api.widthApiKey = process.env.WIDTH_API_KEY;
  }
  return settings;
}

function pruneUnknown(saved: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(saved)) {
    if (VALID_SECTIONS.has(key)) out[key] = saved[key];
  }
  return out;
}

export function updateSettings(partial: Partial<Settings>): Settings {
  const current = getSettings();
  const merged = deepMerge(
    current as unknown as Record<string, unknown>,
    partial as unknown as Record<string, unknown>
  ) as unknown as Settings;

  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2));

  return merged;
}

export function getWidthApiKey(): string {
  const settings = getSettings();
  return settings.api.widthApiKey || process.env.WIDTH_API_KEY || "";
}

export function getWidthBaseUrl(): string {
  const settings = getSettings();
  return (settings.api.widthBaseUrl || DEFAULT_SETTINGS.api.widthBaseUrl).replace(/\/+$/, "");
}

export function getEtherscanApiKey(): string {
  const settings = getSettings();
  return settings.api.etherscanApiKey || process.env.ETHERSCAN_API_KEY || "";
}

export function getTrongridApiKey(): string {
  const settings = getSettings();
  return settings.api.trongridApiKey || process.env.TRONGRID_API_KEY || "";
}

/**
 * One-time migration: legacy (trustin/ai/sar era) settings → v3 shape.
 * Preserves notifications / security / app; maps screening defaults where
 * they still exist; drops everything else.
 */
function migrateSettingsIfNeeded(): void {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return;
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const saved = JSON.parse(raw);
    if (saved.api || (!saved.blockchain && !saved.ai && !saved.sar && !saved.demo)) return; // already migrated

    const legacyScreening = (saved.screening as Record<string, unknown>) || {};
    const migrated: Record<string, unknown> = {
      api: structuredClone(DEFAULT_SETTINGS.api),
      screening: {
        ...structuredClone(DEFAULT_SETTINGS.screening),
        defaultInflowHops: legacyScreening.defaultInflowHops ?? 3,
        defaultOutflowHops: legacyScreening.defaultOutflowHops ?? 3,
      },
      monitoring: {
        ...structuredClone(DEFAULT_SETTINGS.monitoring),
        defaultSchedule:
          ((saved.monitoring as Record<string, unknown>)?.defaultSchedule as string) || "every_4h",
      },
      notifications: saved.notifications ?? structuredClone(DEFAULT_SETTINGS.notifications),
      security: saved.security ?? structuredClone(DEFAULT_SETTINGS.security),
      app: saved.app ?? structuredClone(DEFAULT_SETTINGS.app),
    };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(migrated, null, 2));
    console.log("[settings] Migrated legacy settings to v3 (width.info) format");
  } catch { /* best-effort */ }
}

// Run migration on first import
migrateSettingsIfNeeded();
