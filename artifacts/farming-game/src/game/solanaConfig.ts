/**
 * Single source of truth: Public Alpha runs entirely on Solana Devnet.
 * One mint address drives LFG-style token ops + on-chain utility / boost checks (GDD §8).
 */

function envTrim(key: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Devnet JSON-RPC (no mainnet fallback in game code). */
export const LIFETOPIA_DEVNET_RPC =
  envTrim("VITE_SOLANA_DEVNET_RPC") || "https://api.devnet.solana.com";

/**
 * Unified Alpha mint. Prefer explicit alpha, then devnet mint (common in .env), then legacy token env.
 * Priority: LIFETOPIA_ALPHA → DEVNET_TOKEN → TOKEN → ALPHA_NFT → default sample mint.
 */
export function resolveLifetopiaAlphaMint(): string {
  return (
    envTrim("VITE_LIFETOPIA_ALPHA_MINT") ||
    envTrim("VITE_DEVNET_TOKEN_MINT") ||
    envTrim("VITE_TOKEN_MINT_ADDRESS") ||
    envTrim("VITE_ALPHA_NFT_MINT") ||
    "CG8dh8s8P8y7seC3hB9QWuoBX81ug8MvfZK9s9WjaQFT"
  );
}

export const LIFETOPIA_ALPHA_MINT = resolveLifetopiaAlphaMint();
