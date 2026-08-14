import { NextResponse } from "next/server";
import {
  saveBatchMeta,
  loadBatchMeta,
  loadBatchIndex,
  upsertBatchIndexEntry,
  saveBatchItem,
} from "@/lib/storage";
import { kyaScreen, kytScreen, screenTimeoutMs, type WidthTag } from "@/lib/width-api";
import { getSettings, type Settings } from "@/lib/settings";
import { detectChainFromAddress, detectChainFromTxId } from "@/lib/chain-detect";
import { resolveTxEndpoints } from "@/lib/chain-txs";
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
// Running batches live in the in-memory `batchJobs` map and are removed on
// completion; on process restart any unfinished batch is marked "interrupted"
// (still viewable, not runnable).
// ---------------------------------------------------------------------------

const MAX_BATCH_ITEMS = 50;
const MAX_ITEM_LENGTH = 128;
const BATCH_CONCURRENCY = 2;
/** Only mark a "running" batch interrupted if it is older than this — a young
 *  batch may still be actively running in another instance (dev HMR reloads
 *  the module without killing the old worker closures). */
const INTERRUPT_GRACE_MS = 60_000;

// In-memory job storage — shared with [batchId]/route.ts via export.
export const batchJobs: Record<string, BatchJob> = {};

const SUPPORTED_CHAINS = ["Tron", "Ethereum"];

function chainFor(subject: string, type: BatchType, fallback: string): string {
  const detected = type === "kya" ? detectChainFromAddress(subject) : detectChainFromTxId(subject);
  return detected && SUPPORTED_CHAINS.includes(detected) ? detected : fallback;
}

/** Validates an item's format for the batch type (rejects junk that would
 *  waste a width.info screen). Returns null when valid, else a reason. */
function itemInvalid(subject: string, type: BatchType): string | null {
  if (subject.length > MAX_ITEM_LENGTH) return `item too long (${subject.length} > ${MAX_ITEM_LENGTH} chars)`;
  const detected = type === "kya" ? detectChainFromAddress(subject) : detectChainFromTxId(subject);
  if (!detected) return `not a valid ${type === "kya" ? "address" : "transaction hash"}: "${subject.slice(0, 40)}"`;
  return null;
}

/** Snapshot of the settings defaults a batch runs with (for traceability). */
function defaultsSnapshot(type: BatchType, chain: string, s: Settings["screening"]): Record<string, unknown> {
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
    scenario: s.defaultScenario,
    polling_timeout_seconds: s.pollingTimeout,
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

/** Drop a finished batch from the in-memory map (the GET route falls back to
 *  the persisted meta). Keeps the map bounded to running batches only. */
function dropIfTerminal(batch: BatchJob) {
  if (batch.status !== "running") delete batchJobs[batch.id];
}

// Stale-state recovery: a batch left "running" by a previous process never
// gets its completion write — mark it interrupted (with a grace window so a
// genuinely-running batch in another instance/HMR survivor is not mislabeled)
// so it stays visible in history and its finished items remain openable.
(function markInterruptedBatches() {
  try {
    const now = Date.now();
    for (const entry of loadBatchIndex()) {
      if (entry.status !== "running") continue;
      const meta = loadBatchMeta(entry.id);
      if (!meta || meta.status !== "running") continue;
      if (now - new Date(meta.created_at).getTime() < INTERRUPT_GRACE_MS) continue;
      meta.status = "interrupted";
      meta.completed_at ??= new Date().toISOString();
      for (const item of meta.items) {
        if (item.status === "running") item.status = "skipped";
      }
      persist(meta);
    }
  } catch { /* best-effort */ }
})();

/** Screen one item with a FIXED settings snapshot (mid-batch edits must not
 *  change parameters for later items — reproducibility matters for AML). */
async function screenItem(
  type: BatchType,
  subject: string,
  chain: string,
  s: Settings["screening"],
): Promise<Record<string, unknown>> {
  const request: Record<string, unknown> = { chain, token: "usdt" };

  if (type === "kya") {
    const result = await kyaScreen(
      {
        chain,
        address: subject,
        token: "usdt",
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
      },
      undefined,
      screenTimeoutMs(),
    );
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

  const result = await kytScreen(
    {
      chain,
      txId: subject,
      token: "usdt",
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
    },
    undefined,
    screenTimeoutMs(),
  );
  // Resolve from/to for the report header + KYT evidence anchors (display only).
  let txEndpoints = null;
  try { txEndpoints = await resolveTxEndpoints(chain, subject); } catch { /* display degrades */ }
  return {
    status: "completed",
    type: "kyt",
    chain,
    completed_at: new Date().toISOString(),
    request,
    result,
    fund_score: result.score,
    tx_endpoints: txEndpoints,
  };
}

async function runBatch(id: string, s: Settings["screening"]) {
  const batch = batchJobs[id];
  if (!batch) return;

  let cursor = 0;
  const workerCount = Math.min(BATCH_CONCURRENCY, batch.total);
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= batch.total) return;
      const item = batch.items[i];
      const startedAt = Date.now();
      try {
        const payload = await screenItem(batch.type, item.subject, item.chain, s);
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
        // Flag on either the rule-level risk OR the fund-score verdict.
        if (
          item.risk === "high" || item.risk === "critical"
          || item.verdict === "block" || item.verdict === "edd"
        ) batch.flagged++;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        item.status = "error";
        item.error = errMsg;
        batch.failed++;
        // Persist an error payload so the UI can render the failure detail.
        saveBatchItem(id, i, {
          status: "error",
          type: batch.type,
          chain: item.chain,
          error: errMsg,
          request: { chain: item.chain, token: "usdt" },
        });
      } finally {
        item.elapsedMs = Date.now() - startedAt;
        batch.done++;
        persist(batch);
      }
    }
  });
  await Promise.all(workers);

  batch.status = batch.failed === batch.total ? "error" : "completed";
  batch.completed_at = new Date().toISOString();
  persist(batch);
  dropIfTerminal(batch);
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
  // Reject invalid items up-front — garbage would each burn a width.info screen.
  const invalid = items.map((it) => itemInvalid(it, type)).filter((r): r is string => r !== null);
  if (invalid.length > 0) {
    return NextResponse.json({
      detail: `${invalid.length} invalid item(s): ${invalid.slice(0, 3).join("; ")}${invalid.length > 3 ? "…" : ""}`,
    }, { status: 400 });
  }

  // Capture the settings ONCE for the whole batch (fixed parameters, traceable).
  const screening = getSettings().screening;

  // Cheap collision insurance for the id.
  let id = "";
  for (;;) {
    id = `batch_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
    if (!loadBatchMeta(id)) break;
  }

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
    request: defaultsSnapshot(type, chain, screening),
    items: items.map((subject, index) => ({
      index,
      subject,
      chain: chainFor(subject, type, chain),
      status: "running",
    })),
  };

  batchJobs[id] = batch;
  persist(batch);
  runBatch(id, screening).catch((e) => {
    console.error(`[Batch] Run failed for ${id}:`, e);
    batch.status = "error";
    batch.completed_at = new Date().toISOString();
    persist(batch);
    dropIfTerminal(batch);
  });

  return NextResponse.json({ batch_id: id }, { status: 201 });
}

/** List completed/interrupted batches (index only, newest first). */
export async function GET() {
  return NextResponse.json(loadBatchIndex());
}
