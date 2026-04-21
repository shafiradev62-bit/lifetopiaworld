/**
 * Single source of truth: Public Alpha runs entirely on Solana Devnet.
 * One mint address drives LFG-style token ops + on-chain utility / boost checks (GDD §8).
 *
 * ⚠️  MINT ADDRESS RESMI DEVNET: ByrXMnACFFyvsL6d4yKFguCK8CNRJDMSWWshLejaApVu
 *     Semua integrasi (COIN off-chain, GOLD on-chain) harus pakai address ini.
 *     Jangan ganti tanpa update .env dan semua referensi di bawah.
 */

function envTrim(key: string): string {
  const v = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Devnet JSON-RPC (no mainnet fallback in game code). */
export const LIFETOPIA_DEVNET_RPC =
  envTrim("VITE_SOLANA_DEVNET_RPC") || "https://api.devnet.solana.com";

/**
 * ⚠️  MINT ADDRESS RESMI — jangan ganti tanpa koordinasi tim.
 * Semua integrasi devnet (COIN off-chain = GOLD on-chain) pakai address ini.
 */
export const CANONICAL_DEVNET_MINT = "ByrXMnACFFyvsL6d4yKFguCK8CNRJDMSWWshLejaApVu";

/**
 * Resolve mint: env var bisa override untuk testing lokal,
 * tapi canonical mint selalu jadi fallback terakhir.
 */
export function resolveLifetopiaAlphaMint(): string {
  return (
    envTrim("VITE_LIFETOPIA_ALPHA_MINT") ||
    CANONICAL_DEVNET_MINT
  );
}

export const LIFETOPIA_ALPHA_MINT = resolveLifetopiaAlphaMint();
