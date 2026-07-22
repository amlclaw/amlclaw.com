/**
 * Unit tests for lib/settings.ts — settings read/write, default merging (v3 shape)
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
  delete process.env.WIDTH_API_KEY;
  delete process.env.ETHERSCAN_API_KEY;
  delete process.env.TRONGRID_API_KEY;
});

import {
  getSettings,
  updateSettings,
  getWidthApiKey,
  getWidthBaseUrl,
  getEtherscanApiKey,
  DEFAULT_SETTINGS,
  type Settings,
} from "@/lib/settings";

describe("settings", () => {
  describe("getSettings", () => {
    it("returns defaults when no file exists", () => {
      const s = getSettings();
      expect(s.api.widthApiKey).toBe("");
      expect(s.api.widthBaseUrl).toBe("https://api.trustin.bond");
      expect(s.screening.defaultInflowHops).toBe(3);
      expect(s.screening.defaultKyaRulesetId).toBe(0);
      expect(s.monitoring.maxTxPerRun).toBe(20);
      expect(s.security.apiToken).toBe("");
    });

    it("merges saved settings with defaults", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ api: { widthApiKey: "test-key" } })
      );
      const s = getSettings();
      expect(s.api.widthApiKey).toBe("test-key");
      // Missing keys filled from defaults
      expect(s.api.widthBaseUrl).toBe("https://api.trustin.bond");
      expect(s.screening.maxNodesPerHop).toBe(DEFAULT_SETTINGS.screening.maxNodesPerHop);
    });

    it("drops unknown legacy sections", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ api: { widthApiKey: "k" }, blockchain: { trustinApiKey: "old" }, ai: { model: "x" } })
      );
      const s = getSettings() as unknown as Record<string, unknown>;
      expect(s.blockchain).toBeUndefined();
      expect(s.ai).toBeUndefined();
    });

    it("returns defaults on corrupt file", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("{not json");
      const s = getSettings();
      expect(s.api.widthBaseUrl).toBe("https://api.trustin.bond");
    });

    it("falls back to WIDTH_API_KEY env var when no file", () => {
      process.env.WIDTH_API_KEY = "env-key";
      const s = getSettings();
      expect(s.api.widthApiKey).toBe("env-key");
    });
  });

  describe("updateSettings", () => {
    it("deep-merges partial updates and writes to disk", () => {
      const updated = updateSettings({ api: { widthApiKey: "new-key" } } as unknown as Partial<Settings>);
      expect(updated.api.widthApiKey).toBe("new-key");
      expect(updated.api.widthBaseUrl).toBe("https://api.trustin.bond");
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("key getters", () => {
    it("getWidthApiKey prefers settings over env", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ api: { widthApiKey: "file-key" } }));
      process.env.WIDTH_API_KEY = "env-key";
      expect(getWidthApiKey()).toBe("file-key");
    });

    it("getWidthApiKey falls back to env", () => {
      process.env.WIDTH_API_KEY = "env-key";
      expect(getWidthApiKey()).toBe("env-key");
    });

    it("getWidthBaseUrl strips trailing slash", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ api: { widthBaseUrl: "https://x.example/" } }));
      expect(getWidthBaseUrl()).toBe("https://x.example");
    });

    it("getEtherscanApiKey returns empty when unset", () => {
      expect(getEtherscanApiKey()).toBe("");
    });
  });
});
