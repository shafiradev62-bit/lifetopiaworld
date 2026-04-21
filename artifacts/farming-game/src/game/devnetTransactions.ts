import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;

import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createBurnInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { LIFETOPIA_DEVNET_RPC, LIFETOPIA_ALPHA_MINT } from "./solanaConfig";

export const DEVNET_RPC = LIFETOPIA_DEVNET_RPC;

/** Same mint as `TOKEN_MINT` / Alpha utility — one address for farming + devnet hooks */
export const DEVNET_TOKEN_MINT = LIFETOPIA_ALPHA_MINT;

export const devnetConnection = new Connection(DEVNET_RPC, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60_000,
});

function getTreasuryKeypair(): Keypair | null {
  const raw = import.meta.env?.VITE_LFG_TREASURY_KEY;
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  } catch {
    return null;
  }
}

export const TREASURY_PUBKEY = "D5JpGGjKAoAPzZ3CDxtD1KM1cYLN3pX6j4uqHsLmzPD9";

/**
 * Airdrop SOL to treasury so it can pay fees.
 * Called once from browser when treasury has 0 balance.
 */
export async function fundTreasuryIfNeeded(): Promise<boolean> {
  try {
    const bal = await devnetConnection.getBalance(new PublicKey(TREASURY_PUBKEY));
    if (bal > 50_000_000) return true; // already has >0.05 SOL
    // Request airdrop
    const sig = await devnetConnection.requestAirdrop(new PublicKey(TREASURY_PUBKEY), 1_000_000_000);
    const { blockhash, lastValidBlockHeight } = await devnetConnection.getLatestBlockhash();
    await devnetConnection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
    console.log("[DevnetTx] Treasury funded:", sig);
    return true;
  } catch (e: any) {
    console.warn("[DevnetTx] Fund treasury failed:", e.message);
    return false;
  }
}

/**
 * Mint LFG to player.
 * Fee payer = treasury (if has SOL) OR player wallet (via playerProvider).
 */
export async function devnetMintToPlayer(
  playerWallet: string,
  amount: number,
  reason: string,
  playerProvider?: any,
): Promise<{ success: boolean; txid?: string; error?: string }> {
  const treasury = getTreasuryKeypair();

  try {
    const mint = new PublicKey(DEVNET_TOKEN_MINT);
    const playerPubkey = new PublicKey(playerWallet);
    const playerAta = await getAssociatedTokenAddress(mint, playerPubkey);
    const tx = new Transaction();

    if (!await devnetConnection.getAccountInfo(playerAta)) {
      tx.add(createAssociatedTokenAccountInstruction(
        treasury ? treasury.publicKey : playerPubkey,
        playerAta, playerPubkey, mint,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ));
    }

    tx.add(createMintToInstruction(
      mint, playerAta,
      treasury ? treasury.publicKey : playerPubkey,
      BigInt(Math.round(amount * 1e9)), [], TOKEN_PROGRAM_ID,
    ));

    const { blockhash, lastValidBlockHeight } = await devnetConnection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    let sig: string;

    if (treasury) {
      // Treasury signs as mint authority + fee payer
      tx.feePayer = treasury.publicKey;
      sig = await devnetConnection.sendTransaction(tx, [treasury], { skipPreflight: false });
    } else if (playerProvider) {
      // Player wallet signs (they are mint authority — only works if player IS mint authority)
      tx.feePayer = playerPubkey;
      if (typeof playerProvider.signAndSendTransaction === "function") {
        sig = (await playerProvider.signAndSendTransaction(tx)).signature;
      } else {
        const signed = await playerProvider.signTransaction(tx);
        sig = await devnetConnection.sendRawTransaction(signed.serialize());
      }
    } else {
      return { success: false, error: "No signer available. Set VITE_LFG_TREASURY_KEY in .env" };
    }

    await devnetConnection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    console.log(`[DevnetTx] ✅ Minted ${amount} LFG → ${playerWallet} | ${reason} | tx: ${sig}`);
    return { success: true, txid: sig };
  } catch (e: any) {
    console.error(`[DevnetTx] ❌ Mint failed (${reason}):`, e.message);
    return { success: false, error: e.message };
  }
}

