/**
 * MobileController.test.ts
 * Tests for mobile platform detection, wallet browse URL resolution, and deep links.
 * Note: resolveWalletBrowseUrl tests are in MobileController.browseUrl.test.ts
 * because vi.mock must be at the top level and pollutes other tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTouchQuadrant,
  quadrantToKeys,
  isMobilePlatform,
  detectWalletEnvironment,
} from "./MobileController";

describe("MobileController", () => {
  const originalNavigator = navigator;
  const originalWindow = window;

  beforeEach(() => {
    vi.stubGlobal("navigator", { ...originalNavigator });
    vi.stubGlobal("window", { ...originalWindow });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getTouchQuadrant ────────────────────────────────────────────────────

  describe("getTouchQuadrant()", () => {
    const vw = 1000;
    const vh = 800;

    it("returns 'right' when touch is in right half", () => {
      expect(getTouchQuadrant(800, 400, vw, vh)).toBe("right");
    });

    it("returns 'left' when touch is in left half", () => {
      expect(getTouchQuadrant(200, 400, vw, vh)).toBe("left");
    });

    it("returns 'down' when touch is in bottom half", () => {
      expect(getTouchQuadrant(500, 700, vw, vh)).toBe("down");
    });

    it("returns 'up' when touch is in top half", () => {
      expect(getTouchQuadrant(500, 100, vw, vh)).toBe("up");
    });

    it("returns null when touch is in dead zone center", () => {
      expect(getTouchQuadrant(500, 400, vw, vh)).toBeNull();
    });
  });

  // ─── quadrantToKeys ──────────────────────────────────────────────────────

  describe("quadrantToKeys()", () => {
    it("maps up to arrowup", () => expect(quadrantToKeys("up")).toEqual(["arrowup"]));
    it("maps down to arrowdown", () => expect(quadrantToKeys("down")).toEqual(["arrowdown"]));
    it("maps left to arrowleft", () => expect(quadrantToKeys("left")).toEqual(["arrowleft"]));
    it("maps right to arrowright", () => expect(quadrantToKeys("right")).toEqual(["arrowright"]));
    it("maps null to empty array", () => expect(quadrantToKeys(null)).toEqual([]));
  });

  // ─── isMobilePlatform ────────────────────────────────────────────────────

  describe("isMobilePlatform()", () => {
    it("returns true for Android user agent", () => {
      vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36" } as any);
      vi.stubGlobal("window", { Capacitor: undefined } as any);
      expect(isMobilePlatform()).toBe(true);
    });

    it("returns true for iPhone user agent", () => {
      vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" } as any);
      vi.stubGlobal("window", { Capacitor: undefined } as any);
      expect(isMobilePlatform()).toBe(true);
    });

    it("returns false for desktop user agent", () => {
      vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0" } as any);
      vi.stubGlobal("window", { Capacitor: undefined } as any);
      expect(isMobilePlatform()).toBe(false);
    });

    it("returns true when Capacitor is native platform", () => {
      vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows)" } as any);
      vi.stubGlobal("window", {
        Capacitor: { isNativePlatform: () => true },
      } as any);
      expect(isMobilePlatform()).toBe(true);
    });
  });

  // ─── detectWalletEnvironment ─────────────────────────────────────────────

  describe("detectWalletEnvironment()", () => {
    it("detects Phantom from window.phantom.solana", () => {
      vi.stubGlobal("window", {
        phantom: { solana: { isPhantom: true } },
        solana: undefined,
        solflare: undefined,
        backpack: undefined,
        ethereum: undefined,
        Capacitor: { isNativePlatform: () => false },
      } as any);
      const env = detectWalletEnvironment();
      expect(env.phantomInjected).toBe(true);
      expect(env.solflareInjected).toBe(false);
      expect(env.isMobile).toBe(false);
    });

    it("detects Phantom from window.solana.isPhantom", () => {
      vi.stubGlobal("window", {
        phantom: undefined,
        solana: { isPhantom: true },
        solflare: undefined,
        backpack: undefined,
        ethereum: undefined,
        Capacitor: { isNativePlatform: () => false },
      } as any);
      const env = detectWalletEnvironment();
      expect(env.phantomInjected).toBe(true);
    });

    it("detects Solflare from window.solflare", () => {
      vi.stubGlobal("window", {
        phantom: undefined,
        solana: undefined,
        solflare: { isSolflare: true },
        backpack: undefined,
        ethereum: undefined,
        Capacitor: { isNativePlatform: () => false },
      } as any);
      const env = detectWalletEnvironment();
      expect(env.solflareInjected).toBe(true);
    });

    it("detects MetaMask from window.ethereum", () => {
      vi.stubGlobal("window", {
        phantom: undefined,
        solana: undefined,
        solflare: undefined,
        backpack: undefined,
        ethereum: { isMetaMask: true },
        Capacitor: { isNativePlatform: () => false },
      } as any);
      const env = detectWalletEnvironment();
      expect(env.metamaskInjected).toBe(true);
    });

    it("marks isNative when Capacitor is native platform", () => {
      vi.stubGlobal("window", {
        phantom: undefined,
        solana: undefined,
        solflare: undefined,
        backpack: undefined,
        ethereum: undefined,
        Capacitor: { isNativePlatform: () => true },
        navigator: { userAgent: "Desktop" },
      } as any);
      const env = detectWalletEnvironment();
      expect(env.isNative).toBe(true);
    });
  });
});
