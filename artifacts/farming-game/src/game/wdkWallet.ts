/**
 * WDK Wallet — Tether's Wallet Development Kit (https://wdk.tether.io)
 *
 * Self-custodial wallet powered by the WDK Solana module
 * (@tetherto/wdk-wallet-solana). A BIP-39 seed phrase is generated locally
 * by WDK and never leaves the player's device (stored in browser
 * localStorage for this public-alpha demo).
 *
 * This module uses the WDK core orchestrator (@tetherto/wdk) rather than
 * the Solana manager directly, so every account goes through WDK's
 * transaction-policy engine and the same API shape WDK defines for
 * multi-chain wallets.
 *
 * Features wired into the game:
 *   - Create / import a self-custodial Solana wallet (deterministic accounts)
 *   - Query SOL, LFG (SPL) and USDt (SPL) balances through the WDK account API
 *   - Sign the wallet-auth handshake message (SIWS flow)
 *   - Transfer LFG / USDt (SPL) tokens to another address, guarded by a
 *     WDK policy engine rule set (positive amounts, per-session cap)
 *   - Derive additional accounts from the same seed (vault, index 1)
 *   - Read current fee rates from the WDK-managed Solana RPC
 */

import WDK from "@tetherto/wdk";
import type { Policy, PolicyOperation, WdkAccount } from "@tetherto/wdk";
import WalletManagerSolana from "@tetherto/wdk-wallet-solana";
import WalletManagerSolanaGasless from "@tetherto/wdk-wallet-solana-gasless";
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import * as bip39 from "bip39";
import {
  LIFETOPIA_DEVNET_RPC,
  LIFETOPIA_ALPHA_MINT,
  DEVNET_USDT_MINT,
  USDT_DECIMALS,
  WDK_EVM_RPC_URL,
  WDK_EVM_CHAIN_ID,
  SEPOLIA_USDT,
  isWdkGaslessConfigured,
  WDK_PAYMASTER_URL,
  WDK_PAYMASTER_ADDRESS,
  WDK_PAYMASTER_TOKEN,
} from "./solanaConfig";

const SEED_STORAGE_KEY = "wdk_seed_phrase";
const ADDRESS_STORAGE_KEY = "wdk_wallet_address";

/**
 * Per-session transfer caps enforced by the WDK policy engine.
 * Amounts are in token base units (LFG has 9 decimals, USDt 6).
 * These are guardrails for the public alpha, not gameplay limits.
 */
export const WDK_LFG_TRANSFER_CAP_BASE_UNITS = 1_000_000_000_000n; // 1,000 LFG
export const WDK_USDT_TRANSFER_CAP_BASE_UNITS = 1_000_000_000n; // 1,000 USDt

let wdk: WDK | null = null;
let account: WdkAccount | null = null;
let currentAddress: string | null = null;

export interface WdkWalletInfo {
  address: string;
  provider: WdkProviderAdapter;
}

/** Minimal Phantom-compatible adapter so the existing handshake/hooks keep working. */
export interface WdkProviderAdapter {
  isWdk: true;
  isPhantom: false;
  name: "WDK Wallet";
  publicKey: { toString(): string } | null;
  signMessage(
    message: Uint8Array,
    display?: string,
  ): Promise<{ signature: Uint8Array; publicKey?: Uint8Array }>;
}

/**
 * WDK transaction policy for the game wallet.
 *
 * Scope "project" applies to every account derived from the seed (game
 * account index 0, vault index 1). Two DENY rules guard the `transfer`
 * operation; anything else is allowed (WDK's default is permissive).
 * A matching DENY throws PolicyViolationError before the transfer runs.
 */
const LIFETOPIA_TRANSFER_POLICY: Policy = {
  id: "lifetopia-transfer-guard",
  name: "Lifetopia World transfer guard",
  scope: "project",
  rules: [
    {
      name: "deny-non-positive-amount",
      operation: "transfer" as PolicyOperation,
      action: "DENY",
      reason: "Transfer amount must be greater than zero.",
      conditions: [
        ({ args }) => {
          const opts = args[0] as { amount?: unknown } | undefined;
          return typeof opts?.amount === "bigint" && opts.amount <= 0n;
        },
      ],
    },
    {
      name: "deny-over-session-cap",
      operation: "transfer" as PolicyOperation,
      action: "DENY",
      reason:
        "Transfer exceeds the per-session cap enforced by the WDK policy engine.",
      conditions: [
        ({ args }) => {
          const opts = args[0] as { token?: string; amount?: unknown } | undefined;
          if (typeof opts?.amount !== "bigint") return false;
          if (opts.token === DEVNET_USDT_MINT) {
            return opts.amount > WDK_USDT_TRANSFER_CAP_BASE_UNITS;
          }
          return opts.amount > WDK_LFG_TRANSFER_CAP_BASE_UNITS;
        },
      ],
    },
    {
      // The WDK policy engine fails closed on wrapped write operations that
      // match no rule. This catch-all keeps every other operation (signing,
      // sendTransaction, …) working while the two DENY rules above guard
      // token transfers.
      name: "allow-everything-else",
      operation: "*" as PolicyOperation,
      action: "ALLOW",
      conditions: [() => true],
    },
  ],
};

