import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit-log";

const ALLOWED_SECTIONS = new Set(["ai", "blockchain", "screening", "monitoring", "storage", "notifications", "security", "demo", "app", "embedding"]);

export async function GET() {
  const settings = getSettings();
  // Mask API keys for display (return last 4 chars only)
  const masked = structuredClone(settings);
  for (const key of Object.keys(masked.ai.providers) as Array<keyof typeof masked.ai.providers>) {
    const k = masked.ai.providers[key].apiKey;
    masked.ai.providers[key].apiKey = k ? `${"*".repeat(Math.max(0, k.length - 4))}${k.slice(-4)}` : "";
  }
  if (masked.blockchain.trustinApiKey) {
    const k = masked.blockchain.trustinApiKey;
    masked.blockchain.trustinApiKey = `${"*".repeat(Math.max(0, k.length - 4))}${k.slice(-4)}`;
  }
  if (masked.security?.apiToken) {
    const k = masked.security.apiToken;
    masked.security.apiToken = `${"*".repeat(Math.max(0, k.length - 4))}${k.slice(-4)}`;
  }
  return NextResponse.json(masked);
}

export async function PUT(req: Request) {
  const body = await req.json();

  // Strip masked keys — don't overwrite real keys with mask strings
  if (body.ai?.providers) {
    const current = getSettings();
    for (const key of Object.keys(body.ai.providers)) {
      const val = body.ai.providers[key]?.apiKey;
      if (typeof val === "string" && val.startsWith("*")) {
        // Keep existing key
        body.ai.providers[key].apiKey = current.ai.providers[key as keyof typeof current.ai.providers]?.apiKey || "";
      }
    }
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
