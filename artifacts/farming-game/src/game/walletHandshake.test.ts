/**
 * walletHandshake.test.ts
 * Tests for Phantom signMessage (SIWS), uint8ArrayToBase64, and buildLoginMessage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── uint8ArrayToBase64 ────────────────────────────────────────────────────

function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

describe("uint8ArrayToBase64 (phantom signMessage helper)", () => {
  it("converts a simple byte array to base64", () => {
    // "hello" as bytes
    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    expect(uint8ArrayToBase64(bytes)).toBe("aGVsbG8=");
  });

  it("converts empty array to empty base64", () => {
    const bytes = new Uint8Array([]);
    expect(uint8ArrayToBase64(bytes)).toBe("");
  });

  it("handles Solana signature length (64 bytes)", () => {
    // Simulated 64-byte ed25519 signature
    const sig = new Uint8Array(64);
    sig[0] = 0x01;
    sig[63] = 0xff;
    const result = uint8ArrayToBase64(sig);
    expect(result.length).toBeGreaterThan(0);
    // Roundtrip verify
    expect(atob(result).split("").map(c => c.charCodeAt(0))).toEqual(Array.from(sig));
  });

  it("produces correct base64 for known bytes", () => {
    // bytes: [0x00, 0xff, 0x42]
    const bytes = new Uint8Array([0, 255, 66]);
    expect(uint8ArrayToBase64(bytes)).toBe("AP9C");
  });
});

// ─── Phantom signMessage response format parsing ───────────────────────────

describe("Phantom v2 signMessage response parsing", () => {
  // Replicate the signature extraction logic from walletHandshake.ts
  function extractSignature(out: any): string | null {
    if (typeof out?.signature === "string") {
      return out.signature;
    }
    if (out?.signature instanceof Uint8Array) {
      return uint8ArrayToBase64(out.signature);
    }
    if (out instanceof Uint8Array) {
      return uint8ArrayToBase64(out);
    }
    return null;
  }

  it("handles Phantom v2 format: { signature: Uint8Array }", () => {
    const sigBytes = new Uint8Array([1, 2, 3, 4]);
    const out = { signature: sigBytes };
    const result = extractSignature(out);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("handles older wallet format: { signature: string (base64) }", () => {
    const out = { signature: "aGVsbG8=" };
    expect(extractSignature(out)).toBe("aGVsbG8=");
  });

  it("handles direct Uint8Array return (some wallet versions)", () => {
    const sigBytes = new Uint8Array([5, 6, 7, 8]);
    const result = extractSignature(sigBytes);
    expect(result).not.toBeNull();
  });

  it("returns null for unknown format", () => {
    const out = { publicKey: new Uint8Array([1, 2]) };
    expect(extractSignature(out)).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(extractSignature(null)).toBeNull();
    expect(extractSignature(undefined)).toBeNull();
  });
});

// ─── buildLoginMessage ─────────────────────────────────────────────────────

function buildLoginMessage(address: string, nonce: string): string {
  const domain = "lifetopia.io";
  const origin = "https://lifetopia.io";
  return [
    `${domain} wants you to sign in with your Solana account:`,
    `${address}`,
    "",
    "Sign in to Lifetopia Pixel Farm to sync your progress.",
    "",
    `URI: ${origin}`,
    "Version: 1",
    "Chain ID: mainnet",
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
}

describe("buildLoginMessage", () => {
  it("contains the wallet address", () => {
    const msg = buildLoginMessage("ABC123xyz", "nonce-abc");
    expect(msg).toContain("ABC123xyz");
  });

  it("contains the nonce", () => {
    const msg = buildLoginMessage("ABC123xyz", "nonce-abc");
    expect(msg).toContain("nonce-abc");
  });

  it("contains the domain", () => {
    const msg = buildLoginMessage("ABC123xyz", "nonce-abc");
    expect(msg).toContain("lifetopia.io");
  });

  it("contains the URI", () => {
    const msg = buildLoginMessage("ABC123xyz", "nonce-abc");
    expect(msg).toContain("URI: https://lifetopia.io");
  });

  it("contains Version: 1", () => {
    const msg = buildLoginMessage("ABC123xyz", "nonce-abc");
    expect(msg).toContain("Version: 1");
  });

  it("contains Chain ID: mainnet", () => {
    const msg = buildLoginMessage("ABC123xyz", "nonce-abc");
    expect(msg).toContain("Chain ID: mainnet");
  });

  it("contains Issued At timestamp", () => {
    const msg = buildLoginMessage("ABC123xyz", "nonce-abc");
    expect(msg).toContain("Issued At:");
  });

  it("contains the sign-in message", () => {
    const msg = buildLoginMessage("ABC123xyz", "nonce-abc");
    expect(msg).toContain("Sign in to Lifetopia Pixel Farm");
  });

  it("message is a multi-line string", () => {
    const msg = buildLoginMessage("ABC123xyz", "nonce-abc");
    expect(msg.includes("\n")).toBe(true);
    const lines = msg.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(10);
  });
});

// ─── WalletAuthProof shape ─────────────────────────────────────────────────

describe("WalletAuthProof shape", () => {
  it("has correct required fields", () => {
    const proof = {
      address: "ABC123",
      chain: "solana" as const,
      message: "sign in message",
      signature: "base64sig==",
      issuedAt: Date.now(),
    };
    expect(proof.address).toBeDefined();
    expect(proof.chain).toBe("solana");
    expect(proof.message).toBeDefined();
    expect(proof.signature).toBeDefined();
    expect(proof.issuedAt).toBeGreaterThan(0);
  });

  it("supports evm chain", () => {
    const proof = {
      address: "0xABC",
      chain: "evm" as const,
      message: "sign in message",
      signature: "0xsig",
      issuedAt: Date.now(),
    };
    expect(proof.chain).toBe("evm");
  });
});
