import { NextResponse } from "next/server";
import {
  saveBatchMeta,
  loadBatchMeta,
  loadBatchIndex,
  upsertBatchIndexEntry,
  saveBatchItem,
} from "@/lib/storage";
import { kyaScreen, kytScreen, type WidthTag } from "@/lib/width-api";
import { getSettings } from "@/lib/settings";
import { detectChainFromAddress, detectChainFromTxId } from "@/lib/chain-detect";
import type { BatchJob, BatchType, BatchIndexEntry } from "@/lib/types";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Batch screening engine.
//
// A batch runs every submitted item through the SAME width.info async
// screening used by single screens (mode:"async" submit + poll inside
// kyaScreen/kytScreen), with DEFAULT parameters taken from Settings
// (hops / max nodes / min amount / force_time_sequence / cex_immune /
// scoring + ruleset ids). Items are processed by a small worker pool
// (BATCH_CONCURRENCY) to respect the width API rate limits.
//
// Persistence (file-based, same as the rest of the app):
//   data/batches/{id}/meta.json            — batch meta + per-item summaries
//   data/batches/{id}/items/{index}.json   — full per-item result payloads
//   data/batches/_index.json               — lightweight batch index (cap 50)
// Running batches live in the in-memory `batchJobs` map; on process restart
// any unfinished batch is marked "interrupted" (still viewable, not runnable).
// ---------------------------------------------------------------------------

const MAX_BATCH_ITEMS = 50;
const BATCH_CONCURRENCY = 2;

// In-memory job storage — shared with [batchId]/route.ts via export.
export const batchJobs: Record<string, BatchJob> = {};

const SUPPORTED_CHAINS = ["Tron", "Ethereum"];

function chainFor(subject: string, type: BatchType, fallback: string): string {
  const detected = type === "kya" ? detectChainFromAddress(subject) : detectChainFromTxId(subject);
  return detected && SUPPORTED_CHAINS.includes(detected) ? detected : fallback;
}

/** Snapshot of the settings defaults a batch runs with (for traceability). */
function defaultsSnapshot(type: BatchType, chain: string): Record<string, unknown> {
  const s = getSettings().screening;
  return {
    type,
    chain,
    inflow_hops: s.defaultInflowHops,
    outflow_hops: s.defaultOutflowHops,
    max_nodes_per_hop: s.maxNodesPerHop,
    max_opponent_paths: s.maxOpponentPaths,
    min_amount: s.minAmount,
    force_time_sequence: s.forceTimeSequence,
    cex_immune: s.cexImmune,
    scoring_ruleset_id: s.defaultScoringRulesetId,
    kya_ruleset_id: s.defaultKyaRulesetId,
    kyt_in_ruleset_id: s.defaultKytInRulesetId,
    kyt_out_ruleset_id: s.defaultKytOutRulesetId,
  };
}

function indexEntryOf(b: BatchJob): BatchIndexEntry {
  return {
    id: b.id,
    type: b.type,
    chain: b.chain,
    total: b.total,
    status: b.status,
    done: b.done,
    failed: b.failed,
    flagged: b.flagged,
    created_at: b.created_at,
    completed_at: b.completed_at,
  };
}

function persist(batch: BatchJob) {
  saveBatchMeta(batch);
  upsertBatchIndexEntry(indexEntryOf(batch));
}

// Stale-state recovery: a batch left "running" by a previous process (or a
// dev hot-reload that reset the in-memory map) never gets its completion
// write — mark it interrupted so it stays visible in history and its already-
// finished items remain openable. Runs once at module load.
(function markInterruptedBatches() {
  try {
    for (const entry of loadBatchIndex()) {
      if (entry.status !== "running") continue;
      const meta = loadBatchMeta(entry.id);
      if (meta && meta.status === "running") {
        meta.status = "interrupted";
        meta.completed_at ??= new Date().toISOString();
        persist(meta);
      }
    }
  } catch { /* best-effort */ }
})();

