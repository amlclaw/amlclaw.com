/**
 * Unit tests for lib/webhook.ts — webhook sending (mock fetch)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(),
}));

import { sendWebhook, shouldAlert } from "@/lib/webhook";
import { getSettings } from "@/lib/settings";

const mockGetSettings = vi.mocked(getSettings);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

describe("webhook", () => {
  describe("sendWebhook", () => {
    it("returns false when webhook disabled", async () => {
      mockGetSettings.mockReturnValue({
        notifications: { webhookEnabled: false, webhookUrl: "" },
         
      } as any);
      const result = await sendWebhook("test.event", { foo: "bar" });
      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("returns false when no webhook URL", async () => {
      mockGetSettings.mockReturnValue({
        notifications: { webhookEnabled: true, webhookUrl: "" },
         
      } as any);
      const result = await sendWebhook("test.event", {});
      expect(result).toBe(false);
    });

    it("sends POST to webhook URL and returns true on success", async () => {
      mockGetSettings.mockReturnValue({
        notifications: { webhookEnabled: true, webhookUrl: "https://hook.example.com" },
         
      } as any);
      vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

      const result = await sendWebhook("screening.high_risk", { risk: "critical" });
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://hook.example.com",
        expect.objectContaining({ method: "POST" })
      );
      // Check payload shape
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.event).toBe("screening.high_risk");
      expect(body.data.risk).toBe("critical");
      expect(body.timestamp).toBeTruthy();
    });

    it("returns false on non-ok response", async () => {
      mockGetSettings.mockReturnValue({
        notifications: { webhookEnabled: true, webhookUrl: "https://hook.example.com" },
         
      } as any);
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

      const result = await sendWebhook("test", {});
      expect(result).toBe(false);
    });

    it("returns false on fetch error", async () => {
      mockGetSettings.mockReturnValue({
        notifications: { webhookEnabled: true, webhookUrl: "https://hook.example.com" },
         
      } as any);
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      const result = await sendWebhook("test", {});
      expect(result).toBe(false);
    });
  });

  describe("shouldAlert (v3 vocabulary)", () => {
    it("returns true for critical", () => expect(shouldAlert("critical")).toBe(true));
    it("returns true for high", () => expect(shouldAlert("high")).toBe(true));
    it("is case-insensitive", () => expect(shouldAlert("Critical")).toBe(true));
    it("returns false for medium", () => expect(shouldAlert("medium")).toBe(false));
    it("returns false for low", () => expect(shouldAlert("low")).toBe(false));
  });
});
