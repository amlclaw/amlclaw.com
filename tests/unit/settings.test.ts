/**
 * Unit tests for lib/settings.ts — settings read/write, default merging
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";

vi.mock("fs");
const mockFs = vi.mocked(fs);

beforeEach(() => {
  vi.resetAllMocks();
  mockFs.existsSync.mockReturnValue(false);
  mockFs.readFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
  mockFs.writeFileSync.mockImplementation(() => {});
  mockFs.mkdirSync.mockImplementation(() => "" as any);
  delete process.env.TRUSTIN_API_KEY;
});

import {
  getSettings,
  updateSettings,
  getTrustInApiKey,
  getTrustInBaseUrl,
  getActiveAIConfig,
  DEFAULT_SETTINGS,
} from "@/lib/settings";

describe("settings", () => {
  describe("getSettings", () => {
    it("returns defaults when no file exists", () => {
      const s = getSettings();
      expect(s.ai.activeProvider).toBe("claude");
      expect(s.screening.defaultInflowHops).toBe(3);
      expect(s.security.apiToken).toBe("");
    });

    it("merges saved settings with defaults", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        ai: { activeProvider: "deepseek" },
        // screening section missing — should get defaults
      }));
      const s = getSettings();
      expect(s.ai.activeProvider).toBe("deepseek");
      expect(s.screening.defaultInflowHops).toBe(3); // from defaults
    });

    it("falls back to env var for TRUSTIN_API_KEY", () => {
      process.env.TRUSTIN_API_KEY = "env-key";
      const s = getSettings();
      expect(s.blockchain.trustinApiKey).toBe("env-key");
    });

    it("handles corrupt settings file gracefully", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("not valid json{{{");
      const s = getSettings();
      expect(s).toBeTruthy();
      expect(s.ai.activeProvider).toBe("claude");
    });
  });

  describe("updateSettings", () => {
    it("deep-merges partial update", () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = updateSettings({ security: { apiToken: "new-token" } });
      expect(result.security.apiToken).toBe("new-token");
      expect(result.ai.activeProvider).toBe("claude"); // preserved default
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("getTrustInApiKey", () => {
    it("returns settings value first", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        blockchain: { trustinApiKey: "settings-key" },
      }));
      expect(getTrustInApiKey()).toBe("settings-key");
    });

    it("falls back to env var", () => {
      process.env.TRUSTIN_API_KEY = "env-key";
      expect(getTrustInApiKey()).toBe("env-key");
    });

    it("returns empty string when nothing configured", () => {
      expect(getTrustInApiKey()).toBe("");
    });
  });

  describe("getTrustInBaseUrl", () => {
    it("returns default base URL", () => {
      expect(getTrustInBaseUrl()).toBe(DEFAULT_SETTINGS.blockchain.trustinBaseUrl);
    });
  });

  describe("getActiveAIConfig", () => {
    it("returns active provider and config", () => {
      const { provider, config } = getActiveAIConfig();
      expect(provider).toBe("claude");
      expect(config.model).toBe("claude-sonnet-4-6");
    });
  });
});
