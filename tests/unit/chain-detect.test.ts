/**
 * Unit tests for lib/chain-detect.ts — chain auto-detection from input format.
 */
import { describe, it, expect } from "vitest";
import { detectChainFromAddress, detectChainFromTxId } from "@/lib/chain-detect";

describe("chain-detect", () => {
  describe("detectChainFromAddress", () => {
    it("detects Ethereum addresses (0x + 40 hex)", () => {
      expect(detectChainFromAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7")).toBe("Ethereum");
    });

    it("detects Tron addresses (T + 33 base58)", () => {
      expect(detectChainFromAddress("TGE94jU39ithtHbrYAQJRTcvv785riPLdy")).toBe("Tron");
      expect(detectChainFromAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe("Tron");
    });

    it("trims surrounding whitespace", () => {
      expect(detectChainFromAddress("  TGE94jU39ithtHbrYAQJRTcvv785riPLdy  ")).toBe("Tron");
    });

    it("returns null for partial or invalid input", () => {
      expect(detectChainFromAddress("")).toBeNull();
      expect(detectChainFromAddress("0xdAC17F958")).toBeNull(); // too short
      expect(detectChainFromAddress("TGE94jU39")).toBeNull(); // too short
      expect(detectChainFromAddress("T0E94jU39ithtHbrYAQJRTcvv785riPLdy")).toBeNull(); // 0 not base58
      expect(detectChainFromAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBeNull(); // BTC
    });
  });

  describe("detectChainFromTxId", () => {
    it("detects Ethereum tx hashes (0x + 64 hex)", () => {
      expect(detectChainFromTxId("0x" + "ab12".repeat(16))).toBe("Ethereum");
    });

    it("detects Tron tx hashes (bare 64 hex)", () => {
      expect(detectChainFromTxId("398dd973fee3dc6f08e9066670a8a2f1178d6e1f789c2151e88ad35f4e291107")).toBe("Tron");
    });

    it("returns null for partial or invalid input", () => {
      expect(detectChainFromTxId("")).toBeNull();
      expect(detectChainFromTxId("398dd973fee3")).toBeNull(); // too short
      expect(detectChainFromTxId("0x1234")).toBeNull();
      expect(detectChainFromTxId("z".repeat(64))).toBeNull(); // not hex
    });
  });
});
