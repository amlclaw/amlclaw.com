/**
 * Unit tests for lib/audit-log.ts — append-only event log
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";

vi.mock("fs");
const mockFs = vi.mocked(fs);

beforeEach(() => {
  vi.resetAllMocks();
  mockFs.existsSync.mockReturnValue(true);
  mockFs.mkdirSync.mockImplementation(() => "" as any);
  mockFs.appendFileSync.mockImplementation(() => {});
  mockFs.readFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
  mockFs.writeFileSync.mockImplementation(() => {});
});

import { logAudit, loadAuditLog } from "@/lib/audit-log";

describe("audit-log", () => {
  describe("logAudit", () => {
    it("appends event to log file", () => {
      const event = logAudit("screening.started", { address: "0x123" });
      expect(event.id).toMatch(/^evt_/);
      expect(event.action).toBe("screening.started");
      expect(event.details.address).toBe("0x123");
      expect(event.timestamp).toBeTruthy();
      expect(mockFs.appendFileSync).toHaveBeenCalledTimes(1);
      const written = mockFs.appendFileSync.mock.calls[0][1] as string;
      expect(written).toContain("screening.started");
      expect(written.endsWith("\n")).toBe(true);
    });

    it("handles write failures silently", () => {
      mockFs.appendFileSync.mockImplementation(() => { throw new Error("disk full"); });
      const event = logAudit("settings.updated", {});
      // Should not throw, still returns event
      expect(event.action).toBe("settings.updated");
    });
  });

  describe("loadAuditLog", () => {
    it("returns empty when no file", () => {
      const result = loadAuditLog();
      expect(result.events).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("reads and parses JSONL, returns newest-first", () => {
      const line1 = JSON.stringify({ id: "evt_1", timestamp: "2025-01-01", action: "screening.started", details: {} });
      const line2 = JSON.stringify({ id: "evt_2", timestamp: "2025-01-02", action: "screening.completed", details: {} });
      mockFs.readFileSync.mockReturnValue(`${line1}\n${line2}`);

      const result = loadAuditLog();
      expect(result.total).toBe(2);
      expect(result.events[0].id).toBe("evt_2"); // newest first (reversed)
    });

    it("supports limit and offset", () => {
      const lines = Array.from({ length: 5 }, (_, i) =>
        JSON.stringify({ id: `evt_${i}`, timestamp: `2025-01-0${i+1}`, action: "screening.started", details: {} })
      ).join("\n");
      mockFs.readFileSync.mockReturnValue(lines);

      const result = loadAuditLog({ limit: 2, offset: 1 });
      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it("filters by action prefix", () => {
      const lines = [
        JSON.stringify({ id: "evt_1", timestamp: "t1", action: "screening.started", details: {} }),
        JSON.stringify({ id: "evt_2", timestamp: "t2", action: "policy.created", details: {} }),
      ].join("\n");
      mockFs.readFileSync.mockReturnValue(lines);

      const result = loadAuditLog({ action: "screening" });
      expect(result.total).toBe(1);
      expect(result.events[0].action).toBe("screening.started");
    });

    it("skips corrupt lines", () => {
      mockFs.readFileSync.mockReturnValue(`{"id":"evt_1","timestamp":"t","action":"screening.started","details":{}}\nnot json\n`);
      const result = loadAuditLog();
      expect(result.total).toBe(1);
    });
  });
});
