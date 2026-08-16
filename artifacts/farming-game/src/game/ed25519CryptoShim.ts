/**
 * WebCrypto Ed25519 shim.
 *
 * WDK's Solana module derives its signing key through the standard WebCrypto
 * API (`crypto.subtle.importKey("pkcs8", …, "Ed25519")`). A few embedded
 * webviews and shells (some Electron builds, older Android WebViews) ship a
 * WebCrypto implementation without Ed25519, which would make the
 * self-custodial wallet fail to connect. This module detects that case and
 * installs a minimal Ed25519 implementation backed by noble-ed25519 (pure
 * JS, same primitive WDK's Solana stack uses), leaving native WebCrypto
 * untouched everywhere else.
 */

import {
  sign as edSign,
  verify as edVerify,
  getPublicKey as edGetPublicKey,
  hashes,
} from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

hashes.sha512 = sha512;

const ED25519_NAME = "Ed25519";

/** Standard Ed25519 PKCS#8 header (16 bytes) + 32-byte private seed. */
const PKCS8_HEADER = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

/** Standard Ed25519 SPKI header (12 bytes) + 32-byte public key. */
const SPKI_HEADER = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65,
  0x70, 0x03, 0x21, 0x00,
]);

/** A CryptoKey-compatible handle produced by the shim. */
export interface ShimCryptoKey extends CryptoKey {
  /** 32-byte Ed25519 private seed (private keys only). */
  shimSeed?: Uint8Array;
  /** 32-byte Ed25519 public key. */
  shimPublicKey: Uint8Array;
}

