import { NextResponse } from "next/server";
import { saveHistoryEntry } from "@/lib/storage";
import { kytScreen, type KytScreenResult, type KytDirection } from "@/lib/width-api";
import { getSettings } from "@/lib/settings";
import { sendWebhook, shouldAlert } from "@/lib/webhook";
import crypto from "crypto";

// In-memory job storage
const kytJobs: Record<string, Record<string, unknown>> = {};

export { kytJobs };

const DIRECTIONS: KytDirection[] = ["in", "out", "both"];

export async function POST(req: Request) {
  const settings = getSettings();
  const body = await req.json();
  const chain = body.chain || "Tron";
  const txId = (body.tx_id || "").trim();
  const direction: KytDirection = DIRECTIONS.includes(body.direction) ? body.direction : "both";
  const inRulesetId = parseInt(String(body.in_ruleset_id ?? settings.screening.defaultKytInRulesetId)) || 0;
  const outRulesetId = parseInt(String(body.out_ruleset_id ?? settings.screening.defaultKytOutRulesetId)) || 0;
  const inflowHops = parseInt(body.inflow_hops || String(settings.screening.defaultInflowHops));
  const outflowHops = parseInt(body.outflow_hops || String(settings.screening.defaultOutflowHops));
  const maxNodes = parseInt(body.max_nodes || String(settings.screening.maxNodesPerHop));
  const token = body.token || "usdt";

  if (!txId) {
    return NextResponse.json({ detail: "Transaction hash is required" }, { status: 400 });
  }

  const jobId = crypto.randomUUID().slice(0, 8);
  kytJobs[jobId] = {
    status: "running",
    type: "kyt",
    progress: "Submitting KYT screen to width.info...",
    started_at: new Date().toISOString(),
    request: {
      chain,
      tx_id: txId,
      token,
      direction,
      in_ruleset_id: inRulesetId,
      out_ruleset_id: outRulesetId,
      inflow_hops: inflowHops,
      outflow_hops: outflowHops,
      max_nodes: maxNodes,
    },
  };

  runKytScreening(jobId, {
    chain,
    txId,
    token,
    direction,
    inRulesetId,
    outRulesetId,
    inflowHops,
    outflowHops,
    maxNodes,
    maxOpponentPaths: settings.screening.maxOpponentPaths,
    minAmount: settings.screening.minAmount,
  });

  return NextResponse.json({ job_id: jobId });
}

async function runKytScreening(
  jobId: string,
  p: {
    chain: string;
    txId: string;
    token: string;
    direction: KytDirection;
    inRulesetId: number;
    outRulesetId: number;
    inflowHops: number;
    outflowHops: number;
    maxNodes: number;
    maxOpponentPaths: number;
    minAmount: number;
  },
) {
  try {
    kytJobs[jobId].progress = "Screening transaction (server-side ruleset engine, 30-90s)...";

    const result: KytScreenResult = await kytScreen({
      chain: p.chain,
      txId: p.txId,
      token: p.token,
      screenDirection: p.direction,
      inflowHops: p.inflowHops,
      outflowHops: p.outflowHops,
      maxNodesPerHop: p.maxNodes,
      maxOpponentPaths: p.maxOpponentPaths,
      minAmount: p.minAmount,
      inRulesetId: p.inRulesetId,
      outRulesetId: p.outRulesetId,
    });

    const jobData: Record<string, unknown> = {
      status: "completed",
      type: "kyt",
      completed_at: new Date().toISOString(),
      request: kytJobs[jobId].request,
      result,
    };
    kytJobs[jobId] = jobData;
    saveHistoryEntry(jobId, jobData, {
      type: "kyt",
      chain: p.chain,
      subject: p.txId,
      direction: p.direction,
      risk_level: result.risk,
      hits_count: result.hits.length,
      completed_at: jobData.completed_at as string,
      source: "manual",
    });

    if (shouldAlert(result.risk)) {
      sendWebhook("screening.high_risk", {
        type: "kyt",
        chain: p.chain,
        tx_id: p.txId,
        direction: p.direction,
        risk: result.risk,
        risk_score: result.riskScore,
        job_id: jobId,
      });
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    kytJobs[jobId] = {
      status: "error",
      type: "kyt",
      error: errMsg,
      request: kytJobs[jobId].request,
    };
  }
}
