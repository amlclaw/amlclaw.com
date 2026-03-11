/**
 * Simple API authentication for self-hosted deployments.
 * When an API token is configured in settings, all API routes require
 * Authorization: Bearer <token> header.
 * If no token is configured, all requests are allowed (backward compatible).
 */
import { NextResponse } from "next/server";
import { getSettings } from "./settings";

/**
 * Check if the request is authenticated.
 * Returns null if authenticated, or a 401 NextResponse if not.
 */
export function requireAuth(req: Request): NextResponse | null {
  const settings = getSettings();
  const apiToken = settings.security?.apiToken;

  // No token configured = open access (backward compatible)
  if (!apiToken) return null;

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json(
      { detail: "Authentication required. Set Authorization: Bearer <token> header." },
      { status: 401 }
    );
  }

  const [scheme, token] = authHeader.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || token !== apiToken) {
    return NextResponse.json(
      { detail: "Invalid authentication token." },
      { status: 401 }
    );
  }

  return null;
}

/**
 * Check if API auth is enabled (token configured).
 */
export function isAuthEnabled(): boolean {
  const settings = getSettings();
  return !!settings.security?.apiToken;
}
