/**
 * Block-explorer deep links per chain. Client-safe.
 */

export function explorerTxUrl(chain: string, txId: string): string {
  if (chain === "Tron") return `https://tronscan.org/#/transaction/${txId}`;
  return `https://etherscan.io/tx/${txId}`;
}

export function explorerAddressUrl(chain: string, address: string): string {
  if (chain === "Tron") return `https://tronscan.org/#/address/${address}`;
  return `https://etherscan.io/address/${address}`;
}