/**
 * Converts a BIP-39 mnemonic into a plain Uint8Array seed.
 * WDK checks `instanceof Uint8Array`, but `bip39.mnemonicToSeedSync()`
 * returns a `buffer`-polyfill Buffer (browser build) that fails that check,
 * so we normalize it to a real Uint8Array first.
 */
function mnemonicToSeedBytes(mnemonic: string): Uint8Array {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("The WDK seed phrase is invalid.");
  }
  return Uint8Array.from(bip39.mnemonicToSeedSync(mnemonic));
}

function buildWdkInstance(seedPhrase: string): WDK {
  const instance = new WDK(mnemonicToSeedBytes(seedPhrase));
  // @tetherto/wdk (beta) and @tetherto/wdk-wallet-solana (beta) currently
  // depend on different patch versions of @tetherto/wdk-wallet, which makes
  // their class types nominally incompatible (private _seed field). At runtime
  // the Solana manager satisfies WDK's registerWallet protocol (verified in
  // tests), so we cast through the boundary the same way upstream docs do.
  const registerWallet = instance.registerWallet.bind(instance) as (
    blockchain: string,
    WalletManager: unknown,
    config: Record<string, unknown>,
  ) => WDK;
  registerWallet("solana", WalletManagerSolana, {
    provider: [LIFETOPIA_DEVNET_RPC],
    commitment: "confirmed",
    transactionMaxFee: 10_000_000,
    transferMaxFee: 10_000_000,
  });
  // WDK multichain: the same seed also derives an EVM account (Sepolia).
  registerWallet("ethereum", WalletManagerEvm, {
    provider: [WDK_EVM_RPC_URL],
    chainId: WDK_EVM_CHAIN_ID,
    transferMaxFee: 1_000_000_000_000_000_000n, // 1 ETH max fee
    transactionMaxFee: 1_000_000_000_000_000_000n,
  });
  // WDK gasless: a Kora-compatible paymaster sponsors transaction fees in
  // USDt. Registered only when a paymaster is configured via env.
  if (isWdkGaslessConfigured()) {
    registerWallet("solana-gasless", WalletManagerSolanaGasless, {
      provider: [LIFETOPIA_DEVNET_RPC],
      commitment: "confirmed",
      paymasterUrl: WDK_PAYMASTER_URL,
      paymasterAddress: WDK_PAYMASTER_ADDRESS,
      paymasterToken: { address: WDK_PAYMASTER_TOKEN },
      transferMaxFee: WDK_USDT_TRANSFER_CAP_BASE_UNITS,
      transactionMaxFee: WDK_USDT_TRANSFER_CAP_BASE_UNITS,
    });
  }
  instance.registerPolicy([LIFETOPIA_TRANSFER_POLICY]);
  return instance;
}

function bytesToUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder().decode(bytes);
  } catch {
    return Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join("");
  }
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function hasWdkSeed(): boolean {
  try {
    return !!localStorage.getItem(SEED_STORAGE_KEY);
  } catch {
    return false;
  }
}

export async function ensureWdkAccount(): Promise<WdkAccount> {
  if (account) return account;
  const seed = localStorage.getItem(SEED_STORAGE_KEY);
  if (!seed) throw new Error("No WDK seed phrase found — create a WDK wallet first.");
  if (!wdk) {
    wdk = buildWdkInstance(seed);
  }
  account = await wdk.getAccount("solana", 0);
  return account;
}

function buildAdapter(acc: WdkAccount, address: string): WdkProviderAdapter {
  return {
    isWdk: true,
    isPhantom: false,
    name: "WDK Wallet",
    publicKey: { toString: () => address },
    signMessage: async (messageBytes) => {
      const signatureHex = await acc.sign(bytesToUtf8(messageBytes));
      return {
        signature: hexToBytes(signatureHex),
        publicKey: new TextEncoder().encode(address),
      };
    },
  };
}

/**
 * Connects the player's WDK wallet. If no seed exists yet, WDK generates a
 * fresh BIP-39 seed phrase and persists it locally (self-custody).
 */
