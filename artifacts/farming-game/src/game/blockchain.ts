/**
 * Blockchain Utilities — JSON-RPC based (no npm packages needed)
 *
 * Pure fetch-based RPC calls for:
 *   - Utility mint / "Alpha" holdings (same mint as LFG on devnet)
 *   - Token balance (delegates to solanaToken)
 */

import { fetchTokenBalanceByRPC } from "./solanaToken";
import { LIFETOPIA_DEVNET_RPC, LIFETOPIA_ALPHA_MINT } from "./solanaConfig";

// ─── Configuration ───────────────────────────────────────────────────────────

export const BLOCKCHAIN_CONFIG = {
  /** Same as LFG / utility mint — devnet only */
  TOKEN_MINT: LIFETOPIA_ALPHA_MINT,
  SOLANA_DEVNET_RPC: LIFETOPIA_DEVNET_RPC,
  ALPHA_NFT_MINT: LIFETOPIA_ALPHA_MINT,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TokenBalanceRPCResponse {
  jsonrpc: string;
  id: string;
  result?: {
    value: Array<{
      account: {
        data: {
          parsed: {
            info: {
              tokenAmount: {
                uiAmount: number | null;
                amount: string;
                decimals: number;
              };
            };
          };
        };
      };
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

function hasPositiveTokenHoldings(data: unknown): boolean {
  const accounts = (data as { result?: { value?: unknown[] } })?.result?.value;
  if (!Array.isArray(accounts) || accounts.length === 0) return false;
  for (const acct of accounts) {
    const ta = (acct as { account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null; amount?: string } } } } } })
      ?.account?.data?.parsed?.info?.tokenAmount;
    if (!ta) continue;
    const raw = BigInt(String(ta.amount ?? "0"));
    const ui = ta.uiAmount;
    if (raw > 0n) return true;
    if (typeof ui === "number" && ui > 0) return true;
  }
  return false;
}

// ─── NFT / utility mint check ────────────────────────────────────────────────

/**
 * True if the wallet holds a positive balance of the unified Alpha / LFG mint on Devnet.
 * Public Alpha: one mint for token + lightweight on-chain utility (GDD §8).
 */
export async function CheckNFTOwnership(walletAddress: string): Promise<boolean> {
  if (!walletAddress) return false;

  const mint = LIFETOPIA_ALPHA_MINT;

  try {
    const tokenBody = {
      jsonrpc: "2.0",
      id: "alpha-utility-check",
      method: "getTokenAccountsByOwner",
      params: [walletAddress, { mint }, { encoding: "jsonParsed" }],
    };

    const res = await fetch(LIFETOPIA_DEVNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody),
    });

    if (!res.ok) {
      console.warn("[Blockchain] Devnet RPC not reachable:", res.status);
      return false;
    }

    const data = await res.json();

    if (hasPositiveTokenHoldings(data)) {
      console.log("[Blockchain] Alpha / LFG mint held for", walletAddress.slice(0, 8) + "…");
      return true;
    }

    console.log("[Blockchain] No mint balance for", walletAddress.slice(0, 8) + "…");
    return false;
  } catch (err) {
    console.error("[Blockchain] CheckNFTOwnership error:", err);
    return false;
  }
}

/** Legacy alias — used in FarmingGame.tsx */
export const checkSolanaNFT = CheckNFTOwnership;

// ─── Token Balance ────────────────────────────────────────────────────────────

/**
 * Fetches LFG token balance using pure JSON-RPC (no npm packages needed).
 * Delegates to solanaToken.ts fetchTokenBalanceByRPC for the actual RPC call.
 */
export async function fetchTokenBalance(walletAddress: string): Promise<number> {
  if (!walletAddress || walletAddress.length < 32) return 0;
  return fetchTokenBalanceByRPC(walletAddress);
}
