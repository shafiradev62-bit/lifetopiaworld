/**
 * Browser polyfills — loaded before main.tsx
 * Handles Node.js globals needed by @solana/web3.js and other packages.
 */

import { Buffer } from "buffer";

// Ensure globalThis globals exist before any module code runs
if (typeof globalThis.global === "undefined") {
  (globalThis as any).global = globalThis;
}
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

export {};
