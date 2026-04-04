import { supabase } from "./supabase";

export type WalletAuthProof = {
  address: string;
  chain: "solana" | "evm";
  message: string;
  signature: string;
  issuedAt: number;
};

const NONCE_KEY = "wallet_auth_nonce";

function buildLoginMessage(address: string, nonce: string): string {
  const domain =
    typeof window !== "undefined" ? window.location.host : "lifetopia.io";
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://lifetopia.io";
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

/**
 * Convert Uint8Array to base64 string — works in all browsers.
 */
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

/**
 * Phantom / Solana-compatible signMessage (SIWS Trigger).
 *
 * Phantom v2 returns: { signature: Uint8Array, publicKey?: Uint8Array }
 * Some older versions return: { signature: string (base64) }
 * Solflare / Backpack may return the raw Uint8Array directly.
 *
 * We handle all formats to maximize compatibility.
 */
export async function signSolanaLogin(
  sol: any,
  address: string,
): Promise<WalletAuthProof> {
  const nonce =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  sessionStorage.setItem(NONCE_KEY, nonce);

  const message = buildLoginMessage(address, nonce);
  const enc = new TextEncoder();
  const messageBytes = enc.encode(message);

  let signature: string;

  if (typeof sol.signMessage !== "function") {
    throw new Error("Wallet does not support signMessage");
  }

  try {
    const out = await sol.signMessage(messageBytes, "utf8");
    console.log("[WalletHandshake] signMessage raw output type:", typeof out, Object.keys(out || {}));

    if (!out) throw new Error("Empty signature response from wallet");

    if (typeof out.signature === "string") {
      // Already base64 string (some wallet versions)
      signature = out.signature;
    } else if (out.signature instanceof Uint8Array) {
      // Phantom v2 format: { signature: Uint8Array }
      signature = uint8ArrayToBase64(out.signature);
    } else if (out instanceof Uint8Array) {
      // Direct Uint8Array return (some wallet versions)
      signature = uint8ArrayToBase64(out);
    } else {
      throw new Error(`Unknown signMessage response format: ${JSON.stringify(Object.keys(out || {}))}`);
    }
  } catch (err: any) {
    // Fallback: try without display param (some older wallets)
    console.warn("[WalletHandshake] signMessage failed with display param, retrying:", err.message);
    const out = await sol.signMessage(messageBytes);
    if (out?.signature instanceof Uint8Array) {
      signature = uint8ArrayToBase64(out.signature);
    } else if (typeof out?.signature === "string") {
      signature = out.signature;
    } else {
      throw new Error("signMessage did not return a valid signature");
    }
  }

  if (!signature) {
    throw new Error("Failed to extract signature from wallet response");
  }

  console.log("[WalletHandshake] Signature obtained, length:", signature.length);

  // Upsert to players table immediately
  await upsertPlayerToSupabase(address);

  return {
    address,
    chain: "solana",
    message,
    signature,
    issuedAt: Date.now(),
  };
}

/** Atomic upsert to Supabase players table */
export async function upsertPlayerToSupabase(walletAddress: string) {
  try {
    const { error } = await supabase
      .from("players")
      .upsert(
        {
          wallet_address: walletAddress,
          last_login: new Date().toISOString(),
        },
        { onConflict: "wallet_address" },
      );
    if (error) console.error("[Supabase] Upsert player error:", error);
  } catch (e) {
    console.error("[Supabase] Upsert failed:", e);
  }
}

/** MetaMask / eth_signTypedData or personal_sign */
export async function signEvmLogin(
  provider: any,
  address: string,
): Promise<WalletAuthProof> {
  const nonce =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  sessionStorage.setItem(NONCE_KEY, nonce);

  const message = buildLoginMessage(address, nonce);
  const sig = await provider.request({
    method: "personal_sign",
    params: [message, address],
  });

  return {
    address,
    chain: "evm",
    message,
    signature: sig as string,
    issuedAt: Date.now(),
  };
}

/**
 * Bind proof to Supabase: calls Edge Function `wallet-verify` if deployed.
 * Without backend, stores proof locally (auth.uid still anon — upgrade path).
 */
export async function verifyWalletWithSupabase(
  proof: WalletAuthProof,
): Promise<{ mode: "session" | "local"; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("wallet-verify", {
      body: proof,
    });
    if (!error && data?.access_token) {
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? "",
      });
      return { mode: "session" };
    }
  } catch {
    /* no edge function */
  }
  try {
    localStorage.setItem("wallet_auth_proof", JSON.stringify(proof));
  } catch {
    /* storage blocked */
  }
  return { mode: "local", error: "wallet-verify not configured" };
}
