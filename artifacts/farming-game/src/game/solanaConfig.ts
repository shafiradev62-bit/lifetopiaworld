/**
 * Single source of truth: Public Alpha runs entirely on Solana Devnet.
 * One mint address drives LFG-style token ops + on-chain utility / boost checks (GDD §8).
 *
 * Official devnet mint: ByrXMnACFFyvsL6d4yKFguCK8CNRJDMSWWshLejaApVu
 * All integrations (off-chain COIN, on-chain GOLD) must use this address.
 * Do not change it without updating .env and every reference below.
 */

function envTrim(key: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Devnet JSON-RPC (no mainnet fallback in game code). */
export const LIFETOPIA_DEVNET_RPC =
  envTrim("VITE_SOLANA_DEVNET_RPC") || "https://api.devnet.solana.com";

/**
 * Official mint address — do not change without team coordination.
 * All devnet integrations (off-chain COIN = on-chain GOLD) use this address.
 */
export const CANONICAL_DEVNET_MINT = "ByrXMnACFFyvsL6d4yKFguCK8CNRJDMSWWshLejaApVu";

/**
 * Resolve mint: an env override can be used for local testing,
 * but the canonical mint is always the final fallback.
 */
export function resolveLifetopiaAlphaMint(): string {
  const envMint = envTrim("VITE_LIFETOPIA_ALPHA_MINT");
  if (envMint && envMint !== CANONICAL_DEVNET_MINT) {
    console.warn(
      "[SolanaConfig] Ignoring non-canonical VITE_LIFETOPIA_ALPHA_MINT. Using canonical devnet mint:",
      CANONICAL_DEVNET_MINT,
    );
  }
  return CANONICAL_DEVNET_MINT;
}

export const LIFETOPIA_ALPHA_MINT = resolveLifetopiaAlphaMint();
