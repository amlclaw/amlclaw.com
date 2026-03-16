import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit-log";

const ALLOWED_SECTIONS = new Set(["ai", "blockchain", "screening", "monitoring", "storage", "notifications", "security", "demo", "app", "sar"]);

function maskKey(k: string): string {
  return k ? `${"*".repeat(Math.max(0, k.length - 4))}${k.slice(-4)}` : "";
}

export async function GET() {
  const settings = getSettings();
  const masked = structuredClone(settings);
  // Mask OAuth token
  if (masked.ai.oauthToken) {
    masked.ai.oauthToken = maskKey(masked.ai.oauthToken);
  }
  if (masked.blockchain.trustinApiKey) {
    masked.blockchain.trustinApiKey = maskKey(masked.blockchain.trustinApiKey);
  }
  if (masked.security?.apiToken) {
    masked.security.apiToken = maskKey(masked.security.apiToken);
  }
  return NextResponse.json(masked);
}

export async function PUT(req: Request) {
  const body = await req.json();

  // Strip masked keys — don't overwrite real keys with mask strings
  if (typeof body.ai?.oauthToken === "string" && body.ai.oauthToken.startsWith("*")) {
    const current = getSettings();
    body.ai.oauthToken = current.ai.oauthToken;
  }
  if (typeof body.blockchain?.trustinApiKey === "string" && body.blockchain.trustinApiKey.startsWith("*")) {
    const current = getSettings();
    body.blockchain.trustinApiKey = current.blockchain.trustinApiKey;
  }
  if (typeof body.security?.apiToken === "string" && body.security.apiToken.startsWith("*")) {
    const current = getSettings();
    body.security.apiToken = current.security.apiToken;
  }

  // Validate only known sections
  for (const key of Object.keys(body)) {
    if (!ALLOWED_SECTIONS.has(key)) {
      return NextResponse.json({ detail: `Unknown settings section: ${key}` }, { status: 400 });
    }
  }

  // Validate numeric ranges
  if (body.screening) {
    const s = body.screening;
    if (s.defaultInflowHops !== undefined && (s.defaultInflowHops < 1 || s.defaultInflowHops > 5)) {
      return NextResponse.json({ detail: "Inflow hops must be 1-5" }, { status: 400 });
    }
    if (s.defaultOutflowHops !== undefined && (s.defaultOutflowHops < 1 || s.defaultOutflowHops > 5)) {
      return NextResponse.json({ detail: "Outflow hops must be 1-5" }, { status: 400 });
    }
    if (s.maxNodes !== undefined && (s.maxNodes < 10 || s.maxNodes > 1000)) {
      return NextResponse.json({ detail: "Max nodes must be 10-1000" }, { status: 400 });
    }
  }

  // Validate webhook URL format
  if (body.notifications?.webhookUrl) {
    try {
      new URL(body.notifications.webhookUrl);
    } catch {
      return NextResponse.json({ detail: "Invalid webhook URL" }, { status: 400 });
    }
  }

  const updated = updateSettings(body);
  logAudit("settings.updated", { sections: Object.keys(body) });
  return NextResponse.json({ ok: true, settings: updated });
}
