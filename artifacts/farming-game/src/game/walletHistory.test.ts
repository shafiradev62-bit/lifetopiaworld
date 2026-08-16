import { describe, it, expect, afterEach, vi } from "vitest";
import { fetchRecentTransactions } from "./walletHistory";

const VALID_ADDRESS = "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk";

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: async () => body,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("walletHistory (Solana getSignaturesForAddress)", () => {
  it("returns parsed transactions in confirmation order", async () => {
    mockFetchOnce({
      jsonrpc: "2.0",
      id: "wallet-history",
      result: [
        { signature: "sigA", slot: 300, err: null },
        { signature: "sigB", slot: 290, err: { message: "Blockhash not found" } },
      ],
    });

    const txs = await fetchRecentTransactions(VALID_ADDRESS, 8);
    expect(txs).toHaveLength(2);
    expect(txs[0]).toEqual({ signature: "sigA", slot: 300, err: null });
    expect(txs[1]).toEqual({
      signature: "sigB",
      slot: 290,
      err: "Blockhash not found",
    });
  });

  it("returns an empty list for a wallet without activity", async () => {
    mockFetchOnce({ jsonrpc: "2.0", id: "wallet-history", result: [] });
    const txs = await fetchRecentTransactions(VALID_ADDRESS);
    expect(txs).toEqual([]);
  });

  it("returns an empty list when the RPC reports an error", async () => {
    mockFetchOnce({ jsonrpc: "2.0", id: "wallet-history", error: { code: -32601 } });
    const txs = await fetchRecentTransactions(VALID_ADDRESS);
    expect(txs).toEqual([]);
  });

  it("returns an empty list when the RPC is unreachable", async () => {
    mockFetchOnce({}, false);
    const txs = await fetchRecentTransactions(VALID_ADDRESS);
    expect(txs).toEqual([]);
  });

  it("returns an empty list for invalid addresses", async () => {
    const txs = await fetchRecentTransactions("guest_abc123", 8);
    expect(txs).toEqual([]);
  });

  it("requests the configured limit and confirmed commitment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", id: "wallet-history", result: [] }),
      }),
    );

    await fetchRecentTransactions(VALID_ADDRESS, 5);

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("devnet");
    const body = JSON.parse(init.body);
    expect(body.method).toBe("getSignaturesForAddress");
    expect(body.params[1].limit).toBe(5);
    expect(body.params[1].commitment).toBe("confirmed");
  });
});
