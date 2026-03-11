/**
 * Unit tests for lib/auth.ts — Bearer token authentication
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock settings module
vi.mock("@/lib/settings", () => ({
  getSettings: vi.fn(),
}));

import { requireAuth, isAuthEnabled } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

const mockGetSettings = vi.mocked(getSettings);

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/test", {
    headers: new Headers(headers),
  });
}

describe("auth", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("requireAuth", () => {
    it("returns null (allows) when no token configured", () => {
      mockGetSettings.mockReturnValue({ security: { apiToken: "" } } as any);
      const result = requireAuth(makeRequest());
      expect(result).toBeNull();
    });

    it("returns 401 when token configured but no auth header", () => {
      mockGetSettings.mockReturnValue({ security: { apiToken: "secret123" } } as any);
      const result = requireAuth(makeRequest());
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    it("returns 401 for invalid token", () => {
      mockGetSettings.mockReturnValue({ security: { apiToken: "secret123" } } as any);
      const result = requireAuth(makeRequest({ authorization: "Bearer wrong" }));
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    it("returns 401 for non-Bearer scheme", () => {
      mockGetSettings.mockReturnValue({ security: { apiToken: "secret123" } } as any);
      const result = requireAuth(makeRequest({ authorization: "Basic secret123" }));
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    it("returns null for valid Bearer token", () => {
      mockGetSettings.mockReturnValue({ security: { apiToken: "secret123" } } as any);
      const result = requireAuth(makeRequest({ authorization: "Bearer secret123" }));
      expect(result).toBeNull();
    });
  });

  describe("isAuthEnabled", () => {
    it("returns false when no token", () => {
      mockGetSettings.mockReturnValue({ security: { apiToken: "" } } as any);
      expect(isAuthEnabled()).toBe(false);
    });

    it("returns true when token configured", () => {
      mockGetSettings.mockReturnValue({ security: { apiToken: "tok" } } as any);
      expect(isAuthEnabled()).toBe(true);
    });
  });
});
