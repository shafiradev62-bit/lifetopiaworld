/**
 * MobileController.ts
 * Touch navigation + wallet deep links + Capacitor-based mobile wallet detection
 */

export type QuadrantDir = "up" | "down" | "left" | "right" | null;

export interface TouchState {
  activeDir: QuadrantDir;
  touchId: number | null;
}

/** Divide viewport into 4 transparent quadrants and return direction */
export function getTouchQuadrant(
  clientX: number,
  clientY: number,
  viewW: number,
  viewH: number,
): QuadrantDir {
  const cx = viewW / 2;
  const cy = viewH / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dead = Math.min(viewW, viewH) * 0.10;
  if (Math.abs(dx) < dead && Math.abs(dy) < dead) return null;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

/** Map quadrant direction to game key names */
export function quadrantToKeys(dir: QuadrantDir): string[] {
  if (dir === "up") return ["arrowup"];
  if (dir === "down") return ["arrowdown"];
  if (dir === "left") return ["arrowleft"];
  if (dir === "right") return ["arrowright"];
  return [];
}

/** Detect if running in a mobile browser (Capacitor or mobile web) */
export function isMobilePlatform(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).Capacitor?.isNativePlatform?.()) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** HTTPS URL Phantom/Solflare can load in in-app browser. Local / file / http breaks with "error loading page". */
export function resolveWalletBrowseUrl(override?: string): string | null {
  const fromEnv =
    typeof import.meta !== "undefined"
      ? ((import.meta as unknown as { env?: { VITE_WALLET_DAPP_URL?: string } }).env?.VITE_WALLET_DAPP_URL)
      : undefined;
  const candidates = [override, fromEnv].filter((u): u is string => typeof u === "string" && u.length > 0);
  for (const c of candidates) {
    try {
      const u = new URL(c);
      if (u.protocol === "https:") return u.toString();
    } catch { /* ignore */ }
  }
  if (typeof window === "undefined") return null;
  try {
    const u = new URL(window.location.href);
    if (u.protocol === "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
      return window.location.href;
    }
  } catch { /* ignore */ }
  return null;
}

/** Open wallet app via native deep link. */
export function openWalletDeepLink(walletType: "phantom" | "solflare" | "backpack" | "metamask" | "trust", dappUrl?: string): boolean {
  const httpsUrl = resolveWalletBrowseUrl(dappUrl);
  const deeplink = buildWalletDeeplink(walletType, httpsUrl);

  console.log(`[MobileController] ${walletType} deep link: ${deeplink}`);
  console.log(`[MobileController] dappUrl resolved: ${httpsUrl ?? "null (using fallback)"}`);

  // Set a flag so on return we know what wallet to look for
  sessionStorage.setItem("pending_wallet_type", walletType);
  sessionStorage.setItem("_leaving_for_wallet", String(Date.now()));

  // Check if we're in a native Capacitor app
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  
  if (isNative) {
    // Native Capacitor: use window.location.href to trigger intent
    // Phantom Universal Link works on Android via intent
    window.location.href = deeplink;
    return true;
  }

  // Mobile web browser
  if (walletType === "phantom") {
    // Try phantom:// scheme first (installed app), fallback to universal link
    const phantomScheme = `phantom://ul/v1/connect?app_url=${encodeURIComponent(httpsUrl || "https://lifetopia.io")}&redirect_link=${encodeURIComponent(window.location.origin + "/?callback=phantom")}&cluster=mainnet-beta`;
    window.location.href = phantomScheme;
    return true;
  }
  if (walletType === "solflare" && httpsUrl) {
    window.location.href = `https://solflare.com/ul/v1/connect?app_url=${encodeURIComponent(httpsUrl)}&redirect_link=${encodeURIComponent(window.location.origin + "/?callback=solflare")}&cluster=mainnet-beta`;
    return true;
  }
  // Generic fallback
  window.location.href = deeplink;
  return true;
}

/** Restart the game RAF loop after app returns from background/wallet deep link. */
/** Call this from FarmingGame.tsx useEffect to ensure game loop never stops permanently. */
export function setupVisibilityRestart(onRestart: () => void): () => void {
  let suspended = false;

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      console.log(`[Visibility] App resumed — RAF will auto-restart via React useEffect`);
      // The React useEffect dependency array (loaded, splashDone, introTutorialDone)
      // will naturally restart the loop when component re-renders after resume.
      // We just need to ensure it doesn't stay cancelled.
      if (suspended) {
        suspended = false;
        console.log(`[Visibility] Loop restart triggered after wallet resume`);
        onRestart();
      }
    } else {
      console.log(`[Visibility] App backgrounded — RAF may pause`);
      suspended = true;
    }
  };

  const handleResume = () => {
    console.log(`[MobileController] Capacitor resume event — game loop active`);
    onRestart();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("resume" as any, handleResume);
  console.log(`[MobileController] Visibility restart guard active`);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("resume" as any, handleResume);
  };
}

