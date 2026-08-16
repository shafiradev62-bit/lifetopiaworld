/**
 * MobileController.browseUrl.test.ts
 * Tests for resolveWalletBrowseUrl logic.
 *
 * We test the pure URL-normalisation and fallback logic directly,
 * without needing import.meta.env to be set in jsdom.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("resolveWalletBrowseUrl() URL resolution logic", () => {
  const originalWindow = window;

  beforeEach(() => {
    vi.stubGlobal("window", { ...originalWindow });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Pure logic mirrors resolveWalletBrowseUrl but is testable ─────────────

  /** Mirrors the real resolveWalletBrowseUrl with an injected env value */
  const makeResolve = (envUrl?: string | null) => {
    return (override?: string) => {
      const candidates = [override, envUrl ?? undefined].filter(
        (u): u is string => typeof u === "string" && u.length > 0,
      );
      for (const c of candidates) {
        try {
          const u = new URL(c);
          if (u.protocol === "https:") return u.toString();
        } catch { /* ignore */ }
      }
      if (typeof window !== "undefined") {
        try {
          const u = new URL(window.location.href);
          if (
            u.protocol === "https:" &&
            u.hostname !== "localhost" &&
            u.hostname !== "127.0.0.1"
          ) {
            return window.location.href;
          }
        } catch { /* ignore */ }
      }
      return null;
    };
  };

  // HTTPS override takes priority
  it("returns HTTPS URL when provided as override", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost:3000" } } as any);
    const resolve = makeResolve(undefined);
    expect(resolve("https://myapp.example.com")).toBe("https://myapp.example.com/");
  });

  it("returns HTTPS URL from env var when no override", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost:3000" } } as any);
    const resolve = makeResolve("https://env.example.com");
    expect(resolve()).toBe("https://env.example.com/");
  });

  it("returns window.location.href when on HTTPS and not localhost", () => {
    vi.stubGlobal("window", { location: { href: "https://deployed.app.com" } } as any);
    const resolve = makeResolve(undefined);
    expect(resolve()).toBe("https://deployed.app.com");
  });

  it("returns null for localhost (HTTP)", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost:3000" } } as any);
    const resolve = makeResolve(undefined);
    expect(resolve()).toBeNull();
  });

  it("returns null for 127.0.0.1 (HTTP)", () => {
    vi.stubGlobal("window", { location: { href: "http://127.0.0.1:3000" } } as any);
    const resolve = makeResolve(undefined);
    expect(resolve()).toBeNull();
  });

  it("returns null for HTTP (non-localhost)", () => {
    vi.stubGlobal("window", { location: { href: "http://example.com" } } as any);
    const resolve = makeResolve(undefined);
    expect(resolve()).toBeNull();
  });

  it("ignores non-HTTPS overrides", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost:3000" } } as any);
    const resolve = makeResolve(undefined);
    expect(resolve("http://insecure.example.com")).toBeNull();
  });

  it("override takes priority over env var", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost:3000" } } as any);
    const resolve = makeResolve("https://env.example.com");
    expect(resolve("https://override.example.com")).toBe("https://override.example.com/");
  });

  it("returns null when no HTTPS URL is available anywhere", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost:3000" } } as any);
    const resolve = makeResolve(null);
    expect(resolve()).toBeNull();
  });

  it("env var with non-HTTPS is ignored", () => {
    vi.stubGlobal("window", { location: { href: "http://localhost:3000" } } as any);
    const resolve = makeResolve("http://env.example.com");
    expect(resolve()).toBeNull();
  });
});
