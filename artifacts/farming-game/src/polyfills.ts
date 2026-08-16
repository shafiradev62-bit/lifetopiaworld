/**
 * Browser polyfills — loaded before main.tsx
 * Handles Node.js globals needed by @solana/web3.js and other packages.
 */

import { Buffer } from "buffer";
import { installEd25519CryptoShimIfNeeded } from "./game/ed25519CryptoShim";

// Ensure globalThis globals exist before any module code runs
if (typeof globalThis.global === "undefined") {
  (globalThis as any).global = globalThis;
}
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

// WDK's Solana module derives keys through WebCrypto Ed25519. Some webviews
// (embedded shells, older Android WebViews) lack it, which would break the
// self-custodial wallet at connect time. The shim only installs when needed
// and completes long before any wallet interaction.
void installEd25519CryptoShimIfNeeded().catch(() => {
  /* native WebCrypto stays untouched on failure */
});

export {};
