import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";

const ALLOWED_SECTIONS = new Set(["api", "screening", "monitoring", "scoring", "notifications"]);

const SECRET_FIELDS: [section: string, field: string][] = [
  ["api", "widthApiKey"],
  ["api", "etherscanApiKey"],
  ["api", "trongridApiKey"],
];

function maskKey(k: string): string {
  return k ? `${"*".repeat(Math.max(0, k.length - 4))}${k.slice(-4)}` : "";
}

/** Deep-copy settings with secret fields masked — used by BOTH GET and PUT
 *  responses (returning raw keys from PUT would leak them to the client). */
function maskedSettings(settings: unknown): Record<string, Record<string, unknown>> {
  const masked = structuredClone(settings) as Record<string, Record<string, unknown>>;
  for (const [section, field] of SECRET_FIELDS) {
    const value = masked[section]?.[field];
    if (typeof value === "string" && value) {
      masked[section][field] = maskKey(value);
    }
  }
  return masked;
}

export async function GET() {
  return NextResponse.json(maskedSettings(getSettings()));
}

export async function PUT(req: Request) {
  const body = await req.json();

  // Strip masked keys — don't overwrite real keys with mask strings
  const current = getSettings() as unknown as Record<string, Record<string, unknown>>;
  for (const [section, field] of SECRET_FIELDS) {
    const incoming = body[section]?.[field];
    if (typeof incoming === "string" && incoming.startsWith("*")) {
      body[section][field] = current[section]?.[field] ?? "";
    }
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
    if (s.defaultInflowHops !== undefined && (s.defaultInflowHops < 0 || s.defaultInflowHops > 5)) {
      return NextResponse.json({ detail: "Inflow hops must be 0-5" }, { status: 400 });
    }
    if (s.defaultOutflowHops !== undefined && (s.defaultOutflowHops < 0 || s.defaultOutflowHops > 5)) {
      return NextResponse.json({ detail: "Outflow hops must be 0-5" }, { status: 400 });
    }
    if (s.maxNodesPerHop !== undefined && (s.maxNodesPerHop < 10 || s.maxNodesPerHop > 1000)) {
      return NextResponse.json({ detail: "Max nodes per hop must be 10-1000" }, { status: 400 });
    }
    if (s.maxOpponentPaths !== undefined && (s.maxOpponentPaths < 1 || s.maxOpponentPaths > 200)) {
      return NextResponse.json({ detail: "Max opponent paths must be 1-200" }, { status: 400 });
    }
  }
  if (body.monitoring) {
    const m = body.monitoring;
    if (m.maxTxPerRun !== undefined && (m.maxTxPerRun < 1 || m.maxTxPerRun > 100)) {
      return NextResponse.json({ detail: "Max txs per run must be 1-100" }, { status: 400 });
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
  return NextResponse.json({ ok: true, settings: maskedSettings(updated) });
}
