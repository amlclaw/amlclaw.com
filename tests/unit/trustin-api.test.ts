/**
 * Unit tests for lib/trustin-api.ts — TrustIn KYA API (mock fetch)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/settings", () => ({
  getTrustInBaseUrl: vi.fn(() => "https://api.trustin.info/api/v2/investigate"),
  isDemoMode: vi.fn(() => false),
}));

import { kyaProDetect } from "@/lib/trustin-api";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

function mockFetchSequence(...responses: Array<{ code: number; data: unknown; msg?: string }>) {
  const fn = vi.mocked(fetch);
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(r),
    } as Response);
  }
}

describe("trustin-api", () => {
  describe("kyaProDetect", () => {
    it("throws for unsupported chain", async () => {
      await expect(kyaProDetect("Dogecoin", "addr", "key")).rejects.toThrow("Unsupported chain");
    });

    it("returns error result on API failure", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
      const result = await kyaProDetect("Ethereum", "0x123", "key");
      expect(result.error).toBeTruthy();
      expect(result.riskLevel).toBe("UNKNOWN");
      expect(result.riskScore).toBe(50);
    });

    it("submits task, polls status, and returns result", async () => {
      mockFetchSequence(
        // submit_task
        { code: 0, data: 12345 },
        // get_status
        { code: 0, data: "finished" },
        // get_result
        {
          code: 0,
          data: {
            graph: [
              {
                tags: [{ primary_category: "Exchange", priority: 3 }],
                path: [],
              },
            ],
          },
        },
      );

      const result = await kyaProDetect("Ethereum", "0x123", "apikey", {
        inflowHops: 2,
        outflowHops: 2,
      });

      expect(result.error).toBeNull();
      expect(result.riskScore).toBe(60); // priority 3 → score 60
      expect(result.riskLevel).toBe("MEDIUM");
      expect(result.rawResponse).toBeTruthy();
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("handles task timeout", async () => {
      vi.useFakeTimers();
      // submit ok
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ code: 0, data: 99 }),
      } as Response);
      // All status polls return "processing" (not "finished")
      for (let i = 0; i < 30; i++) {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ code: 0, data: "processing" }),
        } as Response);
      }

      const promise = kyaProDetect("Bitcoin", "1abc", "key");
      // Advance timers to exhaust all polling retries
      for (let i = 0; i < 30; i++) {
        await vi.advanceTimersByTimeAsync(2000);
      }
      const result = await promise;
      expect(result.error).toContain("timed out");
      vi.useRealTimers();
    });

    it("handles submit failure", async () => {
      mockFetchSequence({ code: 1, data: null, msg: "Bad request" });
      const result = await kyaProDetect("Ethereum", "0x123", "key");
      expect(result.error).toContain("Failed to submit");
    });

    it("handles 401 unauthorized", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false, status: 401, statusText: "Unauthorized",
      } as Response);
      const result = await kyaProDetect("Ethereum", "0x123", "badkey");
      expect(result.error).toContain("Invalid authorization");
    });
  });
});
