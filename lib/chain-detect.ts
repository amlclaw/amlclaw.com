/**
 * Auto-detect chain from user input format. Client-safe (no Node APIs).
 *
 * Formats:
 *   Ethereum address:  0x + 40 hex        (shared by all EVM chains — when BSC
 *                                          etc. are added, detection stays
 *                                          "Ethereum" as the default EVM chain
 *                                          and the manual selector disambiguates)
 *   Tron address:      T + 33 base58 chars
 *   Ethereum tx hash:  0x + 64 hex
 *   Tron tx hash:      64 hex, no 0x prefix
 *
 * Returns null when the input doesn't match any known format (partial input,
 * typos) — callers keep the current manual selection in that case.
 */

export type DetectedChain = "Ethereum" | "Tron";

const BASE58 = "[1-9A-HJ-NP-Za-km-z]";

export function detectChainFromAddress(input: string): DetectedChain | null {
  const s = input.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return "Ethereum";
  if (new RegExp(`^T${BASE58}{33}$`).test(s)) return "Tron";
  return null;
}

export function detectChainFromTxId(input: string): DetectedChain | null {
  const s = input.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return "Ethereum";
  if (/^[0-9a-fA-F]{64}$/.test(s)) return "Tron";
  return null;
}
