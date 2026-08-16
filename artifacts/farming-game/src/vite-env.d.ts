/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public https:// URL of this game for Phantom/Solflare in-app browser (required for Capacitor / http dev). */
  readonly VITE_WALLET_DAPP_URL?: string;
  /** Preferred: one devnet mint for LFG + utility / boost verification. */
  readonly VITE_LIFETOPIA_ALPHA_MINT?: string;
  readonly VITE_TOKEN_MINT_ADDRESS?: string;
  readonly VITE_ALPHA_NFT_MINT?: string;
  readonly VITE_DEVNET_TOKEN_MINT?: string;
  readonly VITE_SOLANA_DEVNET_RPC?: string;
  readonly VITE_LFG_TREASURY_KEY?: string;
  readonly VITE_ALCHEMY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
