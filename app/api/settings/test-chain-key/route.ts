import { NextResponse } from "next/server";
import { getEtherscanApiKey, getTrongridApiKey } from "@/lib/settings";

/**
 * Test an Etherscan / TronGrid API key with a cheap real request.
 *
 * Body: { provider: "etherscan" | "trongrid", apiKey?: string }
 * If apiKey is empty or a masked value ("*…"), the stored key is used.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const provider = body.provider;
  let apiKey: string = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey || apiKey.startsWith("*")) {
    apiKey = provider === "etherscan" ? getEtherscanApiKey() : getTrongridApiKey();
  }

  if (provider === "etherscan") {
    if (!apiKey) {
      return NextResponse.json({ ok: false, detail: "No Etherscan API key configured" });
    }
    try {
      const url =
        `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_blockNumber` +
        `&apikey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      const json = (await res.json()) as { result?: string; message?: string };
      const block = typeof json.result === "string" && json.result.startsWith("0x")
        ? parseInt(json.result, 16)
        : 0;
      if (block > 0) {
        return NextResponse.json({ ok: true, detail: `OK — current block ${block}` });
      }
      return NextResponse.json({
        ok: false,
        detail: `Etherscan rejected the key: ${json.message ?? json.result ?? "unknown error"}`,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  if (provider === "trongrid") {
    if (!apiKey) {
      return NextResponse.json({ ok: false, detail: "No TronGrid API key configured" });
    }
    try {
      const res = await fetch("https://api.trongrid.io/wallet/getnowblock", {
        headers: { "TRON-PRO-API-KEY": apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401 || res.status === 403) {
        const err = (await res.json().catch(() => ({}))) as { message?: string; Error?: string };
        return NextResponse.json({
          ok: false,
          detail: `TronGrid rejected the key: ${err.message ?? err.Error ?? `HTTP ${res.status}`}`,
        });
      }
      const json = (await res.json()) as { block_header?: { raw_data?: { number?: number } } };
      const height = json.block_header?.raw_data?.number ?? 0;
      if (height > 0) {
        return NextResponse.json({ ok: true, detail: `OK — current block ${height}` });
      }
      return NextResponse.json({ ok: false, detail: "Unexpected TronGrid response" });
    } catch (e) {
      return NextResponse.json({ ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ detail: "provider must be 'etherscan' or 'trongrid'" }, { status: 400 });
}
