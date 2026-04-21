/**
 * LFG Treasury — mint & burn LFG tokens from a treasury wallet.
 * Treasury keypair must be set via VITE_LFG_TREASURY_KEY (base58).
 */

import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMintToInstruction,
  createBurnInstruction,
  mintTo,
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";

import { SOLANA_RPC, TOKEN_MINT } from "./solanaToken";

export const treasuryConnection = new Connection(SOLANA_RPC, {
  commitment: "confirmed",
});

/** Load treasury keypair from env. Returns null if not configured. */
export function getTreasuryKeypair(): Keypair | null {
  const raw = import.meta.env?.VITE_LFG_TREASURY_KEY;
  if (!raw) return null;
  try {
    const bytes = Uint8Array.from(JSON.parse(raw));
    return Keypair.fromSeed(bytes.slice(0, 32));
  } catch {
    try {
      // Try base58 decode
      const bs58 = require("bs58");
      const bytes = bs58.decode(raw);
      return Keypair.fromSeed(bytes.slice(0, 32));
    } catch {
      return null;
    }
  }
}

const TREASURY_MINT_AUTH = 10_000_000_000; // 10B default mint auth (big enough)

/**
 * Mint `amount` LFG tokens from treasury to player's wallet.
 * Handles ATA creation automatically.
 */
export async function mintToWallet(
  toWallet: string,
  amount: number,
  decimals = 9,
): Promise<{ success: boolean; txid?: string; error?: string }> {
  const treasury = getTreasuryKeypair();
  if (!treasury) return { success: false, error: "Treasury not configured" };

  try {
    const mintPubkey = new PublicKey(TOKEN_MINT);
    const toPubkey = new PublicKey(toWallet);
    const treasuryPubkey = treasury.publicKey;

    const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);
    const treasuryAta = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey);

    const tx = new Transaction();

    // Ensure treasury ATA exists (for mint check)
    const treasuryAtaInfo = await treasuryConnection.getAccountInfo(treasuryAta);
    if (!treasuryAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          treasuryPubkey,
          treasuryAta,
          treasuryPubkey,
          mintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Ensure recipient ATA exists
    const toAtaInfo = await treasuryConnection.getAccountInfo(toAta);
    if (!toAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          treasuryPubkey,
          toAta,
          toPubkey,
          mintPubkey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Mint to recipient
    const amountRaw = BigInt(Math.round(amount * 10 ** decimals));
    tx.add(createMintToInstruction(mintPubkey, toAta, treasuryPubkey, amountRaw, [], TOKEN_PROGRAM_ID));

    const { blockhash, lastValidBlockHeight } =
      await treasuryConnection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = treasuryPubkey;

    const signature = await treasuryConnection.sendTransaction(tx, [treasury], {
      skipPreflight: true,
    });

    await treasuryConnection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    console.log(`[LFG Treasury] Minted ${amount} LFG to ${toWallet} — tx: ${signature}`);
    return { success: true, txid: signature };
  } catch (e: any) {
    console.error("[LFG Treasury] Mint failed:", e);
    return { success: false, error: e.message || "Mint failed" };
  }
}

/**
 * Burn `amount` LFG tokens FROM player's wallet (requires player signature).
 * Player must sign the burn tx with their own wallet.
 */
export async function burnFromWallet(
  playerWallet: PublicKey,
  playerSigner: any,
  amount: number,
  decimals = 9,
): Promise<{ success: boolean; txid?: string; error?: string }> {
  try {
    const mintPubkey = new PublicKey(TOKEN_MINT);
    const playerAta = await getAssociatedTokenAddress(mintPubkey, playerWallet);

    const ataInfo = await treasuryConnection.getAccountInfo(playerAta);
    if (!ataInfo) return { success: false, error: "Player ATA not found" };

    const tx = new Transaction();
    const amountRaw = BigInt(Math.round(amount * 10 ** decimals));
    tx.add(createBurnInstruction(playerAta, mintPubkey, playerWallet, amountRaw, [], TOKEN_PROGRAM_ID));

    const { blockhash, lastValidBlockHeight } =
      await treasuryConnection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = playerWallet;

    let signature: string;
    if (typeof playerSigner.signTransaction === "function") {
      const signed = await playerSigner.signTransaction(tx);
      signature = await treasuryConnection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
      });
    } else if (typeof playerSigner.signAndSendTransaction === "function") {
      const result = await playerSigner.signAndSendTransaction(tx);
      signature = result.signature;
    } else {
      return { success: false, error: "Wallet does not support signing" };
    }

    await treasuryConnection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    console.log(`[LFG Treasury] Burned ${amount} LFG from ${playerWallet.toBase58()} — tx: ${signature}`);
    return { success: true, txid: signature };
  } catch (e: any) {
    console.error("[LFG Treasury] Burn failed:", e);
    return { success: false, error: e.message || "Burn failed" };
  }
}
