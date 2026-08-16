/**
 * Wallet transaction history — Solana JSON-RPC (getSignaturesForAddress).
 *
 * Pure fetch-based; no extra dependencies. Returns the most recent
 * confirmed signatures for a wallet so the game can show recent on-chain
 * activity (LFG rewards, USDt sends) with Solscan links.
 */

import { LIFETOPIA_DEVNET_RPC } from "./solanaConfig";

export interface WalletTx {
  /** Base58 transaction signature. */
  signature: string;
  /** Slot the transaction was confirmed in. */
  slot: number;
  /** Transaction error message, or null when the transaction succeeded. */
  err: string | null;
}

interface RpcResponse {
  result?: Array<{
    signature: string;
    slot: number;
    err: unknown;
  }>;
  error?: { message?: string };
}

function errorMessage(err: unknown): string | null {
  if (err == null) return null;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as { message?: string };
    if (typeof e.message === "string" && e.message.length > 0) return e.message;
  }
  return String(err);
}

/**
 * Fetches the most recent confirmed transactions for an address.
 * Degrades to an empty list on any RPC failure so the wallet UI never
 * blocks on explorer data.
 */
export async function fetchRecentTransactions(
  address: string,
  limit = 8,
): Promise<WalletTx[]> {
  if (!address || address.length < 32) return [];

  try {
    const response = await fetch(LIFETOPIA_DEVNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "wallet-history",
        method: "getSignaturesForAddress",
        params: [address, { limit, commitment: "confirmed" }],
      }),
    });

    if (!response.ok) return [];
    const data = (await response.json()) as RpcResponse;
    if (data.error || !Array.isArray(data.result)) return [];

    return data.result.map((item) => ({
      signature: item.signature,
      slot: item.slot,
      err: errorMessage(item.err),
    }));
  } catch {
    return [];
  }
}
