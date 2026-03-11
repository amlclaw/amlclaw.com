import { NextResponse } from "next/server";
import { testConnection } from "@/lib/ai";
import { getSettings, type AIProvider } from "@/lib/settings";

export async function POST(req: Request) {
  const body = await req.json();
  const { provider, apiKey, model, baseUrl } = body as {
    provider: AIProvider;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };

  if (!provider) {
    return NextResponse.json({ ok: false, error: "provider is required" }, { status: 400 });
  }

  // Use provided key or fall back to saved settings
  const settings = getSettings();
  const savedConfig = settings.ai.providers[provider];
  const config = {
    apiKey: apiKey || savedConfig?.apiKey || "",
    model: model || savedConfig?.model || "",
    baseUrl: baseUrl || savedConfig?.baseUrl || "",
  };

  if (!config.apiKey) {
    return NextResponse.json({ ok: false, error: "No API key provided" }, { status: 400 });
  }

  const result = await testConnection(provider, config);
  return NextResponse.json(result);
}
