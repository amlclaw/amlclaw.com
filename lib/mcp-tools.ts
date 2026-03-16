/**
 * MCP tool definitions for Copilot.
 * Migrated from copilot-tools.ts to use Agent SDK's createSdkMcpServer.
 * search_regulations now reads files directly (1M context makes embedding unnecessary).
 */
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { loadHistoryIndex, loadHistoryJob, loadMonitorIndex } from "./storage";
import defaultDocs from "@/data/documents.json";

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleSearchRegulations(args: { query: string }) {
  // Direct file reading — load all regulatory documents and return content
  // Claude's 1M context handles the search naturally, no embedding needed
  const referencesDir = path.join(process.cwd(), "references");
  const results: { source: string; content: string }[] = [];

  for (const doc of defaultDocs) {
    const filepath = path.join(process.cwd(), "references", doc.path);
    try {
      const content = fs.readFileSync(filepath, "utf-8");
      // Simple keyword match to filter relevant docs (Claude will do deeper analysis)
      const queryLower = args.query.toLowerCase();
      const contentLower = content.toLowerCase();
      const nameLower = (doc.name || "").toLowerCase();
      if (contentLower.includes(queryLower) || nameLower.includes(queryLower) || queryLower.split(/\s+/).some(w => contentLower.includes(w))) {
        results.push({
          source: doc.name || doc.id,
          content: content.slice(0, 3000), // First 3K chars per doc
        });
      }
    } catch { /* file not found */ }
  }

  if (results.length === 0) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ message: "No matching regulatory documents found." }) }],
    };
  }

  return {
    content: [{ type: "text" as const, text: JSON.stringify(results.slice(0, 5)) }],
  };
}

async function handleGetScreeningHistory(args: { limit?: number; risk_level?: string }) {
  const limit = args.limit || 10;
  let index = loadHistoryIndex();

  if (args.risk_level) {
    index = index.filter((e) => e.risk_level === args.risk_level);
  }

  const results = index.slice(0, limit);

  return {
    content: [{ type: "text" as const, text: results.length === 0
      ? JSON.stringify({ message: "No screening history found." })
      : JSON.stringify(results)
    }],
  };
}

async function handleGetScreeningDetail(args: { job_id: string }) {
  if (!args.job_id) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: "job_id is required" }) }] };
  }

  const job = loadHistoryJob(args.job_id);
  if (!job) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Screening job ${args.job_id} not found` }) }] };
  }

  const req = (job.request as Record<string, unknown>) || {};
  const result = (job.result as Record<string, unknown>) || {};
  const summary = (result.summary as Record<string, unknown>) || {};
  const entities = (result.risk_entities as unknown[]) || [];
  const rules = (result.triggered_rules as unknown[]) || [];

  return {
    content: [{ type: "text" as const, text: JSON.stringify({
      job_id: args.job_id,
      chain: req.chain,
      address: req.address,
      scenario: req.scenario,
      ruleset: req.ruleset,
      risk_level: summary.highest_severity,
      risk_score: summary.risk_score,
      risk_entities_count: entities.length,
      risk_entities: entities.slice(0, 10),
      triggered_rules: rules.slice(0, 10),
      completed_at: job.completed_at,
    }) }],
  };
}

async function handleGetMonitorStatus() {
  const monitors = loadMonitorIndex();

  if (monitors.length === 0) {
    return { content: [{ type: "text" as const, text: JSON.stringify({ message: "No monitoring tasks found." }) }] };
  }

  const summary = monitors.map((m) => ({
    id: m.id,
    name: m.name,
    enabled: m.enabled,
    running: m.running,
    addresses_count: m.addresses?.length || 0,
    schedule: m.schedule,
    last_run: m.last_run_at,
    created_at: m.created_at,
  }));

  return { content: [{ type: "text" as const, text: JSON.stringify(summary) }] };
}

// ---------------------------------------------------------------------------
// MCP Server definition
// ---------------------------------------------------------------------------

export const amlclawMcpServer = createSdkMcpServer({
  name: "amlclaw",
  tools: [
    tool(
      "search_regulations",
      "Search AML regulatory documents by keyword. Use when user asks about regulations, compliance requirements, or legal obligations.",
      { query: z.string().describe("Search keyword or topic about AML regulations") },
      handleSearchRegulations,
    ),
    tool(
      "get_screening_history",
      "Get recent address screening results. Use when user asks about past screenings.",
      {
        limit: z.number().optional().describe("Max results (default 10)"),
        risk_level: z.enum(["Severe", "High", "Medium", "Low"]).optional().describe("Filter by risk level"),
      },
      handleGetScreeningHistory,
    ),
    tool(
      "get_screening_detail",
      "Get detailed screening result for a specific job. Use when user asks to explain a specific screening.",
      { job_id: z.string().describe("Screening job ID") },
      handleGetScreeningDetail,
    ),
    tool(
      "get_monitor_status",
      "Get status of monitoring tasks. Use when user asks about active monitors.",
      {},
      handleGetMonitorStatus,
    ),
  ],
});
