import { NextResponse } from "next/server";
import { batchJobs } from "../route";
import { loadBatchMeta, loadBatchItem } from "@/lib/storage";

/** Batch ids are server-generated (`batch_<ts>_<rand6>`); reject anything else
 *  before it can reach a filesystem path. */
const BATCH_ID_RE = /^batch_\d+_[0-9a-f]{6}$/;

/**
 * Batch status / item detail.
 *   GET /api/batch/{batchId}          → batch meta + per-item summaries
 *   GET /api/batch/{batchId}?item=N   → full result payload of item N
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  if (!BATCH_ID_RE.test(batchId)) {
    return NextResponse.json({ detail: "Batch not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const itemParam = url.searchParams.get("item");

  const batch = batchJobs[batchId] ?? loadBatchMeta(batchId);
  if (!batch) {
    return NextResponse.json({ detail: "Batch not found" }, { status: 404 });
  }

  if (itemParam !== null) {
    const index = parseInt(itemParam, 10);
    if (!Number.isFinite(index) || index < 0 || index >= batch.total) {
      return NextResponse.json({ detail: "Invalid item index" }, { status: 400 });
    }
    const item = loadBatchItem(batchId, index);
    if (!item) {
      return NextResponse.json({ detail: "Item not ready yet" }, { status: 404 });
    }
    return NextResponse.json(item);
  }

  return NextResponse.json(batch);
}
