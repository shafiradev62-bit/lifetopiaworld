import { Buffer } from "buffer";

// Must be set before any Solana/Web3 code runs
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
} else {
  // Ensure it's the real buffer package, not a fake polyfill
  globalThis.Buffer = Buffer;
}

if (typeof globalThis.global === "undefined") {
  (globalThis as any).global = globalThis;
}

export {};