/** Build the correct native deep link URL for each wallet */
function buildWalletDeeplink(walletType: string, dappHttpsUrl: string | null): string {
  if (walletType === "phantom") {
    // Phantom Universal Link (v1) — correct format for Phantom mobile app
    // https://docs.phantom.app/phantom-deeplinks/provider-methods/connect
    const dapp = encodeURIComponent(dappHttpsUrl || "https://lifetopia.io");
    const redirect = encodeURIComponent("lifetopiaconnect://wallet-callback");
    const cluster = "mainnet-beta";
    return `https://phantom.app/ul/v1/connect?app_url=${dapp}&dapp_encryption_public_key=&redirect_link=${redirect}&cluster=${cluster}`;
  }

  if (walletType === "solflare") {
    const dapp = encodeURIComponent(dappHttpsUrl || "https://lifetopia.io");
    const redirect = encodeURIComponent("lifetopiaconnect://wallet-callback");
    return `https://solflare.com/ul/v1/connect?app_url=${dapp}&redirect_link=${redirect}&cluster=mainnet-beta`;
  }

  if (walletType === "backpack") {
    const dapp = encodeURIComponent(dappHttpsUrl || "https://lifetopia.io");
    const redirect = encodeURIComponent("lifetopiaconnect://wallet-callback");
    return `https://backpack.app/ul/v1/connect?app_url=${dapp}&redirect_link=${redirect}`;
  }

  if (walletType === "trust") {
    if (dappHttpsUrl) return `https://link.trustwallet.com/open_url?url=${encodeURIComponent(dappHttpsUrl)}`;
    return "trust:";
  }

  if (walletType === "metamask") {
    if (dappHttpsUrl) return `https://metamask.app.link/dapp/${dappHttpsUrl.replace("https://", "")}`;
    return "metamask:";
  }

  return `${walletType}:`;
}

/** Detect wallets on MOBILE via Capacitor App plugin (checks if native wallet app is installed) */
export async function detectMobileWallets(): Promise<{
  phantomInstalled: boolean;
  solflareInstalled: boolean;
  backpackInstalled: boolean;
  metamaskInstalled: boolean;
  trustInstalled: boolean;
}> {
  const result = { phantomInstalled: false, solflareInstalled: false, backpackInstalled: false, metamaskInstalled: false, trustInstalled: false };

  try {
    const app = (window as any).Capacitor?.Plugins?.App;
    if (!app) return result;

    const schemes = [
      { name: "phantom", scheme: "phantom:" },
      { name: "solflare", scheme: "solflare:" },
      { name: "backpack", scheme: "backpack:" },
      { name: "metamask", scheme: "metamask:" },
      { name: "trust", scheme: "trust:" },
    ];

    for (const w of schemes) {
      try {
        const res = await app.canOpenUrl({ url: w.scheme });
        if (res?.value) {
          if (w.name === "phantom") result.phantomInstalled = true;
          if (w.name === "solflare") result.solflareInstalled = true;
          if (w.name === "backpack") result.backpackInstalled = true;
          if (w.name === "metamask") result.metamaskInstalled = true;
          if (w.name === "trust") result.trustInstalled = true;
        }
      } catch { /* not installed */ }
    }
  } catch { /* App plugin not available */ }

  return result;
}

/** Check if Phantom/Solflare/Backpack/MetaMask is injected (desktop) or needs deep link (mobile) */
export function detectWalletEnvironment(): {
  phantomInjected: boolean;
  solflareInjected: boolean;
  backpackInjected: boolean;
  metamaskInjected: boolean;
  isMobile: boolean;
  isNative: boolean;
} {
  const w = window as any;
  const isNative = !!w.Capacitor?.isNativePlatform?.();
  const phantomInjected = !!(w.solana?.isPhantom || w.phantom?.solana?.isPhantom);
  const solflareInjected = !!(w.solflare?.isSolflare);
  const backpackInjected = !!(w.backpack?.isBackpack);
  const eth = w.ethereum;
  const providers: any[] = Array.isArray(eth?.providers) ? eth.providers : eth ? [eth] : [];
  const metamaskInjected = providers.some((p: any) => p?.isMetaMask);
  return {
    phantomInjected,
    solflareInjected,
    backpackInjected,
    metamaskInjected,
    isMobile: isMobilePlatform(),
    isNative,
  };
}

/** Setup wallet deep link handler for wallet callbacks */
export function setupWalletDeepLinkHandler() {
  // Handle Capacitor's appUrlOpen event (fires when app is opened via deep link)
  const handleAppUrlOpen = (data: { url?: string }) => {
    if (!data?.url) return;
    console.log("[DeepLink] appUrlOpen:", data.url);
    const url = new URL(data.url);
    // Parse address from various wallet callback formats
    const addr =
      url.searchParams.get("address") ||
      url.searchParams.get("pubkey") ||
      url.searchParams.get("public_key") ||
      url.searchParams.get("pk") ||
      url.searchParams.get("wallet") ||
      url.hostname; // fallback: use host as address
    const type = url.searchParams.get("type") || "solana";
    if (addr) {
      console.log("[DeepLink] Parsed wallet address:", addr);
      window.dispatchEvent(new CustomEvent("wallet-connected", {
        detail: { address: addr, type },
      }));
    }
  };

  // Handle browser-style URL params (?addr=...&pk=...)
  const handleUrlParams = () => {
    const url = new URL(window.location.href);
    const addr =
      url.searchParams.get("address") ||
      url.searchParams.get("pubkey") ||
      url.searchParams.get("public_key") ||
      url.searchParams.get("pk") ||
      url.searchParams.get("wallet");
    const type = url.searchParams.get("type") || "solana";
    if (addr) {
      console.log("[DeepLink] URL param address:", addr);
      window.dispatchEvent(new CustomEvent("wallet-connected", {
        detail: { address: addr, type },
      }));
      url.searchParams.delete("address");
      url.searchParams.delete("pubkey");
      url.searchParams.delete("public_key");
      url.searchParams.delete("pk");
      url.searchParams.delete("wallet");
      url.searchParams.delete("type");
      window.history.replaceState({}, "", url.toString());
    }
  };

  if (typeof window !== "undefined") {
    // Capacitor deep link
    (window as any).Capacitor?.Plugins?.App?.addListener?.(
      "appUrlOpen",
      handleAppUrlOpen,
    );
    // Fallback browser events
    window.addEventListener("url", handleUrlParams as any);
    // Check URL params on load
    handleUrlParams();
  }
  console.log("[MobileController] Wallet deep link handler initialized");
}
