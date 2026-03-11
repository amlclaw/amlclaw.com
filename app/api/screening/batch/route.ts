import { NextResponse } from "next/server";
import { findRuleset, loadRuleset, saveHistoryEntry } from "@/lib/storage";
import { kyaProDetect } from "@/lib/trustin-api";
import { extractRiskPaths, type Rule } from "@/lib/extract-risk-paths";
import { getSettings, getTrustInApiKey } from "@/lib/settings";
import { logAudit } from "@/lib/audit-log";
import { sendWebhook, shouldAlert } from "@/lib/webhook";
import crypto from "crypto";

// In-memory batch job storage
const batchJobs: Record<string, Record<string, unknown>> = {};
export { batchJobs };

export async function POST(req: Request) {
  const settings = getSettings();
  const body = await req.json();

  const addresses: { chain: string; address: string }[] = body.addresses || [];
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json({ detail: "At least one address is required" }, { status: 400 });
  }
  if (addresses.length > 100) {
    return NextResponse.json({ detail: "Maximum 100 addresses per batch" }, { status: 400 });
  }

  const scenario = body.scenario || settings.screening.defaultScenario;
  const rulesetId = body.ruleset_id || settings.screening.defaultRuleset;
  const inflowHops = parseInt(body.inflow_hops || String(settings.screening.defaultInflowHops));
  const outflowHops = parseInt(body.outflow_hops || String(settings.screening.defaultOutflowHops));
  const maxNodes = parseInt(body.max_nodes || String(settings.screening.maxNodes));

  const apiKey = getTrustInApiKey();

  const { meta, filepath } = findRuleset(rulesetId);
  if (!meta || !filepath) {
    return NextResponse.json({ detail: "Ruleset not found" }, { status: 404 });
  }
  const rules = loadRuleset(filepath) as Rule[];

  const batchId = `batch_${crypto.randomUUID().slice(0, 8)}`;
  batchJobs[batchId] = {
    status: "running",
    started_at: new Date().toISOString(),
    total: addresses.length,
    completed: 0,
    results: [],
    progress: `Starting batch screening of ${addresses.length} addresses...`,
  };

  logAudit("screening.batch_started", {
    batch_id: batchId,
    address_count: addresses.length,
    scenario,
    ruleset: rulesetId,
  });

  // Run in background
  runBatch(batchId, addresses, scenario, rules, inflowHops, outflowHops, maxNodes, apiKey, meta);

  return NextResponse.json({ batch_id: batchId, total: addresses.length });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const batchId = url.searchParams.get("id");
  if (!batchId || !(batchId in batchJobs)) {
    return NextResponse.json({ detail: "Batch not found" }, { status: 404 });
  }
  return NextResponse.json(batchJobs[batchId]);
}

async function runBatch(
  batchId: string,
  addresses: { chain: string; address: string }[],
  scenario: string,
  rules: Rule[],
  inflowHops: number,
  outflowHops: number,
  maxNodes: number,
  apiKey: string,
  rulesetMeta: Record<string, unknown>
) {
  const results: Record<string, unknown>[] = [];
  const directionMap: Record<string, string> = { withdrawal: "outflow" };
  const direction = directionMap[scenario] || "all";

  for (let i = 0; i < addresses.length; i++) {
    const { chain, address } = addresses[i];
    batchJobs[batchId].progress = `Screening ${i + 1}/${addresses.length}: ${address.slice(0, 10)}...`;

    try {
      const opts = {
        inflowHops: direction === "outflow" ? 0 : inflowHops,
        outflowHops: direction === "inflow" ? 0 : outflowHops,
        maxNodesPerHop: maxNodes,
      };
      if (direction === "all") {
        opts.inflowHops = inflowHops;
        opts.outflowHops = outflowHops;
      }

      const result = await kyaProDetect(chain, address, apiKey, opts);

      if (result.error) {
        results.push({ chain, address, status: "error", error: result.error });
        continue;
      }

      const graphData = { graph_data: result.details, address };
      const { riskEntities, summary, targetFindings, targetTagsRaw } = extractRiskPaths(
        graphData, rules, Math.max(inflowHops, outflowHops), scenario
      );

      const selfMatched: string[] = [];
      for (const f of targetFindings) selfMatched.push(...f.matched_rules);

      const jobId = crypto.randomUUID().slice(0, 8);
      const jobData: Record<string, unknown> = {
        status: "completed",
        completed_at: new Date().toISOString(),
        source: "batch",
        batch_id: batchId,
        request: { chain, address, scenario, ruleset: (rulesetMeta.name as string) || "" },
        result: {
          target: { chain, address, tags: targetTagsRaw || [], self_matched_rules: selfMatched },
          scenario,
          summary,
          risk_entities: riskEntities,
          rules_used: rules,
        },
      };
      saveHistoryEntry(jobId, jobData);

      const riskLevel = (summary.highest_severity as string) || "Low";
      results.push({
        chain, address, status: "completed", job_id: jobId,
        risk_level: riskLevel,
        risk_entities_count: riskEntities.length,
      });

      // Webhook alert for high risk
      if (shouldAlert(riskLevel)) {
        sendWebhook("screening.high_risk", { chain, address, risk_level: riskLevel, job_id: jobId, batch_id: batchId });
      }

      logAudit("screening.completed", { job_id: jobId, chain, address, risk_level: riskLevel, source: "batch" });
    } catch (e) {
      results.push({ chain, address, status: "error", error: e instanceof Error ? e.message : String(e) });
    }

    batchJobs[batchId].completed = i + 1;
    batchJobs[batchId].results = results;
  }

  batchJobs[batchId] = {
    ...batchJobs[batchId],
    status: "completed",
    completed_at: new Date().toISOString(),
    results,
    progress: `Completed ${addresses.length} screenings`,
  };

  logAudit("screening.batch_completed", {
    batch_id: batchId,
    total: addresses.length,
    completed: results.filter((r) => r.status === "completed").length,
    errors: results.filter((r) => r.status === "error").length,
  });
}
