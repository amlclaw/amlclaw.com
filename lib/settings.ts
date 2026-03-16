/**
 * Settings storage — file-based at data/settings.json
 * Single-user self-hosted model: API keys stored in settings file.
 */
import fs from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

export interface Settings {
  // AI Engine (Claude Code SDK)
  ai: {
    oauthToken: string;
    model: string;
    maxTurns: number;
    maxBudgetUsd: number;
  };

  // Blockchain Data Source
  blockchain: {
    trustinApiKey: string;
    trustinBaseUrl: string;
  };

  // Screening Defaults
  screening: {
    defaultInflowHops: number;
    defaultOutflowHops: number;
    maxNodes: number;
    defaultScenario: string;
    defaultRuleset: string;
    pollingTimeout: number; // seconds
  };

  // Monitoring Defaults
  monitoring: {
    maxAddressesPerTask: number;
    defaultSchedule: string;
  };

  // Storage & Limits
  storage: {
    historyCap: number;
    dataDirectory: string;
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

  // Demo Mode
  demo: {
    enabled: boolean;
  };

  // SAR Configuration
  sar: {
    institution_name: string;
    license_number: string;
    compliance_officer: string;
    default_jurisdiction: string;
    auto_reference_prefix: string;
  };

  // Application
  app: {
    name: string;
    reportHeader: string;
    themeDefault: "dark" | "light";
  };
}

export const DEFAULT_SETTINGS: Settings = {
  ai: {
    oauthToken: "",
    model: "claude-sonnet-4-6",
    maxTurns: 10,
    maxBudgetUsd: 1.00,
  },
  blockchain: {
    trustinApiKey: "",
    trustinBaseUrl: "https://api.trustin.info/api/v2/investigate",
  },
  screening: {
    defaultInflowHops: 3,
    defaultOutflowHops: 3,
    maxNodes: 100,
    defaultScenario: "deposit",
    defaultRuleset: "singapore_mas",
    pollingTimeout: 60,
  },
  monitoring: {
    maxAddressesPerTask: 20,
    defaultSchedule: "every_4h",
  },
  storage: {
    historyCap: 100,
    dataDirectory: "data/",
  },
  notifications: {
    webhookUrl: "",
    webhookEnabled: false,
    alertOnHighRisk: true,
  },
  security: {
    apiToken: "",
  },
  demo: {
    enabled: false,
  },
  sar: {
    institution_name: "",
    license_number: "",
    compliance_officer: "",
    default_jurisdiction: "generic",
    auto_reference_prefix: "SAR",
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

export function getSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
      const saved = JSON.parse(raw);
      // Deep merge with defaults to fill any missing keys
      return deepMerge(
        DEFAULT_SETTINGS as unknown as Record<string, unknown>,
        saved
      ) as unknown as Settings;
    }
  } catch { /* corrupt file — return defaults */ }

  // Fallback: check env vars for backward compatibility
  const settings = structuredClone(DEFAULT_SETTINGS);
  if (process.env.TRUSTIN_API_KEY) {
    settings.blockchain.trustinApiKey = process.env.TRUSTIN_API_KEY;
  }
  return settings;
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

/**
 * Get the TrustIn API key — from settings first, env var fallback.
 */
export function getTrustInApiKey(): string {
  const settings = getSettings();
  return settings.blockchain.trustinApiKey || process.env.TRUSTIN_API_KEY || "";
}

/**
 * Get the TrustIn base URL from settings.
 */
export function getTrustInBaseUrl(): string {
  const settings = getSettings();
  return settings.blockchain.trustinBaseUrl || DEFAULT_SETTINGS.blockchain.trustinBaseUrl;
}

/**
 * Check if demo mode is enabled.
 */
export function isDemoMode(): boolean {
  const settings = getSettings();
  return settings.demo?.enabled ?? false;
}

/**
 * Get the Claude Code SDK configuration.
 */
export function getAIConfig(): { oauthToken: string; model: string; maxTurns: number; maxBudgetUsd: number } {
  const settings = getSettings();
  return {
    oauthToken: settings.ai.oauthToken || process.env.CLAUDE_CODE_OAUTH_TOKEN || "",
    model: settings.ai.model || "claude-sonnet-4-6",
    maxTurns: settings.ai.maxTurns || 10,
    maxBudgetUsd: settings.ai.maxBudgetUsd || 1.00,
  };
}

/**
 * One-time migration: old multi-provider format → Claude Code SDK format.
 */
function migrateSettingsIfNeeded(): void {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return;
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    const saved = JSON.parse(raw);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (saved.ai && ((saved.ai as any).activeProvider || (saved.ai as any).providers)) {
      saved.ai = {
        oauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN || "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: (saved.ai as any).providers?.claude?.model || "claude-sonnet-4-6",
        maxTurns: 10,
        maxBudgetUsd: 1.00,
      };
      // Remove old embedding section
      delete saved.embedding;
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(saved, null, 2));
      console.log("[settings] Migrated AI settings to Claude Code SDK format");
    }
  } catch { /* best-effort */ }
}

// Run migration on first import
migrateSettingsIfNeeded();
