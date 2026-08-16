/**
 * WDK Wallet — Tether's Wallet Development Kit (https://wdk.tether.io)
 *
 * Self-custodial wallet powered by the WDK Solana module
 * (@tetherto/wdk-wallet-solana). The BIP-39 seed phrase is generated
 * locally by WDK and never leaves the player's device (stored in browser
 * localStorage for this public-alpha demo).
 *
 * Features wired into the game:
 *   - Create / import a self-custodial Solana wallet (deterministic accounts)
 *   - Query SOL and LFG (SPL) balances through the WDK account API
 *   - Sign the wallet-auth handshake message (SIWS flow)
 *   - Transfer LFG (SPL) tokens to another address
 */

import WDK from "@tetherto/wdk";
import WalletManagerSolana from "@tetherto/wdk-wallet-solana";
import type { WalletAccountSolana } from "@tetherto/wdk-wallet-solana";
import * as bip39 from "bip39";
import { LIFETOPIA_DEVNET_RPC, LIFETOPIA_ALPHA_MINT } from "./solanaConfig";

const SEED_STORAGE_KEY = "wdk_seed_phrase";
const ADDRESS_STORAGE_KEY = "wdk_wallet_address";

let manager: WalletManagerSolana | null = null;
let account: WalletAccountSolana | null = null;
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

export async function ensureWdkAccount(): Promise<WalletAccountSolana> {
  if (account) return account;
  const seed = localStorage.getItem(SEED_STORAGE_KEY);
  if (!seed) throw new Error("No WDK seed phrase found — create a WDK wallet first.");
  if (!manager) {
    manager = new WalletManagerSolana(mnemonicToSeedBytes(seed), {
      provider: [LIFETOPIA_DEVNET_RPC],
      commitment: "confirmed",
      transactionMaxFee: 10_000_000,
      transferMaxFee: 10_000_000,
    });
  }
  account = await manager.getAccount(0);
  return account;
}

function buildAdapter(acc: WalletAccountSolana, address: string): WdkProviderAdapter {
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
    manager?.dispose();
  } catch {
    /* ignore */
  }
  account = null;
  manager = null;
  currentAddress = null;
}
