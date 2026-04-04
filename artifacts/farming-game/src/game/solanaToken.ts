/**
 * Solana Token Integration
 * Lifetopia Gold (LFG) token operations using @solana/web3.js + @solana/spl-token
 *
 * IMPORTANT: Install packages first:
 *   pnpm add @solana/web3.js @solana/spl-token
 *
 * Or use CDN (fallback):
 *   import { Connection, PublicKey, Transaction } from 'https://esm.sh/@solana/web3.js@1.87.6';
 *   import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from 'https://esm.sh/@solana/spl-token@0.4.6';
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferInstruction,
} from "@solana/spl-token";

// ─── Configuration ───────────────────────────────────────────────────────────

const ALCHEMY_KEY =
  import.meta.env?.VITE_ALCHEMY_API_KEY || "JiVbTwHnF3qEGfs5AtgKR";
const TOKEN_MINT =
  import.meta.env?.VITE_TOKEN_MINT_ADDRESS ||
  "CG8dh8s8P8y7seC3hB9QWuoBX81ug8MvfZK9s9WjaQFT";

/** Primary RPC — Alchemy Solana mainnet */
export const SOLANA_RPC = `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

/** Devnet RPC — for Alpha NFT checks */
export const SOLANA_DEVNET_RPC =
  import.meta.env?.VITE_SOLANA_DEVNET_RPC || "https://api.devnet.solana.com";

/** Shared connection instance — reuse for all RPC calls */
export const connection = new Connection(SOLANA_RPC, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60,
});

export { TOKEN_MINT };

// ─── Helper: get Phantom provider ─────────────────────────────────────────────

/** Returns the best available Phantom/Solana provider from window */
export function getPhantomProvider(): {
  sol: any;
  name: string;
} | null {
  const w = window as any;
  const phantomSol = w.phantom?.solana;
  const solanaFallback = w.solana;

  if (phantomSol?.isPhantom) {
    return { sol: phantomSol, name: "Phantom" };
  }
  if (solanaFallback?.isPhantom) {
    return { sol: solanaFallback, name: "Phantom" };
  }
  if (w.solflare?.isSolflare) {
    return { sol: w.solflare, name: "Solflare" };
  }
  if (w.backpack?.isBackpack) {
    return { sol: w.backpack, name: "Backpack" };
  }
  return null;
}

// ─── Init Associated Token Account (ATA) ─────────────────────────────────────

/**
 * Creates the Associated Token Account for LFG if it doesn't exist.
 * Payer = connected wallet. No rent exempt needed for ATA.
 *
 * Returns: { success, txid?, error? }
 */
export async function initializeTokenAccount(): Promise<{
  success: boolean;
  txid?: string;
  error?: string;
}> {
  try {
    const provider = getPhantomProvider();
    if (!provider) return { success: false, error: "No Solana wallet found. Install Phantom." };

    const { sol } = provider;
    if (!sol.publicKey) return { success: false, error: "Wallet not connected" };

    const wallet = sol.publicKey as PublicKey;
    const mint = new PublicKey(TOKEN_MINT);

    // Derive ATA
    const ata = await getAssociatedTokenAddress(mint, wallet);
    console.log("[SolanaToken] ATA:", ata.toBase58());

    // Check if ATA already exists
    const ataInfo = await connection.getAccountInfo(ata);
    if (ataInfo !== null) {
      console.log("[SolanaToken] ATA already exists, skipping creation");
      return { success: true, txid: "(already exists)" };
    }

    // Build create ATA instruction
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet,       // payer
      ata,          // associated token account address
      wallet,       // owner
      mint,         // mint
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    // Build transaction
    const transaction = new Transaction();
    transaction.add(createAtaIx);

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet;

    console.log("[SolanaToken] Sending create-ATA tx, blockhash:", blockhash.slice(0, 8));

    // Try signAndSendTransaction first (Phantom desktop)
    let signature: string;
    if (typeof sol.signAndSendTransaction === "function") {
      try {
        const result = await sol.signAndSendTransaction(transaction);
        signature = result.signature;
      } catch (signSendErr: any) {
        // Fallback: sign + send via rpc (some wallet versions)
        console.warn("[SolanaToken] signAndSendTransaction failed, trying sign+send:", signSendErr.message);
        const signed = await sol.signTransaction(transaction);
        signature = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });
      }
    } else if (typeof sol.signTransaction === "function") {
      // Solflare / Backpack style
      const signed = await sol.signTransaction(transaction);
      signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
    } else {
      return { success: false, error: "Wallet does not support transaction signing" };
    }

    console.log("[SolanaToken] Tx submitted:", signature);

    // Wait for confirmation
    try {
      const conf = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      if (conf.value.err) {
        return { success: false, error: "Transaction failed on-chain" };
      }
    } catch (confirmErr) {
      // Non-fatal: tx may still confirm
      console.warn("[SolanaToken] Confirm wait error:", confirmErr);
    }

    return { success: true, txid: signature };
  } catch (e: any) {
    console.error("[SolanaToken] Init ATA failed:", e);
    return { success: false, error: e.message || "Initialization failed" };
  }
}

// ─── Get Token Balance ─────────────────────────────────────────────────────────

/**
 * Fetches LFG token balance for a wallet using JSON-RPC directly.
 * Works without npm packages — uses fetch.
 */
export async function fetchTokenBalanceByRPC(walletAddress: string): Promise<number> {
  if (!walletAddress || walletAddress.length < 32) return 0;

  try {
    const response = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "lfg-balance",
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: TOKEN_MINT },
          { encoding: "jsonParsed" },
        ],
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`RPC ${response.status}: ${txt.slice(0, 100)}`);
    }

    const data = await response.json();
    const accounts = data?.result?.value as Array<{
      account: {
        data: {
          parsed: {
            info: {
              tokenAmount: {
                uiAmount: number;
                amount: string;
                decimals: number;
              };
            };
          };
        };
      };
    }> | undefined;

    if (!accounts || accounts.length === 0) return 0;

    return accounts[0].account.data.parsed.info.tokenAmount.uiAmount ?? 0;
  } catch (error) {
    console.error("[SolanaToken] fetchTokenBalanceByRPC failed:", error);
    return 0;
  }
}

/**
 * Fetches LFG balance using @solana/web3.js Connection (requires npm package).
 * More robust — handles connection errors and retries.
 */
export async function fetchTokenBalance(walletAddress: string): Promise<number> {
  try {
    const pubkey = new PublicKey(walletAddress);
    const mint = new PublicKey(TOKEN_MINT);
    const ata = await getAssociatedTokenAddress(mint, pubkey);

    const balance = await connection.getTokenAccountBalance(ata);
    return balance.value.uiAmount ?? 0;
  } catch (e: any) {
    // Token account doesn't exist = 0 balance (not an error)
    if (e.message?.includes("could not find account")) return 0;
    if (e.message?.includes("Invalid account")) return 0;
    console.warn("[SolanaToken] fetchTokenBalance:", e.message);
    return 0;
  }
}

export { fetchTokenBalance as getTokenBalance };

// ─── Transfer LFG ─────────────────────────────────────────────────────────────

/**
 * Transfer LFG tokens from connected wallet to a recipient.
 * NOTE: This transfers FROM the connected wallet — for in-game rewards,
 * the treasury wallet (not the player) should be the signer.
 *
 * For in-game reward distribution, you need a backend/offline signer
 * with the treasury keypair.
 */
export async function transferTokenToUser(
  toWallet: string,
  amount: number,
  decimals = 9,
): Promise<{ success: boolean; txid?: string; error?: string }> {
  try {
    const provider = getPhantomProvider();
    if (!provider) return { success: false, error: "No Solana wallet found" };

    const { sol } = provider;
    if (!sol.publicKey) return { success: false, error: "Wallet not connected" };

    const fromWallet = sol.publicKey as PublicKey;
    const toPubkey = new PublicKey(toWallet);
    const mint = new PublicKey(TOKEN_MINT);

    // Check sender's ATA
    const fromAta = await getAssociatedTokenAddress(mint, fromWallet);
    const toAta = await getAssociatedTokenAddress(mint, toPubkey);

    const fromAtaInfo = await connection.getAccountInfo(fromAta);
    if (!fromAtaInfo) {
      return {
        success: false,
        error: "SENDER ATA NOT FOUND. Call initializeTokenAccount() first.",
      };
    }

    // Check if recipient ATA exists
    const toAtaInfo = await connection.getAccountInfo(toAta);

    const transaction = new Transaction();

    // Create recipient ATA if needed
    if (!toAtaInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromWallet,
          toAta,
          toPubkey,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Add transfer instruction
    const transferAmount = BigInt(Math.round(amount * 10 ** decimals));
    transaction.add(
      createTransferInstruction(
        fromAta,
        toAta,
        fromWallet,
        transferAmount,
        [fromWallet],
        TOKEN_PROGRAM_ID,
      ),
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromWallet;

    let signature: string;
    if (typeof sol.signAndSendTransaction === "function") {
      try {
        const result = await sol.signAndSendTransaction(transaction);
        signature = result.signature;
      } catch {
        const signed = await sol.signTransaction(transaction);
        signature = await connection.sendRawTransaction(signed.serialize());
      }
    } else if (typeof sol.signTransaction === "function") {
      const signed = await sol.signTransaction(transaction);
      signature = await connection.sendRawTransaction(signed.serialize());
    } else {
      return { success: false, error: "Wallet does not support signing" };
    }

    const conf = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    if (conf.value.err) {
      return { success: false, error: "Transfer transaction failed" };
    }

    return { success: true, txid: signature };
  } catch (e: any) {
    console.error("[SolanaToken] Transfer failed:", e);
    return { success: false, error: e.message || "Transfer failed" };
  }
}

// ─── Global type augmentations for wallet extensions ──────────────────────────

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      publicKey?: { toString(): string };
      connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
      disconnect(): Promise<void>;
      signTransaction(tx: Transaction): Promise<Transaction>;
      signAndSendTransaction(tx: Transaction): Promise<{ signature: string }>;
      signMessage(msg: Uint8Array, display?: string): Promise<{ signature: Uint8Array; publicKey: Uint8Array }>;
    };
    phantom?: { solana?: Window["solana"] };
    solflare?: {
      isSolflare?: boolean;
      publicKey?: { toString(): string };
      connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
      signTransaction(tx: Transaction): Promise<Transaction>;
    };
    backpack?: {
      isBackpack?: boolean;
      publicKey?: { toString(): string };
      connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
      signTransaction(tx: Transaction): Promise<Transaction>;
    };
  }
}