export async function devnetBurnFromPlayer(
  playerWallet: string,
  playerProvider: any,
  amount: number,
  reason: string,
): Promise<{ success: boolean; txid?: string; error?: string }> {
  if (!playerProvider) return { success: false, error: "No wallet provider" };
  try {
    const mint = new PublicKey(DEVNET_TOKEN_MINT);
    const playerPubkey = new PublicKey(playerWallet);
    const playerAta = await getAssociatedTokenAddress(mint, playerPubkey);
    if (!await devnetConnection.getAccountInfo(playerAta))
      return { success: false, error: "Player ATA not found on devnet" };
    const tx = new Transaction();
    tx.add(createBurnInstruction(playerAta, mint, playerPubkey, BigInt(Math.round(amount * 1e9)), [], TOKEN_PROGRAM_ID));
    const { blockhash, lastValidBlockHeight } = await devnetConnection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = playerPubkey;
    let sig: string;
    if (typeof playerProvider.signAndSendTransaction === "function") {
      sig = (await playerProvider.signAndSendTransaction(tx)).signature;
    } else {
      const signed = await playerProvider.signTransaction(tx);
      sig = await devnetConnection.sendRawTransaction(signed.serialize());
    }
    await devnetConnection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    console.log(`[DevnetTx] 🔥 Burned ${amount} LFG | ${reason} | tx: ${sig}`);
    return { success: true, txid: sig };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function fetchDevnetLFGBalance(walletAddress: string): Promise<number> {
  if (!walletAddress || walletAddress.startsWith("guest")) return 0;
  try {
    const ata = await getAssociatedTokenAddress(new PublicKey(DEVNET_TOKEN_MINT), new PublicKey(walletAddress));
    return (await devnetConnection.getTokenAccountBalance(ata)).value.uiAmount ?? 0;
  } catch { return 0; }
}

export const CROP_LFG_REWARD: Record<string, number> = { wheat: 1, tomato: 2, carrot: 3, pumpkin: 5, corn: 4 };
export const FISH_LFG_REWARD: Record<string, number> = { common: 1, rare: 3, exotic: 8 };

// ─── In-game Event Hooks ────────────────────────────────────────────────────────
// These hooks fire on-chain LFG rewards/burns when game events occur.
// FarmingGame.tsx registers wallet + provider once on connect.
// GameEngine calls these directly after each event (harvest, fish, chop, etc.)

type WalletProvider = {
  signAndSendTransaction?(tx: any): Promise<{ signature: string }>;
  signTransaction?(tx: any): Promise<any>;
};

interface GameEventHooks {
  walletAddress: string;
  provider: WalletProvider;
}

let _hooks: GameEventHooks | null = null;

export function registerDevnetHooks(hooks: GameEventHooks) {
  _hooks = hooks;
  console.log("[DevnetHooks] Registered for wallet:", hooks.walletAddress);
}

export function unregisterDevnetHooks() {
  _hooks = null;
}

function fireIfReady(reason: string, amount: number): Promise<void> {
  if (!_hooks) return Promise.resolve();
  return devnetMintToPlayer(_hooks.walletAddress, amount, reason, _hooks.provider)
    .then(r => { if (r.success) console.log(`[DevnetHooks] ✅ ${reason}: +${amount} LFG`); })
    .catch(e => console.warn(`[DevnetHooks] ❌ ${reason}:`, e.message));
}

export function onHarvestCrop(cropType: string, isRare: boolean): Promise<void> {
  const amount = (CROP_LFG_REWARD[cropType] ?? 1) * (isRare ? 3 : 1);
  return fireIfReady(`harvest:${cropType}${isRare ? ":rare" : ""}`, amount);
}

export function onFishCaught(rarity: "common" | "rare" | "exotic"): Promise<void> {
  const amount = FISH_LFG_REWARD[rarity] ?? 1;
  return fireIfReady(`fish:${rarity}`, amount);
}

export function onTreeChopped(treeType: string): Promise<void> {
  return fireIfReady(`chop:${treeType}`, 2);
}

export function onQuestClaimed(questId: string, rewardLFG: number): Promise<void> {
  return fireIfReady(`quest:${questId}`, rewardLFG);
}

export function onShopPurchase(itemId: string, priceGold: number): Promise<void> {
  // Burn LFG equivalent to 50% of gold spent (prevents LFG farming via shop)
  const burnAmount = Math.round(priceGold * 0.5);
  if (!_hooks || burnAmount < 1) return Promise.resolve();
  return devnetBurnFromPlayer(_hooks.walletAddress, _hooks.provider, burnAmount, `shop:${itemId}`)
    .then(r => { if (r.success) console.log(`[DevnetHooks] 🔥 Shop burn: ${burnAmount} LFG`); })
    .catch(e => console.warn(`[DevnetHooks] ❌ Shop burn:`, e.message));
}