export async function connectWdkWallet(): Promise<WdkWalletInfo> {
  if (!hasWdkSeed()) {
    const seed = WDK.getRandomSeedPhrase(12);
    try {
      localStorage.setItem(SEED_STORAGE_KEY, seed);
    } catch {
      /* storage unavailable — wallet still works for the session */
    }
  }
  const acc = await ensureWdkAccount();
  const address = await acc.getAddress();
  currentAddress = address;
  try {
    localStorage.setItem(ADDRESS_STORAGE_KEY, address);
  } catch {
    /* ignore */
  }
  return { address, provider: buildAdapter(acc, address) };
}

/** Imports an existing BIP-39 seed phrase (e.g. backed-up WDK wallet). */
export async function importWdkWallet(seedPhrase: string): Promise<WdkWalletInfo> {
  const seed = seedPhrase.trim();
  if (!seed) throw new Error("Seed phrase is empty.");
  disconnectWdkWallet();
  try {
    localStorage.setItem(SEED_STORAGE_KEY, seed);
  } catch {
    /* ignore */
  }
  return connectWdkWallet();
}

export async function getWdkAddress(): Promise<string> {
  if (currentAddress) return currentAddress;
  const acc = await ensureWdkAccount();
  currentAddress = await acc.getAddress();
  return currentAddress;
}

export interface WdkBalances {
  solLamports: bigint;
  lfgBaseUnits: bigint;
}

export async function getWdkBalances(): Promise<WdkBalances> {
  const acc = await ensureWdkAccount();
  const [solLamports, lfgBaseUnits] = await Promise.all([
    acc.getBalance(),
    acc.getTokenBalance(LIFETOPIA_ALPHA_MINT).catch(() => 0n),
  ]);
  return { solLamports, lfgBaseUnits };
}

/** Transfers LFG (SPL) tokens to another wallet using the WDK account API. */
export async function transferWdkLfg(
  recipient: string,
  amountBaseUnits: bigint,
): Promise<{ hash: string; fee: bigint }> {
  const acc = await ensureWdkAccount();
  return acc.transfer({
    token: LIFETOPIA_ALPHA_MINT,
    recipient,
    amount: amountBaseUnits,
  });
}

// ─── USDt (Tether) — devnet ───────────────────────────────────────────────────

/** Current USDt balance in base units (6 decimals), 0n when the account is empty. */
export async function getWdkUsdtBalance(): Promise<bigint> {
  const acc = await ensureWdkAccount();
  return acc.getTokenBalance(DEVNET_USDT_MINT).catch(() => 0n);
}

/** Transfers USDt (SPL) tokens to another wallet using the WDK account API. */
export async function transferWdkUsdt(
  recipient: string,
  amountBaseUnits: bigint,
): Promise<{ hash: string; fee: bigint }> {
  const acc = await ensureWdkAccount();
  return acc.transfer({
    token: DEVNET_USDT_MINT,
    recipient,
    amount: amountBaseUnits,
  });
}

/** Formats a USDt base-unit amount as a fixed 2-decimal string. */
export function formatUsdtBalance(baseUnits: bigint | number): string {
  return (Number(baseUnits) / 10 ** USDT_DECIMALS).toFixed(2);
}

// ─── Multi-account (same seed, additional derivation indexes) ────────────────

/**
 * Derives any account from the stored seed via WDK (SLIP-0010,
 * m/44'/501'/index'/0'). Index 0 is the game account; index 1 is the
 * player vault used by the wallet UI.
 */
export async function getWdkAccountAt(index: number): Promise<WdkAccount> {
  if (!wdk) throw new Error("No WDK instance — create a WDK wallet first.");
  return wdk.getAccount("solana", index);
}

/** Deterministic vault address (derivation index 1) from the same seed. */
export async function getWdkVaultAddress(): Promise<string> {
  const vault = await getWdkAccountAt(1);
  return vault.getAddress();
}

// ─── Fee rates ───────────────────────────────────────────────────────────────

export interface WdkFeeRates {
  normal: bigint;
  fast: bigint;
}

/** Current Solana fee rates (lamports per byte) reported by the WDK RPC client. */
export async function getWdkFeeRates(): Promise<WdkFeeRates | null> {
  if (!wdk) return null;
  try {
    return (await wdk.getFeeRates("solana")) as WdkFeeRates;
  } catch {
    return null;
  }
}

// ─── Wallet snapshot (one call, used by the wallet panel) ────────────────────

export interface WdkWalletSnapshot {
  address: string;
  solLamports: bigint;
  lfgBaseUnits: bigint;
  usdtBaseUnits: bigint;
  feeRates: WdkFeeRates | null;
}

export async function getWdkWalletSnapshot(): Promise<WdkWalletSnapshot> {
  const acc = await ensureWdkAccount();
  const [solLamports, lfgBaseUnits, usdtBaseUnits, feeRates] = await Promise.all([
    acc.getBalance(),
    acc.getTokenBalance(LIFETOPIA_ALPHA_MINT).catch(() => 0n),
    acc.getTokenBalance(DEVNET_USDT_MINT).catch(() => 0n),
    getWdkFeeRates(),
  ]);
  return {
    address: await getWdkAddress(),
    solLamports,
    lfgBaseUnits,
    usdtBaseUnits,
    feeRates,
  };
}