function b64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlDecode(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function isEd25519Algorithm(algorithm: AlgorithmIdentifier | undefined | null): boolean {
  if (!algorithm) return false;
  return typeof algorithm === "string"
    ? algorithm === ED25519_NAME
    : algorithm.name === ED25519_NAME;
}

function makeKey(
  type: "private" | "public",
  seed: Uint8Array | undefined,
  publicKey: Uint8Array,
  extractable: boolean,
  usages: KeyUsage[],
): ShimCryptoKey {
  const key = {
    type,
    extractable,
    algorithm: Object.freeze({ name: ED25519_NAME }),
    usages: usages.slice(),
    shimSeed: seed ? seed.slice() : undefined,
    shimPublicKey: publicKey.slice(),
  } as ShimCryptoKey;
  return key;
}

function toUint8Array(input: BufferSource): Uint8Array {
  if (input instanceof Uint8Array) return input;
  // `instanceof` checks fail across module realms (e.g. an ArrayBuffer created
  // by an externalized dependency inside a vitest VM context), so detect
  // buffers and views by shape instead of by constructor identity.
  const candidate = input as { byteLength?: number; buffer?: unknown };
  if (typeof candidate.byteLength === "number") {
    if (candidate.buffer && typeof (candidate.buffer as ArrayBuffer).byteLength === "number") {
      const view = input as ArrayBufferView;
      return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
    return new Uint8Array(input as ArrayBuffer);
  }
  return new Uint8Array(input as ArrayBuffer);
}

async function shimImportKey(
  format: KeyFormat,
  keyData: BufferSource | JsonWebKey,
  algorithm: AlgorithmIdentifier,
  extractable: boolean,
  keyUsages: KeyUsage[],
): Promise<CryptoKey> {
  if (!isEd25519Algorithm(algorithm)) {
    return (nativeSubtle.importKey as (
      f: KeyFormat,
      k: BufferSource | JsonWebKey,
      a: AlgorithmIdentifier,
      e: boolean,
      u: KeyUsage[],
    ) => Promise<CryptoKey>)(format, keyData, algorithm, extractable, keyUsages);
  }

  if (format === "raw" || format === "pkcs8") {
    const bytes = toUint8Array(keyData as BufferSource);
    const seed = format === "pkcs8" ? bytes.slice(bytes.length - 32) : bytes;
    if (seed.length !== 32) {
      throw new DOMException("Invalid Ed25519 private key length.", "DataError");
    }
    const publicKey = edGetPublicKey(seed);
    return makeKey("private", seed, publicKey, extractable, keyUsages);
  }

  if (format === "jwk") {
    const jwk = keyData as JsonWebKey;
    if (jwk.kty !== "OKP" || jwk.crv !== ED25519_NAME || typeof jwk.x !== "string") {
      throw new DOMException("Invalid Ed25519 JWK.", "DataError");
    }
    const publicKey = b64UrlDecode(jwk.x);
    if (publicKey.length !== 32) {
      throw new DOMException("Invalid Ed25519 public key length.", "DataError");
    }
    if (typeof jwk.d === "string") {
      const seed = b64UrlDecode(jwk.d);
      if (seed.length !== 32) {
        throw new DOMException("Invalid Ed25519 private key length.", "DataError");
      }
      return makeKey("private", seed, publicKey, extractable, keyUsages);
    }
    return makeKey("public", undefined, publicKey, extractable, keyUsages);
  }

  throw new DOMException(
    `Unsupported key format "${format}" for Ed25519.`,
    "NotSupportedError",
  );
}

async function shimExportKey(
  format: KeyFormat,
  key: ShimCryptoKey,
): Promise<ArrayBuffer | JsonWebKey> {
  if (format === "jwk") {
    const jwk: JsonWebKey = {
      kty: "OKP",
      crv: ED25519_NAME,
      x: b64UrlEncode(key.shimPublicKey),
      ext: key.extractable,
      key_ops: key.usages.slice(),
    };
    if (key.type === "private" && key.shimSeed) {
      jwk.d = b64UrlEncode(key.shimSeed);
    }
    return jwk;
  }
  if (format === "raw") {
    if (key.type === "private" && key.shimSeed) {
      return key.shimSeed.slice().buffer as ArrayBuffer;
    }
    if (key.type === "public") {
      return key.shimPublicKey.slice().buffer as ArrayBuffer;
    }
  }
  if (format === "pkcs8" && key.type === "private" && key.shimSeed) {
    return new Uint8Array([...PKCS8_HEADER, ...key.shimSeed]).buffer as ArrayBuffer;
  }
  if (format === "spki" && key.type === "public") {
    return new Uint8Array([...SPKI_HEADER, ...key.shimPublicKey]).buffer as ArrayBuffer;
  }
  throw new DOMException(
    `Unsupported export format "${format}" for this Ed25519 key.`,
    "NotSupportedError",
  );
}

async function shimSign(
  algorithm: AlgorithmIdentifier,
  key: ShimCryptoKey,
  data: BufferSource,
): Promise<ArrayBuffer> {
  if (isEd25519Algorithm(algorithm) && key.type === "private" && key.shimSeed) {
    return edSign(toUint8Array(data), key.shimSeed).slice().buffer as ArrayBuffer;
  }
  return nativeSubtle.sign(algorithm, key as CryptoKey, data);
}

async function shimVerify(
  algorithm: AlgorithmIdentifier,
  key: ShimCryptoKey,
  signature: BufferSource,
  data: BufferSource,
): Promise<boolean> {
  if (isEd25519Algorithm(algorithm) && key.shimPublicKey) {
    return edVerify(toUint8Array(signature), toUint8Array(data), key.shimPublicKey);
  }
  return nativeSubtle.verify(algorithm, key as CryptoKey, signature, data);
}

let nativeSubtle: SubtleCrypto;

async function nativeSupportsEd25519(): Promise<boolean> {
  try {
    const key = await nativeSubtle.importKey(
      "raw",
      new Uint8Array(32),
      { name: ED25519_NAME },
      false,
      ["sign"],
    );
    if (!key) return false;
    const signature = await nativeSubtle.sign(
      { name: ED25519_NAME },
      key,
      new Uint8Array(8),
    );
    return signature.byteLength > 0;
  } catch {
    return false;
  }
}

/**
 * Installs the shim when the native WebCrypto implementation does not
 * support Ed25519. Returns true when the shim was installed.
 */
export async function installEd25519CryptoShimIfNeeded(): Promise<boolean> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return false;
  nativeSubtle = subtle;
  if (await nativeSupportsEd25519()) return false;

  // Wrap the native methods; every non-Ed25519 call passes straight through.
  subtle.importKey = shimImportKey as SubtleCrypto["importKey"];
  subtle.exportKey = shimExportKey as SubtleCrypto["exportKey"];
  subtle.sign = shimSign as SubtleCrypto["sign"];
  subtle.verify = shimVerify as SubtleCrypto["verify"];
  return true;
}

/**
 * Test helper: installs the shim unconditionally so unit tests can exercise
 * the fallback path even when the host supports native Ed25519.
 */
export async function forceInstallEd25519CryptoShim(): Promise<void> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("No WebCrypto subtle available.");
  nativeSubtle = subtle;
  subtle.importKey = shimImportKey as SubtleCrypto["importKey"];
  subtle.exportKey = shimExportKey as SubtleCrypto["exportKey"];
  subtle.sign = shimSign as SubtleCrypto["sign"];
  subtle.verify = shimVerify as SubtleCrypto["verify"];
}
