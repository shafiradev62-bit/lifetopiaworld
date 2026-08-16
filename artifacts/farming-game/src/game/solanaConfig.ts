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

/**
 * USDt (USDT) on Solana — 6 decimals, classic SPL Token program (Tokenkeg…VQ5DA).
 *
 * Devnet uses the widely deployed test USDt mint (real supply, mintable via
 * public devnet faucets). On mainnet the game points at Tether's official
 * USDt mint — the WDK integration is mint-agnostic, so only this constant
 * changes when moving to mainnet.
 */
export const DEVNET_USDT_MINT =
  envTrim("VITE_DEVNET_USDT_MINT") || "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS";

/** Official Tether USDt mint on Solana mainnet (reference for the mainnet switch). */
export const MAINNET_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

/** USDt decimals on Solana (SPL token standard). */
export const USDT_DECIMALS = 6;

// ─── WDK multichain — EVM (Sepolia) ───────────────────────────────────────────

/** Public EVM RPC for WDK's Ethereum wallet (Sepolia). Override via env. */
export const WDK_EVM_RPC_URL =
  envTrim("VITE_EVM_RPC_URL") || "https://ethereum-sepolia.publicnode.com";

/** Chain ID for the EVM network used by the WDK wallet. */
export const WDK_EVM_CHAIN_ID = Number(envTrim("VITE_EVM_CHAIN_ID") || "11155111");

/**
 * USDt on Sepolia (ERC-20, 6 decimals) — the reference testnet USDt
 * deployment used by the WDK EVM integration.
 */
export const SEPOLIA_USDT =
  envTrim("VITE_SEPOLIA_USDT") || "0xd077a400968890eacc75cdc901f0356c943e4fdb";

// ─── WDK gasless — Solana paymaster (Kora-compatible) ─────────────────────────

/** True when a Kora-compatible paymaster is configured via env. */
export function isWdkGaslessConfigured(): boolean {
  return !!(envTrim("VITE_SOLANA_PAYMASTER_URL") && envTrim("VITE_SOLANA_PAYMASTER_ADDRESS"));
}

export const WDK_PAYMASTER_URL = envTrim("VITE_SOLANA_PAYMASTER_URL");
export const WDK_PAYMASTER_ADDRESS = envTrim("VITE_SOLANA_PAYMASTER_ADDRESS");

/** Paymaster fee token — defaults to the devnet USDt mint. */
export const WDK_PAYMASTER_TOKEN =
  envTrim("VITE_SOLANA_PAYMASTER_TOKEN") || DEVNET_USDT_MINT;
