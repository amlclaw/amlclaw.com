import { NextResponse } from "next/server";
import { getTrustInBaseUrl, getTrustInToken } from "@/lib/settings";

/**
 * Test TrustIn Antares Compat API connectivity by running an abbreviated
 * submit → poll → get_opponents cycle with a known test address.
 *
 * No authentication required — the public compat endpoint has a global
 * rate limit but no per-user quota.
 */

const TEST_ADDRESS = "TGE94jU39ithtHbrYAQJRTcvv785riPLdy";
const TEST_CHAIN = "Tron";

async function callJson(
  endpoint: string,
  body: Record<string, unknown>,
  baseUrl: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "amlclaw-web/1.0.0",
      "x-shaula-token": "trustin-platform",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const baseUrl = (body.baseUrl as string) || getTrustInBaseUrl();
  const token = (body.token as string) || getTrustInToken();
  const statField = token.toUpperCase() === "USDC" ? "token_usdc_stat" : "token_usdt_stat";

  const steps: { step: string; status: string; detail?: string; duration_ms?: number }[] = [];

  try {
    // Step 1: submit
    const t1 = Date.now();
    const submitRes = await callJson("/investigatev2/submit_query_task_v2", {
      chain_name: TEST_CHAIN,
      token,
      address: TEST_ADDRESS,
      inflow_hops: 1,
      outflow_hops: 1,
      max_nodes_per_hop: 10,
    }, baseUrl);
    const submitMs = Date.now() - t1;

    if (submitRes.code !== 0 || typeof submitRes.data !== "number") {
      steps.push({ step: "submit_query_task_v2", status: "error", detail: `code=${submitRes.code}, msg=${submitRes.msg}`, duration_ms: submitMs });
      return NextResponse.json({ ok: false, steps, error: `submit failed: ${submitRes.msg || "unknown"}` });
    }
    const requestId = submitRes.data;
    steps.push({ step: "submit_query_task_v2", status: "ok", detail: `request_id=${requestId}`, duration_ms: submitMs });

    // Step 2: poll status
    const t2 = Date.now();
    let finished = false;
    for (let i = 0; i < 30; i++) {
      const statusRes = await callJson("/investigatev2/get_query_status", { request_id: requestId }, baseUrl);
      const stat = ((statusRes.data as Record<string, string>) || {})[statField] ?? "";
      if (stat === "finished") { finished = true; break; }
      if (stat === "failed") {
        steps.push({ step: "get_query_status", status: "error", detail: "task failed", duration_ms: Date.now() - t2 });
        return NextResponse.json({ ok: false, steps, error: "investigation task failed" });
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    const pollMs = Date.now() - t2;

    if (!finished) {
      steps.push({ step: "get_query_status", status: "timeout", detail: "Task did not finish within 60s", duration_ms: pollMs });
      return NextResponse.json({ ok: false, steps, error: "Task timed out waiting for completion" });
    }
    steps.push({ step: "get_query_status", status: "ok", detail: "finished", duration_ms: pollMs });

    // Step 3: list opponents
    const t3 = Date.now();
    const opponentsRes = await callJson("/investigatev2/get_opponents", {
      request_id: requestId,
      direction: 0,
      token,
      page: 1,
      page_size: 20,
    }, baseUrl);
    const opponentsMs = Date.now() - t3;

    if (opponentsRes.code !== 0) {
      steps.push({ step: "get_opponents", status: "error", detail: `code=${opponentsRes.code}, msg=${opponentsRes.msg}`, duration_ms: opponentsMs });
      return NextResponse.json({ ok: false, steps, error: `get_opponents failed: ${opponentsRes.msg || "unknown"}` });
    }

    const opponentsCount = Array.isArray(opponentsRes.data) ? opponentsRes.data.length : 0;
    const total = typeof opponentsRes.total === "number" ? opponentsRes.total : opponentsCount;
    steps.push({ step: "get_opponents", status: "ok", detail: `${opponentsCount}/${total} opponents`, duration_ms: opponentsMs });

    const totalMs = steps.reduce((s, st) => s + (st.duration_ms || 0), 0);
    return NextResponse.json({
      ok: true,
      mode: "compat",
      steps,
      total_ms: totalMs,
      message: `Connected successfully — Antares Compat API, ${total} opponents in ${(totalMs / 1000).toFixed(1)}s`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, steps, error: msg });
  }
}
