import { describe, it, expect, beforeEach } from "vitest";
import {
  connectWdkWallet,
  disconnectWdkWallet,
  getWdkAddress,
  getWdkSeedPhrase,
  hasWdkSeed,
  importWdkWallet,
  ensureWdkAccount,
} from "./wdkWallet";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

const VALID_SEED_12 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("wdkWallet (Tether Wallet Development Kit)", () => {
  beforeEach(() => {
    store.clear();
    disconnectWdkWallet();
  });

  it("generates a BIP-39 seed phrase when none exists", async () => {
    const { address } = await connectWdkWallet();
    expect(hasWdkSeed()).toBe(true);
    const seed = getWdkSeedPhrase();
    expect(seed).toBeTruthy();
    expect(seed!.trim().split(/\s+/).length).toBe(12);
    expect(address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("derives a deterministic address from the stored seed", async () => {
    const first = await connectWdkWallet();
    const again = await getWdkAddress();
    expect(again).toBe(first.address);
    const afterReset = await getWdkAddress();
    expect(afterReset).toBe(first.address);
  });

  it("imports a known seed phrase deterministically", async () => {
    const a = await importWdkWallet(VALID_SEED_12);
    expect(hasWdkSeed()).toBe(true);
    const b = await connectWdkWallet();
    expect(b.address).toBe(a.address);
  });

  it("different seeds produce different addresses", async () => {
    const a = await importWdkWallet(VALID_SEED_12);
    disconnectWdkWallet();
    store.clear();
    const b = await connectWdkWallet();
    expect(b.address).not.toBe(a.address);
  });

  it("exposes a Phantom-compatible signMessage used by the login handshake", async () => {
    const { provider } = await connectWdkWallet();
    expect(provider.isWdk).toBe(true);
    expect(provider.isPhantom).toBe(false);
    const sig = await provider.signMessage(new TextEncoder().encode("Lifetopia World login"));
    expect(sig.signature.length).toBe(64);
    expect(provider.publicKey?.toString()).toBeTruthy();
  });

  it("account.sign returns a hex signature accepted by the handshake", async () => {
    await connectWdkWallet();
    const acc = await ensureWdkAccount();
    const hex = await acc.sign("Lifetopia World login");
    expect(hex).toMatch(/^[0-9a-fA-F]{128}$/);
  });
});
