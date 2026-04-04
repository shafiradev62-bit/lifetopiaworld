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

/** Open Phantom, Solflare, Backpack, MetaMask or Trust Wallet via Universal Link / deep link on mobile */
export function openWalletDeepLink(walletType: "phantom" | "solflare" | "backpack" | "metamask" | "trust", dappUrl?: string): void {
  const url = dappUrl || window.location.href;
  const encoded = encodeURIComponent(url);
  const host = url.replace(/^https?:\/\//, "");

  console.log(`[MobileController] Attempting deep link for ${walletType} to ${url}`);

  // Try using Capacitor App plugin for native app detection and opening
  const w = window as any;
  const capacitorApp = w.Capacitor?.Plugins?.App;
  const isNative = !!w.Capacitor?.isNativePlatform?.();

  if (capacitorApp && isNative) {
    const SCHEMES: Record<string, string> = {
      phantom: "phantom:",
      solflare: "solflare:",
      backpack: "backpack:",
      metamask: "metamask:",
      trust: "trust:",
    };
    const scheme = SCHEMES[walletType];
    if (scheme) {
      capacitorApp.canOpenUrl({ url: scheme }).then((res: any) => {
        if (res.value) {
          // If we have a custom scheme for OUR app, we could tell the wallet to return here.
          // For now, let's use the most reliable "browse" URL which opens the wallet's internal browser.
          const fallback = getWebFallback(walletType, encoded, host);
          console.log("[MobileController] App installed, opening:", fallback);
          window.location.href = fallback;
        } else {
          const fallback = getWebFallback(walletType, encoded, host);
          console.log("[MobileController] App NOT installed, opening fallback:", fallback);
          window.location.href = fallback;
        }
      }).catch(() => {
        window.location.href = getWebFallback(walletType, encoded, host);
      });
      return;
    }
  }

  // Fallback for mobile web
  window.location.href = getWebFallback(walletType, encoded, host);
}

function getWebFallback(walletType: "phantom" | "solflare" | "backpack" | "metamask" | "trust", encoded: string, host: string): string {
  if (walletType === "phantom") {
    // Phantom Universal Link - Browse mode
    return `https://phantom.app/ul/browse/${encoded}?ref=${encoded}`;
  } else if (walletType === "solflare") {
    return `https://solflare.com/ul/browse/${encoded}`;
  } else if (walletType === "backpack") {
    return `https://backpack.app/ul/browse/${encoded}`;
  } else if (walletType === "trust") {
    return `https://link.trustwallet.com/open_url?url=${encoded}`;
  } else {
    // MetaMask Deep Link - dApp browser mode
    return `https://metamask.app.link/dapp/${host}`;
  }
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

    // Check each wallet's URL scheme availability
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
  const handleDeepLink = (event: Event) => {
    event.preventDefault();
    const url = new URL(window.location.href);
    const addr = url.searchParams.get("addr") || url.searchParams.get("public_key") || url.searchParams.get("pk");
    const type = url.searchParams.get("type");
    if (addr) {
      console.log('[DeepLink] Received callback with address:', addr);
      window.dispatchEvent(new CustomEvent('wallet-connected', { 
        detail: { address: addr, type: type || 'solana' } 
      }));
      url.searchParams.delete("addr");
      url.searchParams.delete("public_key");
      url.searchParams.delete("pk");
      url.searchParams.delete("type");
      window.history.replaceState({}, '', url.toString());
    }
  };
  
  if (typeof window !== 'undefined') {
    window.addEventListener('appUrlOpen', handleDeepLink as any);
    window.addEventListener('url', handleDeepLink as any);
    const url = new URL(window.location.href);
    if (url.searchParams.has("addr") || url.searchParams.has("public_key")) {
      handleDeepLink(new Event('url'));
    }
  }
  console.log('[MobileController] Wallet deep link handler initialized');
}
