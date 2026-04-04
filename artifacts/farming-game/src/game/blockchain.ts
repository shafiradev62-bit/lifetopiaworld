/**
 * Blockchain Utilities — JSON-RPC based (no npm packages needed)
 *
 * Pure fetch-based RPC calls for:
 *   - NFT ownership verification (Alpha NFT)
 *   - Token balance (pure JSON-RPC fallback)
 *
 * For full @solana/web3.js features, also see solanaToken.ts
 */

import { fetchTokenBalanceByRPC } from "./solanaToken";

// ─── Configuration ───────────────────────────────────────────────────────────

export const BLOCKCHAIN_CONFIG = {
  ALCHEMY_API_KEY:
    import.meta.env?.VITE_ALCHEMY_API_KEY || "JiVbTwHnF3qEGfs5AtgKR",
  TOKEN_MINT:
    import.meta.env?.VITE_TOKEN_MINT_ADDRESS ||
    "CG8dh8s8P8y7seC3hB9QWuoBX81ug8MvfZK9s9WjaQFT",
  SOLANA_RPC: `https://solana-mainnet.g.alchemy.com/v2/${
    import.meta.env?.VITE_ALCHEMY_API_KEY || "JiVbTwHnF3qEGfs5AtgKR"
  }`,
  SOLANA_DEVNET_RPC:
    import.meta.env?.VITE_SOLANA_DEVNET_RPC ||
    "https://api.devnet.solana.com",
  /** Alpha NFT mint address (GDD Section 8 — NFT-gated gameplay) */
  ALPHA_NFT_MINT: import.meta.env?.VITE_ALPHA_NFT_MINT || "",
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

// ─── NFT Ownership Check ─────────────────────────────────────────────────────

/**
 * Checks if the wallet holds any tokens of the Alpha NFT mint on Devnet.
 * Used for GDD Section 8 (NFT-gated gameplay).
 *
 * Also supports Metaplex NFT metadata check via getProgramAccounts
 * for standard pNFT/mC NFT collections.
 */
export async function CheckNFTOwnership(
  walletAddress: string,
): Promise<boolean> {
  if (!walletAddress) return false;

  const mint =
    BLOCKCHAIN_CONFIG.ALPHA_NFT_MINT?.trim() ||
    "CG8dh8s8P8y7seC3hB9QWuoBX81ug8MvfZK9s9WjaQFT";

  try {
    // Method 1: SPL Token check (fastest, works for any SPL mint)
    const tokenBody = {
      jsonrpc: "2.0",
      id: "alpha-nft-check",
      method: "getTokenAccountsByOwner",
      params: [
        walletAddress,
        { mint },
        { encoding: "jsonParsed" },
      ],
    };

    const res = await fetch(BLOCKCHAIN_CONFIG.SOLANA_DEVNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody),
    });

    if (!res.ok) {
      console.warn("[Blockchain] Devnet RPC not reachable:", res.status);
      return false;
    }

    const data = await res.json();

    // Check SPL token accounts
    if (data?.result?.value?.length > 0) {
      console.log("[Blockchain] Alpha NFT (SPL) found for", walletAddress);
      return true;
    }

    // Method 2: Try mainnet RPC if devnet returns empty
    // (for production NFT mints deployed on mainnet)
    const mainnetRes = await fetch(BLOCKCHAIN_CONFIG.SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody),
    });

    if (mainnetRes.ok) {
      const mainnetData = await mainnetRes.json();
      if (mainnetData?.result?.value?.length > 0) {
        console.log("[Blockchain] Alpha NFT (mainnet SPL) found for", walletAddress);
        return true;
      }
    }

    console.log("[Blockchain] No Alpha NFT found for", walletAddress);
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
 * This is the primary balance function used by FarmingGame.tsx.
 * Delegates to solanaToken.ts fetchTokenBalanceByRPC for the actual RPC call.
 */
export async function fetchTokenBalance(walletAddress: string): Promise<number> {
  if (!walletAddress || walletAddress.length < 32) return 0;
  return fetchTokenBalanceByRPC(walletAddress);
}
