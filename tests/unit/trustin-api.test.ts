/**
 * Unit tests for lib/trustin-api.ts — Antares Compat API (mock fetch)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/settings", () => ({
  getTrustInBaseUrl: vi.fn(() => "https://platform.trustin.bond/api"),
  getTrustInToken: vi.fn(() => "USDT"),
  isDemoMode: vi.fn(() => false),
}));

import { kyaProDetect } from "@/lib/trustin-api";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

type StubResponse = {
  code?: number;
  msg?: string;
  data?: unknown;
  total?: number;
  is_exist?: boolean;
};

function mockFetchSequence(...responses: StubResponse[]) {
  const fn = vi.mocked(fetch);
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(r),
    } as Response);
  }
}

function happyPathSequence(): StubResponse[] {
  return [
    // 1. submit_query_task_v2
    { code: 0, data: 42 },
    // 2. get_query_status (finished on first poll)
    { code: 0, data: { token_usdt_stat: "finished", token_usdc_stat: "finished" } },
    // 3. get_opponents — single page with 2 opponents
    {
      code: 0,
      data: [
        { seq: 1001, direction: 1, opponent_address: "OUT1", tags: [{ primary_category: "Exchange", priority: 3 }] },
        { seq: 1002, direction: -1, opponent_address: "IN1", tags: [{ primary_category: "Sanctioned Entity", priority: 1 }] },
      ],
      total: 2,
    },
    // 4. get_opponent_paths_with_amount_and_timestamp_range
    {
      code: 0,
      data: {
        "1001": {
          direction: 1,
          query_address: "QUERY",
          opponent_address: "OUT1",
          path: [
            { address: "QUERY", deep: 0, amount: 0, tags: [] },
            { address: "MID1", deep: 1, amount: 100, tags: [] },
            { address: "OUT1", deep: 2, amount: 95, tags: [{ primary_category: "Exchange", priority: 3 }] },
          ],
        },
        "1002": {
          direction: -1,
          query_address: "QUERY",
          opponent_address: "IN1",
          path: [
            // New API ordering: query at deep=0, opponent at deep=N regardless of direction
            { address: "QUERY", deep: 0, amount: 0, tags: [] },
            { address: "MID2", deep: 1, amount: 50, tags: [] },
            { address: "IN1", deep: 2, amount: 50, tags: [{ primary_category: "Sanctioned Entity", priority: 1 }] },
          ],
        },
      },
    },
    // 5. /query/get_tag_items_v2 — target self-tags
    { code: 0, data: [{ primary_category: "Personal Wallet", priority: 4 }] },
  ];
}

describe("trustin-api", () => {
  describe("kyaProDetect (Antares Compat)", () => {
    it("throws for unsupported chain", async () => {
      await expect(kyaProDetect("Dogecoin", "addr", "")).rejects.toThrow("Unsupported chain");
    });

    it("returns error result on network failure", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
      const result = await kyaProDetect("Ethereum", "0x123", "");
      expect(result.error).toBeTruthy();
      expect(result.riskLevel).toBe("UNKNOWN");
      expect(result.riskScore).toBe(50);
    });

    it("runs the 4-step compat flow + target self-tag fetch", async () => {
      mockFetchSequence(...happyPathSequence());

      const result = await kyaProDetect("Tron", "QUERY", "", {
        inflowHops: 3,
        outflowHops: 3,
      });

      expect(result.error).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(5);

      // Verify each endpoint was hit in the right order with the right URL
      const calls = vi.mocked(fetch).mock.calls;
      expect((calls[0][0] as string)).toContain("/investigatev2/submit_query_task_v2");
      expect((calls[1][0] as string)).toContain("/investigatev2/get_query_status");
      expect((calls[2][0] as string)).toContain("/investigatev2/get_opponents");
      expect((calls[3][0] as string)).toContain("/investigatev2/get_opponent_paths_with_amount_and_timestamp_range");
      expect((calls[4][0] as string)).toContain("/query/get_tag_items_v2");

      // Submit payload shape
      const submitBody = JSON.parse((calls[0][1] as RequestInit).body as string);
      expect(submitBody.chain_name).toBe("tron");
      expect(submitBody.token).toBe("USDT");
      expect(submitBody.address).toBe("QUERY");
      expect(submitBody.inflow_hops).toBe(3);
      expect(submitBody.outflow_hops).toBe(3);

      // Opponents request uses direction:0 (both)
      const opponentsBody = JSON.parse((calls[2][1] as RequestInit).body as string);
      expect(opponentsBody.direction).toBe(0);
      expect(opponentsBody.token).toBe("USDT");

      // Paths request uses the antares-safe min_amount
      const pathsBody = JSON.parse((calls[3][1] as RequestInit).body as string);
      expect(pathsBody.min_amount).toBeLessThan(1);
      expect(pathsBody.seqs).toEqual([1001, 1002]);
    });

    it("repackages outflow path with target at index 0 (no reversal)", async () => {
      mockFetchSequence(...happyPathSequence());
      const result = await kyaProDetect("Tron", "QUERY", "");
      const details = result.details as Record<string, unknown>;
      const data = details.data as Record<string, unknown>;
      const paths = data.paths as Array<{ direction: number; path: Array<{ address: string }> }>;
      const outflow = paths.find((p) => p.direction === 1)!;
      expect(outflow.path.map((n) => n.address)).toEqual(["QUERY", "MID1", "OUT1"]);
    });

    it("reverses inflow path so target lands at the end", async () => {
      mockFetchSequence(...happyPathSequence());
      const result = await kyaProDetect("Tron", "QUERY", "");
      const details = result.details as Record<string, unknown>;
      const data = details.data as Record<string, unknown>;
      const paths = data.paths as Array<{ direction: number; path: Array<{ address: string }> }>;
      const inflow = paths.find((p) => p.direction === -1)!;
      expect(inflow.path.map((n) => n.address)).toEqual(["IN1", "MID2", "QUERY"]);
    });

    it("places target self-tags on the legacy `data.tags` field", async () => {
      mockFetchSequence(...happyPathSequence());
      const result = await kyaProDetect("Tron", "QUERY", "");
      const details = result.details as Record<string, unknown>;
      const data = details.data as Record<string, unknown>;
      expect(data.tags).toEqual([{ primary_category: "Personal Wallet", priority: 4 }]);
    });

    it("returns error when request_id not found (empty status fields)", async () => {
      mockFetchSequence(
        { code: 0, data: 42 },
        { code: 0, data: { token_usdt_stat: "", token_usdc_stat: "" } },
      );
      const result = await kyaProDetect("Ethereum", "0x123", "");
      expect(result.error).toContain("not found");
    });

    it("returns error when investigation fails", async () => {
      mockFetchSequence(
        { code: 0, data: 42 },
        { code: 0, data: { token_usdt_stat: "failed", token_usdc_stat: "failed" } },
      );
      const result = await kyaProDetect("Ethereum", "0x123", "");
      expect(result.error).toContain("failed");
    });

    it("handles polling timeout", async () => {
      vi.useFakeTimers();
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ code: 0, data: 99 }),
      } as Response);
      // 30 status polls all returning "running"
      for (let i = 0; i < 30; i++) {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ code: 0, data: { token_usdt_stat: "running", token_usdc_stat: "running" } }),
        } as Response);
      }

      const promise = kyaProDetect("Bitcoin", "1abc", "");
      for (let i = 0; i < 30; i++) {
        await vi.advanceTimersByTimeAsync(2000);
      }
      const result = await promise;
      expect(result.error).toContain("timed out");
      vi.useRealTimers();
    });

    it("propagates submit business errors", async () => {
      mockFetchSequence({ code: -1, data: null, msg: "bad address" });
      const result = await kyaProDetect("Ethereum", "0x123", "");
      expect(result.error).toContain("Failed to submit");
    });

    it("returns an empty paths array when there are no opponents", async () => {
      mockFetchSequence(
        { code: 0, data: 42 },
        { code: 0, data: { token_usdt_stat: "finished", token_usdc_stat: "finished" } },
        { code: 0, data: [], total: 0 },
        // step 4 skipped — no seqs to fetch
        // step 5 still runs for target self-tags
        { code: 0, data: [] },
      );
      const result = await kyaProDetect("Tron", "CLEAN_ADDR", "");
      expect(result.error).toBeNull();
      const details = result.details as Record<string, unknown>;
      const data = details.data as Record<string, unknown>;
      expect(data.paths).toEqual([]);
      expect(data.tags).toEqual([]);
    });
  });
});
