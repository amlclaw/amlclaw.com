import { NextResponse } from "next/server";
import { getTrustInBaseUrl } from "@/lib/settings";

/**
 * Test TrustIn API connectivity by running a full submit → poll → get_result cycle
 * with a known test address.
 */

const TEST_PAYLOAD = {
  chain_name: "Tron",
  address: "TGE94jU39ithtHbrYAQJRTcvv785riPLdy",
  inflow_hops: 5,
  outflow_hops: 5,
  max_nodes_per_hop: 100,
  min_timestamp: 1706140800000,
  max_timestamp: 1772035199999,
};

async function callTrustIn(
  endpoint: string,
  data: Record<string, unknown>,
  baseUrl: string,
  apiKey: string
): Promise<Record<string, unknown>> {
  const url = apiKey
    ? `${baseUrl}/${endpoint}?apikey=${apiKey}`
    : `${baseUrl}/${endpoint}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain", "User-Agent": "amlclaw-web/1.0.0" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid API key (401 Unauthorized)");
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const apiKey = (body.apiKey as string) || "";
  const baseUrl = (body.baseUrl as string) || getTrustInBaseUrl();

  const steps: { step: string; status: string; detail?: string; duration_ms?: number }[] = [];

  try {
    // Step 1: submit_task
    const t1 = Date.now();
    const submitRes = await callTrustIn("submit_task", TEST_PAYLOAD, baseUrl, apiKey);
    const submitMs = Date.now() - t1;

    if (submitRes.code !== 0 || !submitRes.data) {
      steps.push({ step: "submit_task", status: "error", detail: `code=${submitRes.code}, msg=${submitRes.msg}`, duration_ms: submitMs });
      return NextResponse.json({ ok: false, steps, error: `submit_task failed: ${submitRes.msg || "unknown"}` });
    }

    const taskId = submitRes.data as number;
    steps.push({ step: "submit_task", status: "ok", detail: `task_id=${taskId}`, duration_ms: submitMs });

    // Step 2: get_status (poll until finished, max 60s)
    const t2 = Date.now();
    let finished = false;
    for (let i = 0; i < 30; i++) {
      const statusRes = await callTrustIn("get_status", { task_id: taskId }, baseUrl, apiKey);
      if (statusRes.code === 0 && statusRes.data === "finished") {
        finished = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    const pollMs = Date.now() - t2;

    if (!finished) {
      steps.push({ step: "get_status", status: "timeout", detail: "Task did not finish within 60s", duration_ms: pollMs });
      return NextResponse.json({ ok: false, steps, error: "Task timed out waiting for completion" });
    }
    steps.push({ step: "get_status", status: "ok", detail: "finished", duration_ms: pollMs });

    // Step 3: get_result
    const t3 = Date.now();
    const resultRes = await callTrustIn("get_result", { task_id: taskId, token: "usdt" }, baseUrl, apiKey);
    const resultMs = Date.now() - t3;

    if (resultRes.code !== 0) {
      steps.push({ step: "get_result", status: "error", detail: `code=${resultRes.code}, msg=${resultRes.msg}`, duration_ms: resultMs });
      return NextResponse.json({ ok: false, steps, error: `get_result failed: ${resultRes.msg || "unknown"}` });
    }

    // Check if data is desensitized (no API key) or full
    const mode = apiKey ? "full" : "desensitized";
    steps.push({ step: "get_result", status: "ok", detail: `mode=${mode}`, duration_ms: resultMs });

    const totalMs = steps.reduce((s, st) => s + (st.duration_ms || 0), 0);
    return NextResponse.json({
      ok: true,
      mode,
      steps,
      total_ms: totalMs,
      message: apiKey
        ? `Connected successfully — full data mode (${(totalMs / 1000).toFixed(1)}s)`
        : `Connected successfully — desensitized mode, add API key for full data (${(totalMs / 1000).toFixed(1)}s)`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, steps, error: msg });
  }
}
