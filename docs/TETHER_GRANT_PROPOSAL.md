# Tether Developer Grant — Proposal: WDK-Powered Wallet in Lifetopia World

**Author:** Lifetopia World
**Repositories:**
- Source: <https://github.com/shafiradev62-bit/lifetopiaworld>
- Grants program: <https://tether.dev/grants/apply-for-a-grant/>

---

## Summary

Lifetopia World is a web3 farming game. This submission adds a fully
**self-custodial, extension-free wallet** powered by Tether's **Wallet
Development Kit (WDK)**, letting players create and use a Solana wallet
directly inside the game — no Phantom/Solflare/Backpack install required.

## What was built

### 1. WDK wallet module (`artifacts/farming-game/src/game/wdkWallet.ts`)

- **Seed generation** via `WDK.getRandomSeedPhrase(12)` (BIP-39, 12 words).
- **Deterministic accounts** via `WalletManagerSolana` + `getAccount(0)`
  (SLIP-0010 path `m/44'/501'/0'/0'`).
- **Address + balances**: `getAddress()`, `getBalance()` (SOL lamports) and
  `getTokenBalance(LIFETOPIA_ALPHA_MINT)` (LFG SPL) through the WDK account API.
- **Signing**: `account.sign(message)` (Ed25519) used by the game's wallet
  login handshake (`walletHandshake.ts`).
- **Transfers**: `account.transfer({ token, recipient, amount })` for LFG SPL
  transfers between players.
- **Reload persistence**: the seed phrase is kept in the player's browser
  storage; the wallet reconnects silently and deterministically on page load.

### 2. Game integration (`artifacts/farming-game/src/pages/FarmingGame.tsx`)

- New **"WDK WALLET"** connect button in the wallet panel (self-custodial,
  no extension). Existing Phantom/Solflare/Backpack paths are unchanged.
- WDK account is exposed through the same provider adapter the rest of the
  game expects (address, `publicKey`, `signMessage`), so wallet auth,
  NFT checks and cloud saves work out of the box.
- Deterministic auto-reconnect: `wallet_addr`/`wallet_type` in localStorage
  restore the WDK wallet on reload without popups.

### 3. Tests (`wdkWallet.test.ts`)

Unit tests cover seed generation, deterministic address derivation,
seed import, cross-seed isolation, Phantom-compatible `signMessage`, and the
hex signature format used by the handshake. **Full suite: 67 tests passing.**

## Why WDK

- **True self-custody in a web game**: keys are generated and stored on the
  player's device; the seed phrase is owned by the player, not the game server.
- **Deterministic reconnects**: no extension prompts, no popups — better UX
  for a game played across desktop and Android (Capacitor).
- **Modern Solana stack**: WDK is built on `@solana/kit` v3 (rpc, signers,
  transactions), and is ready for Tether's QVAC / MOS / Pears ecosystem.

## Technical notes

- Solana network: **devnet only** (public alpha). Canonical LFG mint:
  `ByrXMnACFFyvsL6d4yKFguCK8CNRJDMSWWshLejaApVu`.
- The `buffer` npm polyfill (required for the browser bundle) returns a
  `Buffer` that fails WDK's `instanceof Uint8Array` check, so the module
  normalizes `bip39.mnemonicToSeedSync()` output to a plain `Uint8Array`
  before constructing `WalletManagerSolana`.
- `@solana/kit@3.0.3` is pinned to match `@tetherto/wdk-wallet-solana`'s
  `@solana/*` v3 dependency set.

## Run it

```bash
pnpm install
pnpm --filter @workspace/farming-game dev     # open the game, click "WDK WALLET"
pnpm typecheck
pnpm --filter @workspace/farming-game test
pnpm --filter @workspace/farming-game build
```

## Deliverables checklist

- [x] Working WDK wallet in the shipped game (browser + Android builds)
- [x] Deterministic self-custodial accounts (BIP-39 + SLIP-0010)
- [x] Wallet auth handshake signing
- [x] LFG SPL token balance + transfer support
- [x] Tests, type-check, production build all green
- [x] Clean public repo (no secrets, no build artifacts)
