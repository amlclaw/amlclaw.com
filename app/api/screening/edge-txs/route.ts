import { NextResponse } from "next/server";
import { listEdgeTransactions, parseStableAmountUsd, explorerTxUrl } from "@/lib/trustin-tx-queries";
import { getTrustInToken } from "@/lib/settings";

/**
 * GET /api/screening/edge-txs?chain=Tron&from=X&to=Y&token=USDT&page=1&page_size=20
 *
 * Returns per-tx detail for a single edge between two on-chain addresses.
 * Used by FlowGraph's edge-click handler.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const chain = url.searchParams.get("chain") ?? "Tron";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const token = url.searchParams.get("token") ?? getTrustInToken();
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("page_size") ?? "20", 10);
  const minTs = parseInt(url.searchParams.get("min_timestamp") ?? "0", 10);
  const maxTs = parseInt(url.searchParams.get("max_timestamp") ?? "0", 10);

  if (!from || !to) {
    return NextResponse.json({ detail: "from and to are required" }, { status: 400 });
  }
  if (from.startsWith("cluster:") || to.startsWith("cluster:")) {
    return NextResponse.json({
      detail: "Cluster edges have no single tx list. Open the cluster panel and pick a member address.",
    }, { status: 400 });
  }

  try {
    const { items, total } = await listEdgeTransactions({
      chain, token, from, to,
      minTimestamp: minTs || undefined,
      maxTimestamp: maxTs || undefined,
      page, pageSize,
    });

    return NextResponse.json({
      from, to, chain, token, page, page_size: pageSize, total,
      items: items.map((tx) => ({
        tx_id: tx.tx_id,
        block_number: tx.block_number,
        block_timestamp: tx.block_timestamp,
        // The per-tx record from the compat API doesn't reliably include a
        // `token` field — fall back to the request-level token.
        amount_usd: parseStableAmountUsd(tx.amount, tx.token || token),
        amount_raw: tx.amount,
        explorer_url: explorerTxUrl(chain, tx.tx_id),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: msg }, { status: 502 });
  }
}
