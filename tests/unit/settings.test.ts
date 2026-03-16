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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockFs.mkdirSync.mockImplementation(() => "" as any);
  delete process.env.TRUSTIN_API_KEY;
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
});

import {
  getSettings,
  updateSettings,
  getTrustInApiKey,
  getTrustInBaseUrl,
  getAIConfig,
  DEFAULT_SETTINGS,
} from "@/lib/settings";

describe("settings", () => {
  describe("getSettings", () => {
    it("returns defaults when no file exists", () => {
      const s = getSettings();
      expect(s.ai.model).toBe("claude-sonnet-4-6");
      expect(s.ai.maxTurns).toBe(10);
      expect(s.screening.defaultInflowHops).toBe(3);
      expect(s.security.apiToken).toBe("");
    });

    it("merges saved settings with defaults", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        ai: { model: "claude-opus-4-6" },
        // screening section missing — should get defaults
      }));
      const s = getSettings();
      expect(s.ai.model).toBe("claude-opus-4-6");
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
      expect(s.ai.model).toBe("claude-sonnet-4-6");
    });
  });

  describe("updateSettings", () => {
    it("deep-merges partial update", () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = updateSettings({ security: { apiToken: "new-token" } });
      expect(result.security.apiToken).toBe("new-token");
      expect(result.ai.model).toBe("claude-sonnet-4-6"); // preserved default
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

  describe("getAIConfig", () => {
    it("returns default model and settings", () => {
      const config = getAIConfig();
      expect(config.model).toBe("claude-sonnet-4-6");
      expect(config.maxTurns).toBe(10);
      expect(config.maxBudgetUsd).toBe(1.00);
    });

    it("falls back to env var for oauth token", () => {
      process.env.CLAUDE_CODE_OAUTH_TOKEN = "test-token";
      const config = getAIConfig();
      expect(config.oauthToken).toBe("test-token");
    });
  });
});
