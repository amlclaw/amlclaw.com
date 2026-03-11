/**
 * Settings storage — file-based at data/settings.json
 * Single-user self-hosted model: API keys stored in settings file.
 */
import fs from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

export type AIProvider = "claude" | "deepseek" | "gemini";

export interface AIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface Settings {
  // AI Provider
  ai: {
    activeProvider: AIProvider;
    providers: Record<AIProvider, AIProviderConfig>;
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

  // Embedding / Vector Search
  embedding: {
    apiKey: string;
    model: string;
  };

  // Demo Mode
  demo: {
    enabled: boolean;
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
    activeProvider: "claude",
    providers: {
      claude: {
        apiKey: "",
        model: "claude-sonnet-4-6",
        baseUrl: "",
      },
      deepseek: {
        apiKey: "",
        model: "deepseek-chat",
        baseUrl: "https://api.deepseek.com",
      },
      gemini: {
        apiKey: "",
        model: "gemini-2.0-flash",
        baseUrl: "",
      },
    },
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
  embedding: {
    apiKey: "",
    model: "text-embedding-3-small",
  },
  demo: {
    enabled: false,
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
 * Get the active AI provider configuration.
 */
export function getActiveAIConfig(): { provider: AIProvider; config: AIProviderConfig } {
  const settings = getSettings();
  const provider = settings.ai.activeProvider;
  const config = settings.ai.providers[provider];
  return { provider, config };
}
