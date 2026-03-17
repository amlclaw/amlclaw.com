import { NextResponse } from "next/server";
import { findRuleset, loadRuleset, saveHistoryEntry } from "@/lib/storage";
import { kyaProDetect } from "@/lib/trustin-api";
import { extractRiskPaths, type Rule } from "@/lib/extract-risk-paths";
import { getSettings, getTrustInApiKey } from "@/lib/settings";
import { logAudit } from "@/lib/audit-log";
import { sendWebhook, shouldAlert } from "@/lib/webhook";
import { createCase } from "@/lib/case-storage";
import crypto from "crypto";

// In-memory job storage
const screeningJobs: Record<string, Record<string, unknown>> = {};

// Make accessible to status/export routes
export { screeningJobs };

export async function POST(req: Request) {
  const settings = getSettings();
  const body = await req.json();
  const chain = body.chain || "Tron";
  const address = (body.address || "").trim();
  const scenario = body.scenario || settings.screening.defaultScenario;
  const rulesetId = body.ruleset_id || settings.screening.defaultRuleset;
  const inflowHops = parseInt(body.inflow_hops || String(settings.screening.defaultInflowHops));
  const outflowHops = parseInt(body.outflow_hops || String(settings.screening.defaultOutflowHops));
  const maxNodes = parseInt(body.max_nodes || String(settings.screening.maxNodes));

  if (!address) {
    return NextResponse.json({ detail: "Address is required" }, { status: 400 });
  }

  // API key is optional — without it, TrustIn returns desensitized (masked) address data
  const apiKey = getTrustInApiKey();

  const { meta, filepath } = findRuleset(rulesetId);
  if (!meta || !filepath) {
    return NextResponse.json({ detail: "Ruleset not found" }, { status: 404 });
  }
  const rules = loadRuleset(filepath) as Rule[];

  const jobId = crypto.randomUUID().slice(0, 8);
  screeningJobs[jobId] = {
    status: "running",
    progress: "Initializing screening pipeline...",
    started_at: new Date().toISOString(),
    request: {
      chain,
      address,
      scenario,
      ruleset: (meta.name as string) || rulesetId,
      ruleset_id: rulesetId,
      inflow_hops: inflowHops,
      outflow_hops: outflowHops,
      max_nodes: maxNodes,
    },
  };

  logAudit("screening.started", { job_id: jobId, chain, address, scenario, ruleset: rulesetId, inflow_hops: inflowHops, outflow_hops: outflowHops, max_nodes: maxNodes });

  // Run screening in background (non-blocking)
  runScreening(jobId, chain, address, scenario, rules, inflowHops, outflowHops, maxNodes, apiKey);

  return NextResponse.json({ job_id: jobId });
}

async function runScreening(
  jobId: string,
  chain: string,
  address: string,
  scenario: string,
  rules: Rule[],
  inflowHops: number,
  outflowHops: number,
  maxNodes: number,
  apiKey: string
) {
  try {
    screeningJobs[jobId].progress = "Submitting task to TrustIn KYA API...";

    const directionMap: Record<string, string> = { withdrawal: "outflow" };
    const direction = directionMap[scenario] || "all";

    const opts = {
      inflowHops: direction === "outflow" ? 0 : inflowHops,
      outflowHops: direction === "inflow" ? 0 : outflowHops,
      maxNodesPerHop: maxNodes,
    };
    if (direction === "all") {
      opts.inflowHops = inflowHops;
      opts.outflowHops = outflowHops;
    }

    screeningJobs[jobId].progress = "Waiting for TrustIn API response (this may take 30-60s)...";
    const result = await kyaProDetect(chain, address, apiKey, opts);

    if (result.error) {
      throw new Error(`TrustIn API error: ${result.error}`);
    }

    screeningJobs[jobId].progress = "Graph received. Analyzing risk paths against rules...";
    const graphData = { graph_data: result.details, address };

    const { riskEntities, summary, targetFindings, targetTagsRaw } = extractRiskPaths(
      graphData,
      rules,
      Math.max(inflowHops, outflowHops),
      scenario
    );

    const selfMatched: string[] = [];
    for (const f of targetFindings) {
      selfMatched.push(...f.matched_rules);
    }

    const jobData: Record<string, unknown> = {
      status: "completed",
      completed_at: new Date().toISOString(),
      request: screeningJobs[jobId].request,
      result: {
        target: {
          chain,
          address,
          tags: targetTagsRaw || [],
          self_matched_rules: selfMatched,
        },
        scenario,
        summary,
        risk_entities: riskEntities,
        rules_used: rules,
      },
    };
    screeningJobs[jobId] = jobData;
    saveHistoryEntry(jobId, jobData);

    const riskLevel = (summary.highest_severity as string) || "Low";
    logAudit("screening.completed", { job_id: jobId, chain, address, risk_level: riskLevel });
    if (shouldAlert(riskLevel)) {
      sendWebhook("screening.high_risk", { chain, address, risk_level: riskLevel, job_id: jobId });
    }

    // Auto-create case for High/Severe risk
    if (riskLevel === "Severe" || riskLevel === "High") {
      try {
        createCase({
          screening_job_id: jobId,
          trigger_risk_level: riskLevel,
          trigger_address: address,
          trigger_chain: chain,
          trigger_scenario: scenario,
          trigger_ruleset: (screeningJobs[jobId].request as Record<string, unknown>)?.ruleset as string,
          triggered_rules: (summary.rules_triggered as string[]) || [],
        });
      } catch { /* best effort */ }
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    screeningJobs[jobId] = {
      status: "error",
      error: errMsg,
      request: screeningJobs[jobId].request,
    };
    logAudit("screening.error", { job_id: jobId, chain, address, error: errMsg });
  }
}
