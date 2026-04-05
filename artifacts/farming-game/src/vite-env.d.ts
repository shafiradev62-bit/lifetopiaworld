/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public https:// URL of this game for Phantom/Solflare in-app browser (required for Capacitor / http dev). */
  readonly VITE_WALLET_DAPP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
