/**
 * Unit tests for lib/width-api.ts normalization helpers.
 */
import { describe, it, expect } from "vitest";
import { normalizeRisk, riskRank, normalizePathNode } from "@/lib/width-api";

describe("width-api", () => {
  describe("normalizeRisk", () => {
    it("passes through canonical levels", () => {
      for (const l of ["low", "medium", "high", "critical"]) {
        expect(normalizeRisk(l)).toBe(l);
      }
    });
    it("lowercases and defaults unknown to low", () => {
      expect(normalizeRisk("Critical")).toBe("critical");
      expect(normalizeRisk("Severe")).toBe("low");
      expect(normalizeRisk(undefined)).toBe("low");
    });
  });

  describe("riskRank", () => {
    it("orders low < medium < high < critical", () => {
      expect(riskRank("low")).toBeLessThan(riskRank("medium"));
      expect(riskRank("medium")).toBeLessThan(riskRank("high"));
      expect(riskRank("high")).toBeLessThan(riskRank("critical"));
    });
  });

  describe("normalizePathNode", () => {
    it("accepts the live-API object shape", () => {
      const node = normalizePathNode(
        { address: "TAddr", amount: 500, deep: 1, tags: [{ primary_category: "Sanctions" }] },
        0,
      );
      expect(node).toEqual({
        address: "TAddr",
        amount: 500,
        deep: 1,
        tags: [{ primary_category: "Sanctions" }],
      });
    });

    it("accepts the docs' string shape (address only)", () => {
      // Docs declare pathNodes: string[] — ordered opponent → target
      const node = normalizePathNode("TOpponentAddr", 2);
      expect(node).toEqual({ address: "TOpponentAddr", amount: 0, deep: 2, tags: [] });
    });

    it("tolerates null/malformed entries", () => {
      expect(normalizePathNode(null, 3)).toEqual({ address: "", amount: 0, deep: 3, tags: [] });
    });
  });
});
