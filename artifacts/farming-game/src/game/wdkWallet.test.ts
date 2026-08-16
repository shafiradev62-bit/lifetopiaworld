import { describe, it, expect, beforeEach } from "vitest";
import {
  connectWdkWallet,
  disconnectWdkWallet,
  getWdkAddress,
  getWdkSeedPhrase,
  hasWdkSeed,
  importWdkWallet,
  ensureWdkAccount,
  getWdkAccountAt,
  getWdkVaultAddress,
  getWdkFeeRates,
  formatUsdtBalance,
  getWdkUsdtBalance,
  WDK_USDT_TRANSFER_CAP_BASE_UNITS,
  WDK_LFG_TRANSFER_CAP_BASE_UNITS,
} from "./wdkWallet";
import { DEVNET_USDT_MINT } from "./solanaConfig";

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

  it("WDK policy engine allows in-cap transfers", async () => {
    await connectWdkWallet();
    const acc = await ensureWdkAccount();
    const result = await (acc as any).simulate.transfer({
      token: DEVNET_USDT_MINT,
      recipient: "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk",
      amount: WDK_USDT_TRANSFER_CAP_BASE_UNITS - 1n,
    });
    expect(result.decision).toBe("ALLOW");
  });

  it("WDK policy engine denies zero-amount transfers", async () => {
    await connectWdkWallet();
    const acc = await ensureWdkAccount();
    const result = await (acc as any).simulate.transfer({
      token: DEVNET_USDT_MINT,
      recipient: "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk",
      amount: 0n,
    });
    expect(result.decision).toBe("DENY");
    expect(result.policy_id).toBe("lifetopia-transfer-guard");
    expect(result.matched_rule).toBe("deny-non-positive-amount");
  });

  it("WDK policy engine denies over-cap transfers per token", async () => {
    await connectWdkWallet();
    const acc = await ensureWdkAccount();
    const usdt = await (acc as any).simulate.transfer({
      token: DEVNET_USDT_MINT,
      recipient: "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk",
      amount: WDK_USDT_TRANSFER_CAP_BASE_UNITS + 1n,
    });
    expect(usdt.decision).toBe("DENY");
    expect(usdt.matched_rule).toBe("deny-over-session-cap");

    const lfg = await (acc as any).simulate.transfer({
      token: "ByrXMnACFFyvsL6d4yKFguCK8CNRJDMSWWshLejaApVu",
      recipient: "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk",
      amount: WDK_LFG_TRANSFER_CAP_BASE_UNITS + 1n,
    });
    expect(lfg.decision).toBe("DENY");
    expect(lfg.matched_rule).toBe("deny-over-session-cap");
  });

  it("derives a deterministic vault account (index 1) from the same seed", async () => {
    const { address } = await connectWdkWallet();
    const vault = await getWdkVaultAddress();
    expect(vault).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(vault).not.toBe(address);

    const again = await getWdkAccountAt(1);
    expect(await again.getAddress()).toBe(vault);
  });

  it("reports USDt balances without throwing on empty accounts", async () => {
    await connectWdkWallet();
    const balance = await getWdkUsdtBalance();
    expect(typeof balance).toBe("bigint");
    expect(balance >= 0n).toBe(true);
  });

  it("formats USDt base units as 2-decimal strings", () => {
    expect(formatUsdtBalance(0n)).toBe("0.00");
    expect(formatUsdtBalance(1_000_000n)).toBe("1.00");
    expect(formatUsdtBalance(12_345_678n)).toBe("12.35");
    expect(formatUsdtBalance(99_999_999n)).toBe("100.00");
  });

  it("fee rates degrade to null without a live RPC", async () => {
    await connectWdkWallet();
    const rates = await getWdkFeeRates();
    // The policy proxy stays functional; RPC-dependent reads may return
    // null in a sandboxed test environment, but must never throw.
    expect(rates === null || (typeof rates === "object" && "normal" in rates)).toBe(true);
  });
});
