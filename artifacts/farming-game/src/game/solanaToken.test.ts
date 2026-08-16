/**
 * solanaToken.test.ts
 * Tests for Solana token integration: provider detection, ATA init, balance fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPhantomProvider } from "./solanaToken";

describe("solanaToken", () => {
  const originalWindow = window;

  beforeEach(() => {
    // Reset window between tests
    vi.stubGlobal("window", { ...originalWindow });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getPhantomProvider ───────────────────────────────────────────────────

  describe("getPhantomProvider()", () => {
    it("returns Phantom from window.phantom.solana", () => {
      (window as any).phantom = { solana: { isPhantom: true, publicKey: {} } };
      const result = getPhantomProvider();
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Phantom");
      expect(result?.sol).toBe((window as any).phantom.solana);
    });

    it("returns Phantom from window.solana (fallback)", () => {
      (window as any).phantom = undefined;
      (window as any).solana = { isPhantom: true, publicKey: {} };
      const result = getPhantomProvider();
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Phantom");
      expect(result?.sol).toBe((window as any).solana);
    });

    it("returns Solflare from window.solflare", () => {
      (window as any).phantom = undefined;
      (window as any).solana = undefined;
      (window as any).solflare = { isSolflare: true, publicKey: {} };
      const result = getPhantomProvider();
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Solflare");
      expect(result?.sol).toBe((window as any).solflare);
    });

    it("returns Backpack from window.backpack", () => {
      (window as any).phantom = undefined;
      (window as any).solana = undefined;
      (window as any).solflare = undefined;
      (window as any).backpack = { isBackpack: true, publicKey: {} };
      const result = getPhantomProvider();
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Backpack");
      expect(result?.sol).toBe((window as any).backpack);
    });

    it("returns null when no wallet is present", () => {
      (window as any).phantom = undefined;
      (window as any).solana = undefined;
      (window as any).solflare = undefined;
      (window as any).backpack = undefined;
      const result = getPhantomProvider();
      expect(result).toBeNull();
    });

    it("prefers Phantom over Solflare when both are present", () => {
      (window as any).phantom = { solana: { isPhantom: true } };
      (window as any).solflare = { isSolflare: true };
      const result = getPhantomProvider();
      expect(result?.name).toBe("Phantom");
    });

    it("prefers Solflare over Backpack when both are present", () => {
      (window as any).phantom = undefined;
      (window as any).solana = undefined;
      (window as any).solflare = { isSolflare: true };
      (window as any).backpack = { isBackpack: true };
      const result = getPhantomProvider();
      expect(result?.name).toBe("Solflare");
    });
  });

  // ─── fetchTokenBalanceByRPC ───────────────────────────────────────────────

  describe("fetchTokenBalanceByRPC()", () => {
    it("returns 0 for invalid wallet addresses", async () => {
      const { fetchTokenBalanceByRPC } = await import("./solanaToken");
      const result = await fetchTokenBalanceByRPC("abc");
      expect(result).toBe(0);
    });

    it("returns 0 for empty wallet address", async () => {
      const { fetchTokenBalanceByRPC } = await import("./solanaToken");
      const result = await fetchTokenBalanceByRPC("");
      expect(result).toBe(0);
    });

    it("parses RPC response correctly when account exists", async () => {
      const mockResponse = {
        jsonrpc: "2.0",
        id: "lfg-balance",
        result: {
          value: [
            {
              account: {
                data: {
                  parsed: {
                    info: {
                      tokenAmount: {
                        uiAmount: 42.5,
                        amount: "42500000000",
                        decimals: 9,
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      }) as any;

      const { fetchTokenBalanceByRPC } = await import("./solanaToken");
      const result = await fetchTokenBalanceByRPC("CG8dh8s8P8y7seC3hB9QWuoBX81ug8MvfZK9s9WjaQFT");
      expect(result).toBe(42.5);
    });

    it("returns 0 when token account does not exist", async () => {
      const mockResponse = {
        jsonrpc: "2.0",
        id: "lfg-balance",
        result: { value: [] },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      }) as any;

      const { fetchTokenBalanceByRPC } = await import("./solanaToken");
      const result = await fetchTokenBalanceByRPC("CG8dh8s8P8y7seC3hB9QWuoBX81ug8MvfZK9s9WjaQFT");
      expect(result).toBe(0);
    });

    it("returns 0 on fetch failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error")) as any;

      const { fetchTokenBalanceByRPC } = await import("./solanaToken");
      const result = await fetchTokenBalanceByRPC("CG8dh8s8P8y7seC3hB9QWuoBX81ug8MvfZK9s9WjaQFT");
      expect(result).toBe(0);
    });
  });
});