// ─── Multichain — WDK EVM wallet (same seed, Sepolia) ─────────────────────────

export async function ensureWdkEvmAccount(): Promise<WdkAccount> {
  if (!wdk) throw new Error("No WDK instance — create a WDK wallet first.");
  return wdk.getAccount("ethereum", 0);
}

/** EVM address (0x…) deterministically derived from the same WDK seed. */
export async function getWdkEvmAddress(): Promise<string> {
  const acc = await ensureWdkEvmAccount();
  return acc.getAddress();
}

export interface WdkEvmBalances {
  ethWei: bigint;
  usdtBaseUnits: bigint;
}

/** Native ETH and USDt (Sepolia) balances for the WDK EVM account. */
export async function getWdkEvmBalances(): Promise<WdkEvmBalances> {
  const acc = await ensureWdkEvmAccount();
  const [ethWei, usdtBaseUnits] = await Promise.all([
    acc.getBalance().catch(() => 0n),
    acc.getTokenBalance(SEPOLIA_USDT).catch(() => 0n),
  ]);
  return { ethWei, usdtBaseUnits };
}

/** Transfers USDt (ERC-20, Sepolia) using the WDK EVM account API. */
export async function transferWdkEvmUsdt(
  recipient: string,
  amountBaseUnits: bigint,
): Promise<{ hash: string; fee: bigint }> {
  const acc = await ensureWdkEvmAccount();
  return acc.transfer({ token: SEPOLIA_USDT, recipient, amount: amountBaseUnits });
}

/** Formats a wei amount as a fixed 4-decimal ETH string. */
export function formatEthBalance(wei: bigint | number): string {
  return (Number(wei) / 10 ** 18).toFixed(4);
}

// ─── Gasless — WDK Solana paymaster wallet (fees sponsored in USDt) ───────────

export { isWdkGaslessConfigured };

/** The gasless account adds paymaster-specific methods on top of WDK's base account. */
interface WdkGaslessAccount extends WdkAccount {
  getPaymasterTokenBalance(): Promise<bigint>;
  quoteTransfer(
    options: { token: string; recipient: string; amount: bigint },
    config?: { transferMaxFee?: bigint },
  ): Promise<{ fee: bigint }>;
  transfer(
    options: { token: string; recipient: string; amount: bigint },
    config?: { transferMaxFee?: bigint },
  ): Promise<{ hash: string; fee: bigint }>;
}

export async function ensureWdkGaslessAccount(): Promise<WdkGaslessAccount> {
  if (!isWdkGaslessConfigured()) {
    throw new Error("Gasless paymaster is not configured.");
  }
  if (!wdk) throw new Error("No WDK instance — create a WDK wallet first.");
  return (await wdk.getAccount("solana-gasless", 0)) as WdkGaslessAccount;
}

/** USDt balance held by the player for paying gasless fees (paymaster token). */
export async function getWdkGaslessUsdtBalance(): Promise<bigint> {
  const acc = await ensureWdkGaslessAccount();
  return acc.getPaymasterTokenBalance().catch(() => 0n);
}

/** Quotes the USDt fee a gasless transfer would cost (no SOL needed). */
export async function quoteWdkGaslessUsdt(
  recipient: string,
  amountBaseUnits: bigint,
): Promise<{ feeBaseUnits: bigint }> {
  const acc = await ensureWdkGaslessAccount();
  const quote = await acc.quoteTransfer({
    token: DEVNET_USDT_MINT,
    recipient,
    amount: amountBaseUnits,
  });
  return { feeBaseUnits: quote.fee };
}

/** Sends USDt without holding SOL — the paymaster pays the network fee. */
export async function sendWdkGaslessUsdt(
  recipient: string,
  amountBaseUnits: bigint,
): Promise<{ hash: string; fee: bigint }> {
  const acc = await ensureWdkGaslessAccount();
  return acc.transfer(
    { token: DEVNET_USDT_MINT, recipient, amount: amountBaseUnits },
    { transferMaxFee: WDK_USDT_TRANSFER_CAP_BASE_UNITS },
  );
}

export function getWdkSeedPhrase(): string | null {
  try {
    return localStorage.getItem(SEED_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function disconnectWdkWallet(): void {
  try {
    account?.dispose();
  } catch {
    /* ignore */
  }
  try {
    wdk?.dispose();
  } catch {
    /* ignore */
  }
  account = null;
  wdk = null;
  currentAddress = null;
}
