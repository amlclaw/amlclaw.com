import { NextResponse } from "next/server";
import { getEtherscanApiKey, getTrongridApiKey, getWidthApiKey, getWidthBaseUrl } from "@/lib/settings";

/**
 * Test a Width.info / Etherscan / TronGrid API key with a cheap real request.
 *
 * Body: { provider: "width" | "etherscan" | "trongrid", apiKey?: string, baseUrl?: string }
 * If apiKey is empty or a masked value ("*…"), the stored key is used.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const provider = body.provider;
  let apiKey: string = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey || apiKey.startsWith("*")) {
    apiKey =
      provider === "etherscan" ? getEtherscanApiKey()
      : provider === "trongrid" ? getTrongridApiKey()
      : getWidthApiKey();
  }

  if (provider === "width") {
    if (!apiKey) {
      return NextResponse.json({ ok: false, detail: "No Width.info API key configured" });
    }
    // Security: always use the STORED base URL for the probe. Accepting a
    // caller-supplied baseUrl would let an attacker point the server's fetch
    // (with the real apikey in the query string) at an arbitrary internal URL.
    const baseUrl = getWidthBaseUrl();
    try {
      // Cheap probe: v3 async submit returns a job_id immediately (no waiting
      // for the screen); an invalid key fails fast with 401 "Invalid API key".
      const res = await fetch(
        `${baseUrl}/api/v3/screen/kya?apikey=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain_name: "Tron",
            address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // USDT contract
            inflow_hops: 0,
            outflow_hops: 0,
            max_nodes_per_hop: 10,
            max_opponent_paths: 1,
            mode: "async",
          }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      const json = (await res.json().catch(() => null)) as
        | { code?: number; msg?: string; data?: { job_id?: number } }
        | null;
      if (res.status === 401 || res.status === 403 || json?.code === -1) {
        return NextResponse.json({
          ok: false,
          detail: `Width API rejected the key: ${json?.msg ?? `HTTP ${res.status}`}`,
        });
      }
      if (res.ok && json?.code === 0 && json.data?.job_id) {
        return NextResponse.json({ ok: true, detail: "OK — Width API key valid" });
      }
      return NextResponse.json({
        ok: false,
        detail: `Width API error: ${json?.msg ?? `HTTP ${res.status}`}`,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
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

  return NextResponse.json({ detail: "provider must be 'width', 'etherscan' or 'trongrid'" }, { status: 400 });
}