/** Screen one item with settings defaults; returns the job-shaped payload. */
async function screenItem(type: BatchType, subject: string, chain: string, token = "usdt"): Promise<Record<string, unknown>> {
  const s = getSettings().screening;
  const request: Record<string, unknown> = { chain, token };

  if (type === "kya") {
    const result = await kyaScreen({
      chain,
      address: subject,
      token,
      inflowHops: s.defaultInflowHops,
      outflowHops: s.defaultOutflowHops,
      maxNodesPerHop: s.maxNodesPerHop,
      maxOpponentPaths: s.maxOpponentPaths,
      minAmount: s.minAmount,
      isPenetrateContract: false,
      forceTimeSequence: s.forceTimeSequence,
      cexImmune: s.cexImmune,
      rulesetId: s.defaultKyaRulesetId,
      scoringRulesetId: s.defaultScoringRulesetId,
      scenario: s.defaultScenario,
    });
    return {
      status: "completed",
      type: "kya",
      chain,
      completed_at: new Date().toISOString(),
      request,
      result,
      fund_score: result.score,
      chain_stats: result.scoreOverview,
    };
  }

  const result = await kytScreen({
    chain,
    txId: subject,
    token,
    screenDirection: "both",
    inflowHops: s.defaultInflowHops,
    outflowHops: s.defaultOutflowHops,
    maxNodesPerHop: s.maxNodesPerHop,
    maxOpponentPaths: s.maxOpponentPaths,
    minAmount: s.minAmount,
    isPenetrateContract: false,
    forceTimeSequence: s.forceTimeSequence,
    inRulesetId: s.defaultKytInRulesetId,
    outRulesetId: s.defaultKytOutRulesetId,
    scoringRulesetId: s.defaultScoringRulesetId,
  });
  return {
    status: "completed",
    type: "kyt",
    chain,
    completed_at: new Date().toISOString(),
    request,
    result,
    fund_score: result.score,
  };
}

async function runBatch(id: string) {
  const batch = batchJobs[id];
  if (!batch) return;

  let cursor = 0;
  const workerCount = Math.min(BATCH_CONCURRENCY, batch.total);
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= batch.total) return;
      const item = batch.items[i];
      try {
        const payload = await screenItem(batch.type, item.subject, item.chain);
        saveBatchItem(id, i, payload);
        const result = payload.result as {
          risk?: string;
          score?: { score?: number | null; verdict?: string | null } | null;
          subjectTags?: WidthTag[];
          fromTags?: WidthTag[];
        };
        item.status = "completed";
        item.risk = result.risk ?? "low";
        item.score = result.score?.score ?? null;
        item.verdict = result.score?.verdict ?? null;
        // The subject's own tags: KYA = the address's tags, KYT = sender tags.
        item.tags = batch.type === "kya" ? (result.subjectTags ?? []) : (result.fromTags ?? []);
        if (item.risk === "high" || item.risk === "critical") batch.flagged++;
      } catch (e) {
        item.status = "error";
        item.error = e instanceof Error ? e.message : String(e);
        batch.failed++;
      } finally {
        batch.done++;
        persist(batch);
      }
    }
  });
  await Promise.all(workers);

  batch.status = batch.failed === batch.total ? "error" : "completed";
  batch.completed_at = new Date().toISOString();
  persist(batch);
}

/** Create a batch. Body: { type: "kya"|"kyt", items: string[], chain? } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const type: BatchType = body.type === "kyt" ? "kyt" : "kya";
  const chain = SUPPORTED_CHAINS.includes(body.chain) ? body.chain : "Tron";

  let items: string[] = Array.isArray(body.items)
    ? body.items.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];
  items = [...new Set(items)];
  if (items.length === 0) {
    return NextResponse.json({ detail: "At least one address or tx hash is required" }, { status: 400 });
  }
  if (items.length > MAX_BATCH_ITEMS) {
    return NextResponse.json({ detail: `Batch limited to ${MAX_BATCH_ITEMS} items per run` }, { status: 400 });
  }

  const id = `batch_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const batch: BatchJob = {
    id,
    type,
    chain,
    total: items.length,
    status: "running",
    done: 0,
    failed: 0,
    flagged: 0,
    created_at: new Date().toISOString(),
    request: defaultsSnapshot(type, chain),
    items: items.map((subject, index) => ({
      index,
      subject,
      chain: chainFor(subject, type, chain),
      status: "running",
    })),
  };

  batchJobs[id] = batch;
  persist(batch);
  runBatch(id).catch((e) => {
    console.error(`[Batch] Run failed for ${id}:`, e);
    batch.status = "error";
    batch.completed_at = new Date().toISOString();
    persist(batch);
  });

  return NextResponse.json({ batch_id: id }, { status: 201 });
}

/** List completed/interrupted batches (index only, newest first). */
export async function GET() {
  return NextResponse.json(loadBatchIndex());
}

