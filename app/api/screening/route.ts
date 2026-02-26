import { NextResponse } from "next/server";
import { findRuleset, loadRuleset, saveHistoryEntry } from "@/lib/storage";
import { kyaProDetect } from "@/lib/trustin-api";
import { extractRiskPaths, type Rule } from "@/lib/extract-risk-paths";
import crypto from "crypto";

// In-memory job storage
const screeningJobs: Record<string, Record<string, unknown>> = {};

// Make accessible to status/export routes
export { screeningJobs };

export async function POST(req: Request) {
  const body = await req.json();
  const chain = body.chain || "Tron";
  const address = (body.address || "").trim();
  const scenario = body.scenario || "all";
  const rulesetId = body.ruleset_id || "singapore_mas";
  const inflowHops = parseInt(body.inflow_hops || "3");
  const outflowHops = parseInt(body.outflow_hops || "3");
  const maxNodes = parseInt(body.max_nodes || "100");

  if (!address) {
    return NextResponse.json({ detail: "Address is required" }, { status: 400 });
  }

  const apiKey = process.env.TRUSTIN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { detail: "TRUSTIN_API_KEY not configured. Set it in .env.local file." },
      { status: 500 }
    );
  }

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
    },
  };

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
  } catch (e) {
    screeningJobs[jobId] = {
      status: "error",
      error: e instanceof Error ? e.message : String(e),
      request: screeningJobs[jobId].request,
    };
  }
}
