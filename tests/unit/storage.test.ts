/**
 * Unit tests for lib/storage.ts — history + monitor CRUD (v3 shape)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";

// Mock fs before importing storage
vi.mock("fs");

const mockFs = vi.mocked(fs);

// In-memory file store backing the fs mock
let files: Record<string, string> = {};

beforeEach(() => {
  vi.resetAllMocks();
  files = {};
  mockFs.existsSync.mockImplementation((p) => String(p) in files);
  mockFs.readFileSync.mockImplementation(((p: unknown) => {
    const key = String(p);
    if (key in files) return files[key];
    throw new Error("ENOENT");
     
  }) as any);
  mockFs.writeFileSync.mockImplementation(((p: unknown, content: unknown) => {
    files[String(p)] = String(content);
     
  }) as any);
   
  mockFs.mkdirSync.mockImplementation((() => "") as any);
  mockFs.unlinkSync.mockImplementation(((p: unknown) => { delete files[String(p)]; }) as never);
   
  mockFs.readdirSync.mockImplementation((() => []) as any);
});

import {
  loadHistoryIndex,
  saveHistoryEntry,
  loadHistoryJob,
  historyByType,
  loadMonitorIndex,
  createMonitor,
  loadMonitor,
  updateMonitor,
  deleteMonitor,
} from "@/lib/storage";
import type { MonitorTask } from "@/lib/types";

function makeMonitor(overrides: Partial<MonitorTask> = {}): MonitorTask {
  return {
    id: "mon_test_1",
    type: "address",
    name: "Test monitor",
    chain: "Tron",
    address: "TTestAddress",
    tokens: ["USDT"],
    min_amount: 1,
    cursor: { lastTimestamp: 1000 },
    schedule: "0 */4 * * *",
    schedule_preset: "every_4h",
    enabled: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    running: false,
    ...overrides,
  };
}

describe("storage", () => {
  describe("history", () => {
    it("returns empty index when no file", () => {
      expect(loadHistoryIndex()).toEqual([]);
    });

    it("saves entry with typed index metadata", () => {
      saveHistoryEntry("job1", { status: "completed", result: {} }, {
        type: "kya",
        chain: "Tron",
        subject: "TAddr",
        scenario: "all",
        risk_level: "critical",
        hits_count: 3,
        completed_at: "2026-01-01T00:00:00Z",
        source: "manual",
      });
      const index = loadHistoryIndex();
      expect(index).toHaveLength(1);
      expect(index[0].job_id).toBe("job1");
      expect(index[0].type).toBe("kya");
      expect(index[0].risk_level).toBe("critical");
      expect(loadHistoryJob("job1")).toEqual({ status: "completed", result: {} });
    });

    it("filters pre-v3 entries lacking a type field", () => {
      // Simulate a legacy index file
      const legacyIndex = JSON.stringify([
        { job_id: "old1", chain: "Tron", address: "T1", risk_level: "Low" },
      ]);
      const indexPath = Object.keys(files).length ? Object.keys(files)[0] : null;
      void indexPath;
      // Write legacy content at the same path saveHistoryEntry would use
      saveHistoryEntry("new1", {}, {
        type: "kyt",
        chain: "Tron",
        subject: "0xtx",
        direction: "both",
        risk_level: "low",
        hits_count: 0,
        completed_at: "2026-01-01T00:00:00Z",
      });
      const key = Object.keys(files).find((k) => k.endsWith("index.json"))!;
      const merged = JSON.parse(files[key]);
      files[key] = JSON.stringify([...JSON.parse(legacyIndex), ...merged]);

      const index = loadHistoryIndex();
      expect(index).toHaveLength(1);
      expect(index[0].job_id).toBe("new1");
    });

    it("historyByType filters kya vs kyt", () => {
      saveHistoryEntry("a", {}, { type: "kya", chain: "Tron", subject: "T1", risk_level: "low", hits_count: 0, completed_at: "t" });
      saveHistoryEntry("b", {}, { type: "kyt", chain: "Tron", subject: "0x1", risk_level: "high", hits_count: 1, completed_at: "t" });
      expect(historyByType("kya").map((e) => e.job_id)).toEqual(["a"]);
      expect(historyByType("kyt").map((e) => e.job_id)).toEqual(["b"]);
    });
  });

  describe("monitors", () => {
    it("creates and loads a monitor", () => {
      createMonitor(makeMonitor());
      const loaded = loadMonitor("mon_test_1");
      expect(loaded?.type).toBe("address");
      expect(loaded?.address).toBe("TTestAddress");
      expect(loadMonitorIndex()).toHaveLength(1);
    });

    it("updates a monitor and syncs the index", () => {
      createMonitor(makeMonitor());
      const updated = updateMonitor("mon_test_1", { enabled: false, cursor: { lastTimestamp: 2000 } });
      expect(updated?.enabled).toBe(false);
      expect(updated?.cursor?.lastTimestamp).toBe(2000);
      expect(loadMonitorIndex()[0].enabled).toBe(false);
    });

    it("deletes a monitor", () => {
      createMonitor(makeMonitor());
      expect(deleteMonitor("mon_test_1")).toBe(true);
      expect(loadMonitor("mon_test_1")).toBeNull();
      expect(loadMonitorIndex()).toHaveLength(0);
    });

    it("filters pre-v3 monitors lacking a type field", () => {
      createMonitor(makeMonitor({ id: "mon_new", type: "kyt", origin_tx_id: "0xabc", watch_side: "from" }));
      const key = Object.keys(files).find((k) => k.endsWith("_index.json"))!;
      const current = JSON.parse(files[key]);
      files[key] = JSON.stringify([{ id: "mon_legacy", name: "old", addresses: [] }, ...current]);
      const index = loadMonitorIndex();
      expect(index).toHaveLength(1);
      expect(index[0].id).toBe("mon_new");
    });
  });
});
