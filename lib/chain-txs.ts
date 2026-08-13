/**
 * On-chain transaction feed for Address Monitoring.
 *
 * Pulls NEW stablecoin transfers for a monitored address since a cursor:
 *   - Ethereum: Etherscan v2 API (module=account, action=tokentx), USDT + USDC
 *   - Tron:     TronGrid TRC20 API, USDT only
 *
 * Without user-supplied API keys both providers work but are rate-limited.
 */
import { getEtherscanApiKey, getTrongridApiKey } from "./settings";

export interface ChainTx {
  txId: string;
  from: string;
  to: string;
  /** Token symbol: USDT | USDC */
  token: string;
  /** Human amount in token units (decimals applied). */
  amount: number;
  /** Unix ms */
  timestamp: number;
  /** Ethereum block number (0 for Tron). */
  blockNumber: number;
  /** "in" when the monitored address receives, "out" when it sends. */
  direction: "in" | "out";
}

export interface TxCursor {
  /** Ethereum: last seen block number. */
  lastBlock?: number;
  /** Tron: last seen block_timestamp (ms). */
  lastTimestamp?: number;
}

// Token contracts
const ETH_TOKENS: Record<string, { contract: string; decimals: number }> = {
  USDT: { contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  USDC: { contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
};
const TRON_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

/** Tokens monitorable per chain. */
export function supportedTokens(chain: string): string[] {
  return chain === "Ethereum" ? ["USDT", "USDC"] : ["USDT"];
}

/**
 * Initialize a cursor at "now" so a fresh monitor only sees FUTURE txs
 * (monitors watch activity after they are added, never history).
 */
export async function initCursor(chain: string): Promise<TxCursor> {
  if (chain === "Tron") {
    return { lastTimestamp: Date.now() };
  }
  // Ethereum: current block number
  const apiKey = getEtherscanApiKey() || "YourApiKeyToken";
  const url =
    `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_blockNumber` +
    `&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
  const json = (await res.json()) as { result?: string };
  const block = parseInt(json.result ?? "0x0", 16);
  if (!block) throw new Error("Failed to fetch current Ethereum block number");
  return { lastBlock: block };
}

/**
 * Fetch transfers for `address` newer than `cursor`. Returns transfers sorted
 * oldest-first plus the advanced cursor. Caller applies amount filtering.
 */
export async function fetchNewTxs(
  chain: string,
  address: string,
  cursor: TxCursor,
): Promise<{ txs: ChainTx[]; cursor: TxCursor }> {
  if (chain === "Ethereum") return fetchEthereum(address, cursor);
  if (chain === "Tron") return fetchTron(address, cursor);
  throw new Error(`Unsupported chain for monitoring: ${chain}`);
}

// ---------------------------------------------------------------------------
// Ethereum — Etherscan v2
// ---------------------------------------------------------------------------

async function fetchEthereum(
  address: string,
  cursor: TxCursor,
): Promise<{ txs: ChainTx[]; cursor: TxCursor }> {
  const apiKey = getEtherscanApiKey() || "YourApiKeyToken";
  const startBlock = (cursor.lastBlock ?? 0) + 1;
  const url =
    `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx` +
    `&address=${address}&startblock=${startBlock}&endblock=latest&page=1&offset=200` +
    `&sort=asc&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
  const json = (await res.json()) as { status: string; message: string; result: unknown };

  // status "0" + "No transactions found" is a normal empty result
  if (json.status !== "1") {
    if (String(json.message).toLowerCase().includes("no transactions")) {
      return { txs: [], cursor };
    }
    throw new Error(`Etherscan error: ${json.message} ${typeof json.result === "string" ? json.result : ""}`);
  }

  const rows = Array.isArray(json.result) ? (json.result as Record<string, string>[]) : [];
  const addrLower = address.toLowerCase();
  const txs: ChainTx[] = [];
  let maxBlock = cursor.lastBlock ?? 0;

  for (const row of rows) {
    const contract = String(row.contractAddress ?? "").toLowerCase();
    const tokenEntry = Object.entries(ETH_TOKENS).find(
      ([, v]) => v.contract.toLowerCase() === contract,
    );
    const block = parseInt(row.blockNumber ?? "0", 10);
    if (block > maxBlock) maxBlock = block;
    if (!tokenEntry) continue; // not USDT/USDC

    const [symbol, { decimals }] = tokenEntry;
    const from = String(row.from ?? "").toLowerCase();
    const amount = Number(row.value ?? "0") / 10 ** decimals;
    txs.push({
      txId: String(row.hash ?? ""),
      from: String(row.from ?? ""),
      to: String(row.to ?? ""),
      token: symbol,
      amount,
      timestamp: parseInt(row.timeStamp ?? "0", 10) * 1000,
      blockNumber: block,
      direction: from === addrLower ? "out" : "in",
    });
  }

  return { txs, cursor: { ...cursor, lastBlock: maxBlock } };
}

// ---------------------------------------------------------------------------
// Tron — TronGrid TRC20
// ---------------------------------------------------------------------------

async function fetchTron(
  address: string,
  cursor: TxCursor,
): Promise<{ txs: ChainTx[]; cursor: TxCursor }> {
  const apiKey = getTrongridApiKey();
  const minTs = (cursor.lastTimestamp ?? 0) + 1;
  const url =
    `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20` +
    `?only_confirmed=true&limit=200&order_by=block_timestamp,asc` +
    `&min_timestamp=${minTs}&contract_address=${TRON_USDT_CONTRACT}`;

  const headers: Record<string, string> = {};
  if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
  const json = (await res.json()) as { success?: boolean; data?: Record<string, unknown>[] };
  const rows = Array.isArray(json.data) ? json.data : [];

  const txs: ChainTx[] = [];
  let maxTs = cursor.lastTimestamp ?? 0;

  for (const row of rows) {
    if (String(row.type ?? "Transfer") !== "Transfer") continue;
    const tokenInfo = (row.token_info as Record<string, unknown>) || {};
    const decimals = Number(tokenInfo.decimals ?? 6);
    const ts = Number(row.block_timestamp ?? 0);
    if (ts > maxTs) maxTs = ts;

    txs.push({
      txId: String(row.transaction_id ?? ""),
      from: String(row.from ?? ""),
      to: String(row.to ?? ""),
      token: String(tokenInfo.symbol ?? "USDT"),
      amount: Number(row.value ?? "0") / 10 ** decimals,
      timestamp: ts,
      blockNumber: 0,
      direction: String(row.from ?? "") === address ? "out" : "in",
    });
  }

  return { txs, cursor: { ...cursor, lastTimestamp: maxTs } };
}

// ---------------------------------------------------------------------------
// Address volume stats — denominators for the fund-attribution risk score.
// Full-history in/out counts and sums for one token, with a pagination cap
// (busy addresses are truncated and flagged; a truncated denominator makes the
// resulting ratio conservative, never understated).
// ---------------------------------------------------------------------------

export interface AddressStats {
  token: string;
  inCount: number;
  inTotal: number;
  outCount: number;
  outTotal: number;
  firstTs: number;
  lastTs: number;
  truncated: boolean;
}

const TRON_STATS_MAX_PAGES = 25; // 25 × 200 = 5000 transfers
const ETH_STATS_MAX_ROWS = 10_000; // Etherscan page*offset cap

export async function fetchAddressStats(
  chain: string,
  address: string,
  token = "USDT",
): Promise<AddressStats> {
  const stats: AddressStats = {
    token, inCount: 0, inTotal: 0, outCount: 0, outTotal: 0,
    firstTs: 0, lastTs: 0, truncated: false,
  };
  const record = (from: string, amount: number, ts: number) => {
    const isOut = from.toLowerCase() === address.toLowerCase();
    if (isOut) { stats.outCount++; stats.outTotal += amount; }
    else { stats.inCount++; stats.inTotal += amount; }
    if (ts) {
      if (!stats.firstTs || ts < stats.firstTs) stats.firstTs = ts;
      if (ts > stats.lastTs) stats.lastTs = ts;
    }
  };

  if (chain === "Tron") {
    const apiKey = getTrongridApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    let fingerprint = "";
    for (let page = 0; page < TRON_STATS_MAX_PAGES; page++) {
      const url =
        `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20` +
        `?only_confirmed=true&limit=200&contract_address=${TRON_USDT_CONTRACT}` +
        (fingerprint ? `&fingerprint=${encodeURIComponent(fingerprint)}` : "");
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
      const json = (await res.json()) as {
        data?: Record<string, unknown>[];
        meta?: { fingerprint?: string };
      };
      const rows = Array.isArray(json.data) ? json.data : [];
      for (const row of rows) {
        if (String(row.type ?? "Transfer") !== "Transfer") continue;
        const info = (row.token_info as Record<string, unknown>) || {};
        const decimals = Number(info.decimals ?? 6);
        record(
          String(row.from ?? ""),
          Number(row.value ?? "0") / 10 ** decimals,
          Number(row.block_timestamp ?? 0),
        );
      }
      fingerprint = json.meta?.fingerprint || "";
      if (!fingerprint || rows.length === 0) return stats;
    }
    stats.truncated = true;
    return stats;
  }

  if (chain === "Ethereum") {
    const apiKey = getEtherscanApiKey() || "YourApiKeyToken";
    const tokenDef = ETH_TOKENS[token.toUpperCase() as keyof typeof ETH_TOKENS];
    if (!tokenDef) throw new Error(`Unsupported token for stats: ${token}`);
    const url =
      `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx` +
      `&address=${address}&contractaddress=${tokenDef.contract}` +
      `&startblock=0&endblock=latest&page=1&offset=${ETH_STATS_MAX_ROWS}` +
      `&sort=asc&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
    const json = (await res.json()) as { status: string; message: string; result: unknown };
    if (json.status !== "1") {
      if (String(json.message).toLowerCase().includes("no transactions")) return stats;
      throw new Error(`Etherscan error: ${json.message}`);
    }
    const rows = Array.isArray(json.result) ? (json.result as Record<string, string>[]) : [];
    for (const row of rows) {
      record(
        String(row.from ?? ""),
        Number(row.value ?? "0") / 10 ** tokenDef.decimals,
        parseInt(row.timeStamp ?? "0", 10) * 1000,
      );
    }
    if (rows.length >= ETH_STATS_MAX_ROWS) stats.truncated = true;
    return stats;
  }

  throw new Error(`Unsupported chain for stats: ${chain}`);
}

/** Current token balance of an address (USDT on Tron; USDT/USDC on Ethereum). */
export async function fetchTokenBalance(
  chain: string,
  address: string,
  token = "USDT",
): Promise<number> {
  if (chain === "Tron") {
    const apiKey = getTrongridApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    const res = await fetch(`https://api.trongrid.io/v1/accounts/${address}`, {
      headers, signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { trc20?: Record<string, string>[] }[] };
    for (const acc of json.data || []) {
      for (const entry of acc.trc20 || []) {
        if (entry[TRON_USDT_CONTRACT]) return Number(entry[TRON_USDT_CONTRACT]) / 1e6;
      }
    }
    return 0;
  }
  if (chain === "Ethereum") {
    const apiKey = getEtherscanApiKey() || "YourApiKeyToken";
    const tokenDef = ETH_TOKENS[token.toUpperCase() as keyof typeof ETH_TOKENS];
    if (!tokenDef) throw new Error(`Unsupported token for balance: ${token}`);
    const url =
      `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokenbalance` +
      `&contractaddress=${tokenDef.contract}&address=${address}&tag=latest` +
      `&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
    const json = (await res.json()) as { status: string; result?: string };
    if (json.status !== "1") return 0;
    return Number(json.result ?? "0") / 10 ** tokenDef.decimals;
  }
  throw new Error(`Unsupported chain for balance: ${chain}`);
}

// ---------------------------------------------------------------------------
// Single-tx lookup — used by KYT Monitoring to resolve from/to of a tx hash
// ---------------------------------------------------------------------------

export interface TxEndpoints {
  from: string;
  to: string;
  token: string;
  amount: number;
  /** Block timestamp in ms (0 when the provider didn't return one). */
  timestamp: number;
}

export async function resolveTxEndpoints(chain: string, txId: string): Promise<TxEndpoints> {
  if (chain === "Ethereum") {
    const apiKey = getEtherscanApiKey() || "YourApiKeyToken";
    // eth_getTransactionReceipt gives token transfer logs; simpler: tokentx by txhash
    // is not supported, so use the proxy transaction + parse ERC20 transfer via receipt.
    const url =
      `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getTransactionReceipt` +
      `&txhash=${txId}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
    const json = (await res.json()) as { result?: Record<string, unknown> };
    const receipt = json.result;
    if (!receipt) throw new Error("Transaction not found on Ethereum");

    const logs = Array.isArray(receipt.logs) ? (receipt.logs as Record<string, unknown>[]) : [];
    const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    for (const log of logs) {
      const topics = Array.isArray(log.topics) ? (log.topics as string[]) : [];
      const contract = String(log.address ?? "").toLowerCase();
      const tokenEntry = Object.entries(ETH_TOKENS).find(
        ([, v]) => v.contract.toLowerCase() === contract,
      );
      if (!tokenEntry || topics[0] !== TRANSFER_TOPIC || topics.length < 3) continue;
      const [symbol, { decimals }] = tokenEntry;
      // Block timestamp needs one extra call; non-fatal when it fails.
      let timestamp = 0;
      try {
        const blockUrl =
          `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getBlockByNumber` +
          `&tag=${receipt.blockNumber}&boolean=false&apikey=${encodeURIComponent(apiKey)}`;
        const blockRes = await fetch(blockUrl, { signal: AbortSignal.timeout(15_000) });
        const blockJson = (await blockRes.json()) as { result?: { timestamp?: string } };
        timestamp = parseInt(String(blockJson.result?.timestamp ?? "0x0"), 16) * 1000;
      } catch { /* keep 0 */ }
      return {
        from: "0x" + topics[1].slice(26),
        to: "0x" + topics[2].slice(26),
        token: symbol,
        amount: parseInt(String(log.data ?? "0x0"), 16) / 10 ** decimals,
        timestamp,
      };
    }
    throw new Error("No USDT/USDC transfer found in this transaction");
  }

  if (chain === "Tron") {
    const apiKey = getTrongridApiKey();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["TRON-PRO-API-KEY"] = apiKey;
    const res = await fetch("https://api.trongrid.io/wallet/gettransactioninfobyid", {
      method: "POST",
      headers,
      body: JSON.stringify({ value: txId }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
    const info = (await res.json()) as Record<string, unknown>;
    const logs = Array.isArray(info.log) ? (info.log as Record<string, unknown>[]) : [];
    const TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    for (const log of logs) {
      const topics = Array.isArray(log.topics) ? (log.topics as string[]) : [];
      if (!topics[0] || !topics[0].endsWith(TRANSFER_TOPIC) || topics.length < 3) continue;
      return {
        from: tronHexToBase58("41" + topics[1].slice(24)),
        to: tronHexToBase58("41" + topics[2].slice(24)),
        token: "USDT",
        amount: parseInt(String(log.data ?? "0"), 16) / 1e6,
        timestamp: Number(info.blockTimeStamp ?? 0),
      };
    }
    throw new Error("No TRC20 transfer found in this transaction");
  }

  throw new Error(`Unsupported chain: ${chain}`);
}

// Minimal base58check encode for Tron addresses (41-prefixed hex → T...)
import crypto from "crypto";

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function tronHexToBase58(hex: string): string {
  const bytes = Buffer.from(hex, "hex");
  const h1 = crypto.createHash("sha256").update(bytes).digest();
  const h2 = crypto.createHash("sha256").update(h1).digest();
  const full = Buffer.concat([bytes, h2.subarray(0, 4)]);

  let num = BigInt("0x" + full.toString("hex"));
  let out = "";
  while (num > 0n) {
    out = B58_ALPHABET[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const b of full) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}
