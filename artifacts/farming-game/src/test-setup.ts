/**
 * Vitest setup — runs before every test file.
 *
 * Vitest's default pool runs each test file inside a `node:vm` context, while
 * externalized builtins such as `node:crypto` hand back objects created in
 * the host realm. ethers' HMAC path therefore produces a Buffer that fails
 * the `instanceof Uint8Array` check used throughout ethers/WDK — a jsdom-only
 * test artifact. The browser app is unaffected because Vite bundles every
 * module into a single realm.
 *
 * The fix mirrors the browser: recover the realm node:crypto actually uses
 * (from a digest buffer's prototype chain) and repoint the test realm's
 * typed-array intrinsics at it, so `instanceof Uint8Array` checks hold across
 * the module boundary.
 */
import { createHmac } from "node:crypto";

const globalObj = globalThis as unknown as Record<string, unknown>;

// A Buffer produced by node:crypto — its realm is the one ethers must match.
const cryptoBuffer = createHmac("sha512", new Uint8Array(8))
  .update(new Uint8Array(8))
  .digest();

const realmBuffer = Object.getPrototypeOf(cryptoBuffer).constructor as
  | typeof Buffer
  | undefined;

// Node's Buffer extends Uint8Array; the base constructor is the realm's
// typed-array intrinsic.
const realmUint8Array = realmBuffer
  ? (Object.getPrototypeOf(realmBuffer.prototype).constructor as
      | typeof Uint8Array
      | undefined)
  : undefined;

if (realmBuffer) globalObj.Buffer = realmBuffer;
if (realmUint8Array) globalObj.Uint8Array = realmUint8Array;
