import { LIFETOPIA_ALPHA_MINT } from "./solanaConfig";

/**
 * Global farming modifiers (NFT utility). Synced onto GameState for saves/UI.
 * Same mint as on-chain LFG / Alpha utility (devnet).
 */
export const ALPHA_NFT_MINT = LIFETOPIA_ALPHA_MINT;

export function getDefaultFarmingSpeedMultiplier(): number {
  return 1;
}

/** NFT Alpha: 0.8 = 20% faster grow duration. */
export function computeFarmingMultiplier(hasAlphaNFT: boolean): number {
  return hasAlphaNFT ? 0.8 : 1;
}

export function applyNFTBoostsToState(
  hasAlphaNFT: boolean,
): { farmingSpeedMultiplier: number; nftBoostActive: boolean } {
  return {
    farmingSpeedMultiplier: computeFarmingMultiplier(hasAlphaNFT),
    nftBoostActive: hasAlphaNFT,
  };
}
