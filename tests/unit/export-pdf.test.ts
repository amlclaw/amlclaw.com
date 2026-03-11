/**
 * Unit tests for lib/export-pdf.ts — PDF report export
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(() => ({
    app: { name: "AMLClaw", reportHeader: "", themeDefault: "dark" },
  })),
}));

import { generateExportPdf } from "@/lib/export-pdf";
import { getSettings } from "@/lib/settings";

const mockGetSettings = vi.mocked(getSettings);

beforeEach(() => {
  vi.resetAllMocks();
  mockGetSettings.mockReturnValue({
    app: { name: "AMLClaw", reportHeader: "", themeDefault: "dark" },
  } as any);
});

describe("export-pdf", () => {
  const baseJob = {
    completed_at: "2025-01-01T00:00:00Z",
    request: { chain: "Ethereum", address: "0xabc", scenario: "deposit", ruleset: "singapore_mas" },
    result: {
      target: { chain: "Ethereum", address: "0xabc", tags: [], self_matched_rules: [] },
      scenario: "deposit",
      summary: { highest_severity: "Low", rules_triggered: [], total_rules: 10 },
      risk_entities: [],
    },
  };

  it("generates a valid PDF buffer", () => {
    const buf = generateExportPdf(baseJob);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
    // Check PDF header
    const header = buf.toString("latin1", 0, 8);
    expect(header).toContain("%PDF-1.4");
  });

  it("ends with %%EOF", () => {
    const buf = generateExportPdf(baseJob);
    const tail = buf.toString("latin1", buf.length - 10);
    expect(tail).toContain("%%EOF");
  });

  it("handles job with risk entities", () => {
    const job = {
      ...baseJob,
      result: {
        ...baseJob.result,
        summary: { highest_severity: "Severe", rules_triggered: ["R1"], total_rules: 5 },
        risk_entities: [
          {
            address: "0xbad",
            tag: { primary_category: "Darknet", risk_level: "Severe" },
            min_deep: 1,
            matched_rules: ["R1"],
            evidence_paths: [{ deep: 1, flow: "0xabc -> 0xbad" }],
          },
        ],
      },
    };
    const buf = generateExportPdf(job);
    expect(buf).toBeInstanceOf(Buffer);
    const text = buf.toString("latin1");
    expect(text).toContain("0xbad");
  });

  it("handles empty job gracefully", () => {
    const buf = generateExportPdf({});
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.toString("latin1")).toContain("%PDF-1.4");
  });

  it("includes report header when configured", () => {
    mockGetSettings.mockReturnValue({
      app: { name: "Corp", reportHeader: "PRIVATE", themeDefault: "dark" },
    } as any);
    const buf = generateExportPdf(baseJob);
    const text = buf.toString("latin1");
    expect(text).toContain("PRIVATE");
  });
});
