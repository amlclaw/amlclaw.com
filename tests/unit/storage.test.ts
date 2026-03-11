/**
 * Unit tests for lib/storage.ts — file-based CRUD operations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

// Mock fs before importing storage
vi.mock("fs");

const mockFs = vi.mocked(fs);

// We need to reset modules between tests since storage has module-level state
beforeEach(() => {
  vi.resetAllMocks();
  // Default: existsSync returns false, readFileSync throws
  mockFs.existsSync.mockReturnValue(false);
  mockFs.readFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
  mockFs.writeFileSync.mockImplementation(() => {});
  mockFs.mkdirSync.mockImplementation(() => "" as any);
  mockFs.unlinkSync.mockImplementation(() => {});
  mockFs.readdirSync.mockReturnValue([]);
  mockFs.appendFileSync.mockImplementation(() => {});
});

// Import after mocking
import {
  BUILTIN_RULESETS,
  loadCustomMeta,
  saveCustomMeta,
  getAllRulesets,
  findRuleset,
  loadRuleset,
  saveRuleset,
  deleteRulesetFile,
  loadHistoryIndex,
  saveHistoryEntry,
  loadHistoryJob,
  loadAllPolicies,
  createPolicy,
  loadPolicy,
  updatePolicy,
  deletePolicy,
  loadMonitorIndex,
  createMonitor,
  loadMonitor,
  updateMonitor,
  deleteMonitor,
  saveMonitorRun,
  loadMonitorRuns,
  loadMonitorRun,
} from "@/lib/storage";

describe("storage", () => {
  describe("BUILTIN_RULESETS", () => {
    it("has 3 built-in rulesets", () => {
      expect(BUILTIN_RULESETS).toHaveLength(3);
      expect(BUILTIN_RULESETS.map(r => r.id)).toEqual(["singapore_mas", "hong_kong_sfc", "dubai_vara"]);
    });
  });

  describe("loadCustomMeta", () => {
    it("returns empty array when file not found", () => {
      expect(loadCustomMeta()).toEqual([]);
    });

    it("parses valid JSON", () => {
      const data = [{ id: "custom1", name: "Custom Ruleset" }];
      mockFs.readFileSync.mockReturnValue(JSON.stringify(data));
      expect(loadCustomMeta()).toEqual(data);
    });

    it("returns empty array on invalid JSON", () => {
      mockFs.readFileSync.mockReturnValue("not json");
      expect(loadCustomMeta()).toEqual([]);
    });
  });

  describe("saveCustomMeta", () => {
    it("writes JSON to file", () => {
      const meta = [{ id: "test" }];
      saveCustomMeta(meta);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const written = mockFs.writeFileSync.mock.calls[0][1] as string;
      expect(JSON.parse(written)).toEqual(meta);
    });
  });

  describe("getAllRulesets", () => {
    it("includes built-in rulesets with rules_count", () => {
      // Return rules for built-in files
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (String(filePath).includes("defaults")) return JSON.stringify([{}, {}, {}]);
        throw new Error("ENOENT");
      });
      const all = getAllRulesets();
      expect(all.length).toBeGreaterThanOrEqual(3);
      expect(all[0]).toHaveProperty("rules_count", 3);
      expect(all[0]).toHaveProperty("builtin", true);
    });
  });

  describe("findRuleset", () => {
    it("finds a built-in ruleset", () => {
      const result = findRuleset("singapore_mas");
      expect(result.meta).toBeTruthy();
      expect(result.isBuiltin).toBe(true);
      expect(result.filepath).toContain("singapore_mas.json");
    });

    it("returns null for nonexistent ruleset", () => {
      const result = findRuleset("nonexistent");
      expect(result.meta).toBeNull();
      expect(result.filepath).toBeNull();
    });
  });

  describe("loadRuleset / saveRuleset", () => {
    it("returns empty array if file missing", () => {
      expect(loadRuleset("/fake/path.json")).toEqual([]);
    });

    it("round-trips rules", () => {
      const rules = [{ rule_id: "r1" }, { rule_id: "r2" }];
      saveRuleset("/fake/path.json", rules);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("deleteRulesetFile", () => {
    it("calls unlinkSync when file exists", () => {
      mockFs.existsSync.mockReturnValue(true);
      deleteRulesetFile("/fake/path.json");
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe("History", () => {
    it("loadHistoryIndex returns empty array when no file", () => {
      expect(loadHistoryIndex()).toEqual([]);
    });

    it("saveHistoryEntry writes job file and updates index", () => {
      const jobData = {
        status: "completed",
        completed_at: "2025-01-01",
        request: { chain: "Ethereum", address: "0x123" },
        result: { summary: { highest_severity: "High" }, risk_entities: [{}] },
      };
      saveHistoryEntry("job_1", jobData);
      // Should write both the job file and the index
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it("loadHistoryJob returns null for missing job", () => {
      expect(loadHistoryJob("missing")).toBeNull();
    });
  });

  describe("Policies", () => {
    it("loadAllPolicies returns empty array when no index", () => {
      expect(loadAllPolicies()).toEqual([]);
    });

    it("createPolicy creates a new policy with generating status", () => {
      const policy = createPolicy({
        name: "Test Policy",
        jurisdiction: "Singapore",
        source_documents: ["doc1"],
      });
      expect(policy.name).toBe("Test Policy");
      expect(policy.status).toBe("generating");
      expect(policy.id).toMatch(/^policy_/);
      // Should write the .md file and the index
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it("loadPolicy returns null for nonexistent policy", () => {
      expect(loadPolicy("nonexistent")).toBeNull();
    });

    it("deletePolicy returns false for nonexistent policy", () => {
      expect(deletePolicy("nonexistent")).toBe(false);
    });
  });

  describe("Monitors", () => {
    it("loadMonitorIndex returns empty array when no file", () => {
      expect(loadMonitorIndex()).toEqual([]);
    });

    it("createMonitor writes task file and updates index", () => {
      const task = {
        id: "mon_1",
        name: "Test Monitor",
        addresses: [{ chain: "Ethereum", address: "0x123" }],
        scenario: "deposit",
        ruleset_id: "singapore_mas",
        inflow_hops: 3,
        outflow_hops: 3,
        max_nodes: 100,
        schedule: "0 */4 * * *",
        schedule_preset: "every_4h",
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        running: false,
      };
      createMonitor(task);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it("loadMonitor returns null for missing monitor", () => {
      expect(loadMonitor("missing")).toBeNull();
    });

    it("deleteMonitor returns false for nonexistent monitor", () => {
      expect(deleteMonitor("nonexistent")).toBe(false);
    });

    it("loadMonitorRuns returns empty array when dir missing", () => {
      expect(loadMonitorRuns("task1")).toEqual([]);
    });

    it("loadMonitorRun returns null for missing run", () => {
      expect(loadMonitorRun("task1", "run1")).toBeNull();
    });
  });
});
