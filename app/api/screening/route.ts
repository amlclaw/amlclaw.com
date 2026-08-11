import { NextResponse } from "next/server";
import { saveHistoryEntry } from "@/lib/storage";
import { kyaScreen, screenStatusLabel, type KyaScreenResult } from "@/lib/width-api";
import { getSettings } from "@/lib/settings";
import { sendWebhook, shouldAlert } from "@/lib/webhook";
import crypto from "crypto";

// In-memory job storage
const screeningJobs: Record<string, Record<string, unknown>> = {};

// Make accessible to status routes
export { screeningJobs };

export async function POST(req: Request) {
  const settings = getSettings();
  const body = await req.json();
  const chain = body.chain || "Tron";
  const address = (body.address || "").trim();
  const scenario = body.scenario || settings.screening.defaultScenario;
  const rulesetId = parseInt(String(body.ruleset_id ?? settings.screening.defaultKyaRulesetId)) || 0;
  // NOTE: hops 0 is valid in v3 — use explicit undefined checks, not `||`
  const inflowHops = body.inflow_hops !== undefined && body.inflow_hops !== ""
    ? parseInt(String(body.inflow_hops))
    : settings.screening.defaultInflowHops;
  const outflowHops = body.outflow_hops !== undefined && body.outflow_hops !== ""
    ? parseInt(String(body.outflow_hops))
    : settings.screening.defaultOutflowHops;
  const maxNodes = parseInt(body.max_nodes || String(settings.screening.maxNodesPerHop));
  const token = body.token || "usdt";
  const minAmount = body.min_amount !== undefined && body.min_amount !== ""
    ? Number(body.min_amount)
    : settings.screening.minAmount;
  const maxOpponentPaths = parseInt(body.max_opponent_paths || String(settings.screening.maxOpponentPaths));
  const isPenetrateContract = body.is_penetrate_contract === true;
  const minTimestamp = body.min_timestamp ? Number(body.min_timestamp) : 0;
  const maxTimestamp = body.max_timestamp ? Number(body.max_timestamp) : Date.now();

  if (!address) {
    return NextResponse.json({ detail: "Address is required" }, { status: 400 });
  }

  const jobId = crypto.randomUUID().slice(0, 8);
  screeningJobs[jobId] = {
    status: "running",
    type: "kya",
    progress: "Submitting KYA screen to width.info...",
    started_at: new Date().toISOString(),
    request: {
      chain,
      address,
      token,
      scenario,
      ruleset_id: rulesetId,
      inflow_hops: inflowHops,
      outflow_hops: outflowHops,
      max_nodes: maxNodes,
      min_amount: minAmount,
      max_opponent_paths: maxOpponentPaths,
      is_penetrate_contract: isPenetrateContract,
      min_timestamp: minTimestamp,
      max_timestamp: maxTimestamp,
    },
  };

  // Run screening in background (non-blocking)
  runKyaScreening(jobId, {
    chain,
    address,
    token,
    scenario,
    rulesetId,
    inflowHops,
    outflowHops,
    maxNodes,
    maxOpponentPaths,
    minAmount,
    isPenetrateContract,
    minTimestamp,
    maxTimestamp,
  });

  return NextResponse.json({ job_id: jobId });
}

async function runKyaScreening(
  jobId: string,
  p: {
    chain: string;
    address: string;
    token: string;
    scenario: string;
    rulesetId: number;
    inflowHops: number;
    outflowHops: number;
    maxNodes: number;
    maxOpponentPaths: number;
    minAmount: number;
    isPenetrateContract: boolean;
    minTimestamp: number;
    maxTimestamp: number;
  },
) {
  try {
    screeningJobs[jobId].progress = "Submitting async screen to width.info...";

    const result: KyaScreenResult = await kyaScreen(
      {
        chain: p.chain,
        address: p.address,
        token: p.token,
        inflowHops: p.inflowHops,
        outflowHops: p.outflowHops,
        maxNodesPerHop: p.maxNodes,
        maxOpponentPaths: p.maxOpponentPaths,
        minAmount: p.minAmount,
        isPenetrateContract: p.isPenetrateContract,
        minTimestamp: p.minTimestamp,
        maxTimestamp: p.maxTimestamp,
        rulesetId: p.rulesetId,
        scenario: p.scenario,
      },
      {
        onStatus: (s) => {
          const job = screeningJobs[jobId];
          if (job && job.status === "running") job.progress = screenStatusLabel(s);
        },
      },
    );

    const jobData: Record<string, unknown> = {
      status: "completed",
      type: "kya",
      completed_at: new Date().toISOString(),
      request: screeningJobs[jobId].request,
      result,
    };
    screeningJobs[jobId] = jobData;
    saveHistoryEntry(jobId, jobData, {
      type: "kya",
      chain: p.chain,
      subject: p.address,
      scenario: p.scenario,
      risk_level: result.risk,
      hits_count: result.hits.length,
      completed_at: jobData.completed_at as string,
      source: "manual",
    });

    if (shouldAlert(result.risk)) {
      sendWebhook("screening.high_risk", {
        type: "kya",
        chain: p.chain,
        address: p.address,
        risk: result.risk,
        job_id: jobId,
      });
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    screeningJobs[jobId] = {
      status: "error",
      type: "kya",
      error: errMsg,
      request: screeningJobs[jobId].request,
    };
  }
}
