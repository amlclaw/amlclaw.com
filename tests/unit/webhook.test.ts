/**
 * Unit tests for lib/webhook.ts — webhook sending (mock fetch)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
}));

import { sendWebhook, shouldAlert } from "@/lib/webhook";
import { getSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit-log";

const mockGetSettings = vi.mocked(getSettings);
const mockLogAudit = vi.mocked(logAudit);

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

      const result = await sendWebhook("screening.completed", { risk: "High" });
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://hook.example.com",
        expect.objectContaining({ method: "POST" })
      );
      // Check payload shape
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
      expect(body.event).toBe("screening.completed");
      expect(body.data.risk).toBe("High");
      expect(body.timestamp).toBeTruthy();
      expect(mockLogAudit).toHaveBeenCalledWith("webhook.sent", expect.any(Object));
    });

    it("returns false and logs failure on non-ok response", async () => {
      mockGetSettings.mockReturnValue({
        notifications: { webhookEnabled: true, webhookUrl: "https://hook.example.com" },
      } as any);
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

      const result = await sendWebhook("test", {});
      expect(result).toBe(false);
      expect(mockLogAudit).toHaveBeenCalledWith("webhook.failed", expect.any(Object));
    });

    it("returns false on fetch error", async () => {
      mockGetSettings.mockReturnValue({
        notifications: { webhookEnabled: true, webhookUrl: "https://hook.example.com" },
      } as any);
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      const result = await sendWebhook("test", {});
      expect(result).toBe(false);
      expect(mockLogAudit).toHaveBeenCalledWith("webhook.failed", expect.objectContaining({
        error: "Network error",
      }));
    });
  });

  describe("shouldAlert", () => {
    it("returns true for Severe", () => expect(shouldAlert("Severe")).toBe(true));
    it("returns true for High", () => expect(shouldAlert("High")).toBe(true));
    it("returns false for Medium", () => expect(shouldAlert("Medium")).toBe(false));
    it("returns false for Low", () => expect(shouldAlert("Low")).toBe(false));
  });
});
