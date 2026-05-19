/**
 * Wrappers for the TrustIn compat /query/* endpoints that fetch individual
 * transaction records between two addresses.
 *
 * These are independent of the investigation workflow in `trustin-api.ts` —
 * the path investigation only returns edge aggregates (amount + last_closed_ts),
 * not individual tx hashes. To list per-tx detail for an edge, we call:
 *   POST /query/query_transactions_by_timestamp_range
 */
import { getTrustInBaseUrl } from "./settings";

const SHAULA_TOKEN_HEADER = "x-shaula-token";
const SHAULA_TOKEN_VALUE = "trustin-platform";

function baseUrl(): string {
  try { return getTrustInBaseUrl(); } catch { return "https://platform.trustin.bond/api/infinity/api"; }
}

export interface TxItem {
  /** Stringified raw integer; for USDT/USDC divide by 1e6 to get USD. */
  amount: string;
  token: string;
  from: string;
  to: string;
  tx_id: string;
  block_number: number;
  block_timestamp: number;
}

export interface ListTxsParams {
  chain: string;
  token: string;
  from: string;
  to: string;
  /** epoch ms */
  minTimestamp?: number;
  /** epoch ms, 0 = server uses now() */
  maxTimestamp?: number;
  page?: number;
  pageSize?: number;
}

export interface ListTxsResult {
  items: TxItem[];
  total: number;
}

export async function listEdgeTransactions(p: ListTxsParams): Promise<ListTxsResult> {
  const body = {
    chain_name: p.chain.toLowerCase(),
    token: p.token,
    from: p.from,
    to: p.to,
    min_timestamp: p.minTimestamp ?? 0,
    max_timestamp: p.maxTimestamp ?? 0,
    page: p.page ?? 1,
    page_size: Math.min(p.pageSize ?? 20, 500),
  };

  const res = await fetch(`${baseUrl()}/query/query_transactions_by_timestamp_range`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "amlclaw-web/1.0.0",
      [SHAULA_TOKEN_HEADER]: SHAULA_TOKEN_VALUE,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TrustIn API error: ${res.status} ${res.statusText}`);

  const raw = await res.json() as { code: number; msg?: string; data?: TxItem[]; total?: number };
  if (raw.code !== 0) throw new Error(`TrustIn API error: ${raw.msg ?? "unknown"}`);

  return {
    items: raw.data ?? [],
    total: typeof raw.total === "number" ? raw.total : (raw.data?.length ?? 0),
  };
}

/**
 * Convert TrustIn's raw amount string (no decimal point, USDT/USDC scaled by 1e6)
 * into a USD float. Returns NaN if unparseable.
 */
export function parseStableAmountUsd(raw: string, token: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  const t = token.toLowerCase();
  if (t === "usdt" || t === "usdc") return n / 1e6;
  return n;
}

/**
 * Build a block-explorer URL for a tx hash. Returns null if the chain is
 * not supported yet.
 */
export function explorerTxUrl(chain: string, txId: string): string | null {
  const c = chain.toLowerCase();
  if (c === "tron") return `https://tronscan.org/#/transaction/${txId}`;
  if (c === "ethereum") return `https://etherscan.io/tx/${txId}`;
  if (c === "bitcoin") return `https://www.blockchain.com/btc/tx/${txId}`;
  if (c === "solana") return `https://solscan.io/tx/${txId}`;
  return null;
}
