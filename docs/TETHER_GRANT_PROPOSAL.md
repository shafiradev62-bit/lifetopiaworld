# Tether Developer Grant — Proposal: WDK-Powered Wallet in Lifetopia World

**Author:** Lifetopia World
**Repositories:**
- Source: <https://github.com/shafiradev62-bit/lifetopiaworld>
- Grants program: <https://tether.dev/grants/apply-for-a-grant/>

---

## Summary

Lifetopia World is a web3 farming game. This submission embeds a fully
**self-custodial, extension-free wallet** powered by Tether's **Wallet
Development Kit (WDK)** directly into the game — no Phantom/Solflare/Backpack
install required. The wallet holds **USDt**, the in-game LFG token and SOL on
Solana devnet, is guarded by WDK transaction policies, and ships a complete
self-custody UX (seed backup, import/recovery, transaction history, vault
account).

## What was built

### 1. WDK wallet module (`artifacts/farming-game/src/game/wdkWallet.ts`)

- **WDK core orchestrator**: the game runs `new WDK(seed).registerWallet(
  "solana", WalletManagerSolana, …)`, so every account goes through WDK's
  unified multi-chain API rather than a chain module in isolation.
- **Multichain**: the same seed also registers an EVM wallet
  (`registerWallet("ethereum", WalletManagerEvm, …)`, Sepolia) — the wallet
  panel shows the derived `0x…` address with native ETH and USDt (Sepolia)
  balances plus a USDt send flow.
- **Gasless transfers**: a Kora-compatible paymaster wallet
  (`registerWallet("solana-gasless", WalletManagerSolanaGasless, …)`)
  sponsors Solana transaction fees charged in USDt — players can send USDt
  without holding SOL, with a quote-before-send step (`quoteTransfer`).
  Enabled via environment config; without a paymaster the game runs regular
  WDK transfers.
- **Seed generation** via `WDK.getRandomSeedPhrase(12)` (BIP-39, 12 words).
- **Deterministic accounts** via `wdk.getAccount("solana", index)` (SLIP-0010
  path `m/44'/501'/index'/0'`): index 0 is the game account, index 1 a
  player vault address derived from the same seed.
- **Address + balances**: `getAddress()`, `getBalance()` (SOL lamports) and
  `getTokenBalance(mint)` for both LFG SPL and **USDt (6 decimals)**.
- **Signing**: `account.sign(message)` (Ed25519) used by the game's wallet
  login handshake (`walletHandshake.ts`).
- **Transfers**: `account.transfer({ token, recipient, amount })` for LFG SPL
  and USDt transfers between players.
- **Transaction policies**: `registerPolicy` evaluates every transfer before
  signing — non-positive amounts and transfers over the per-session cap are
  DENIED and fail closed with `PolicyViolationError` (positive/under-cap
  transfers are ALLOWed).
- **Fee rates**: `wdk.getFeeRates("solana")` surfaces normal/fast lamport
  rates for the wallet panel.
- **Reload persistence**: the seed phrase is kept in the player's browser
  storage; the wallet reconnects silently and deterministically on page load.

### 2. USDt integration

- USDt balance display, a **send USDt** flow (recipient + amount) and
  copy-to-clipboard receive, all through the WDK account API on Solana devnet
  (canonical devnet USDt mint, classic SPL token program, 6 decimals).
- **USDt on EVM (Sepolia)** via the WDK EVM account, and **gasless USDt
  sends** whose network fees are paid by a paymaster in USDt — the same
  stable asset is usable across chains and without holding SOL.
- The WDK integration is mint-agnostic: switching to mainnet only changes the
  mint constant to Tether's official USDt mint.
- On-chain activity for the wallet is listed in-game via Solana
  `getSignaturesForAddress` (`walletHistory.ts`) with Solscan links.

### 3. Self-custody UX (`artifacts/farming-game/src/pages/FarmingGame.tsx`)

- **"WDK WALLET"** connect button in the wallet panel (self-custodial, no
  extension). Existing Phantom/Solflare/Backpack paths are unchanged.
- **Seed phrase backup modal**: reveals the 12 recovery words and requires an
  explicit "I saved my seed phrase" confirmation.
- **Import seed phrase**: recover an existing WDK wallet from its 12 words.
- WDK account is exposed through the same provider adapter the rest of the
  game expects (address, `publicKey`, `signMessage`), so wallet auth,
  NFT checks and cloud saves work out of the box.
- Deterministic auto-reconnect: `wallet_addr`/`wallet_type` in localStorage
  restore the WDK wallet on reload without popups.

### 4. Tests (`wdkWallet.test.ts`, `walletHistory.test.ts`)

Unit tests cover seed generation, deterministic address derivation, seed
import, cross-seed isolation, Phantom-compatible `signMessage`, the hex
signature format used by the handshake, policy-engine ALLOW/DENY decisions
(valid, zero, over-cap, per-token caps), deterministic vault derivation, USDt
formatting, on-chain activity parsing against a mocked RPC, and the WebCrypto
Ed25519 fallback used by key derivation.
**Full suite: 85 tests passing.**

## Why WDK

- **True self-custody in a web game**: keys are generated, stored and used on
  the player's device; the seed phrase is owned by the player, not the game
  server, and the game itself never sees the private keys.
- **Local-first by design**: wallet creation, derivation, signing, balances
  and transfer submission all run in the browser through the WDK and the
  player's own RPC — no custodial service, exchange or hosted wallet API.
- **USDt as the game's stable asset**: the wallet holds and moves USDt
  directly — on Solana and on EVM (Sepolia) — matching Tether's mission of
  usable, self-custodial stablecoin payments embedded in software.
- **Gasless payments**: fee sponsorship via a Kora-compatible paymaster
  means players can pay with USDt even with an empty SOL balance, lowering
  the barrier to real in-game stablecoin use.
- **Deterministic reconnects**: no extension prompts, no popups — better UX
  for a game played across desktop and Android (Capacitor).
- **Modern Solana stack**: WDK is built on `@solana/kit` v3 (rpc, signers,
  transactions), and is ready for Tether's QVAC / MOS / Pears ecosystem.

## Alignment with the Tether Developer Grant

This submission targets the grant program's **applications built on Tether's
stack** and **wallet infrastructure** tracks:

- **Embedded self-custodial wallet**: a production game with a working WDK
  wallet in the shipped product (browser + Android builds).
- **USDt payments**: balance, send and receive flows for USDt on devnet,
  ready to point at mainnet by swapping the mint constant.
- **Security depth**: WDK transaction policies gate every transfer before it
  is signed; seed backup and import give players full recovery control.
- **Completed, verifiable work**: 85 passing tests, strict TypeScript
  type-check and a production build that all run from the repository.

## Technical notes

- Solana network: **devnet only** (public alpha). Canonical LFG mint:
  `ByrXMnACFFyvsL6d4yKFguCK8CNRJDMSWWshLejaApVu`. Canonical devnet USDt mint:
  `EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS` (classic SPL, 6 decimals).
- EVM multichain runs on **Sepolia** (`VITE_EVM_RPC_URL`, `VITE_EVM_CHAIN_ID`
  override), USDt on Sepolia defaults to the reference ERC-20 deployment
  (`VITE_SEPOLIA_USDT`). Gasless uses a Kora-compatible paymaster configured
  via `VITE_SOLANA_PAYMASTER_URL` / `VITE_SOLANA_PAYMASTER_ADDRESS` /
  `VITE_SOLANA_PAYMASTER_TOKEN`; empty values disable the gasless wallet.
- The `buffer` npm polyfill (required for the browser bundle) returns a
  `Buffer` that fails WDK's `instanceof Uint8Array` check, so the module
  normalizes `bip39.mnemonicToSeedSync()` output to a plain `Uint8Array`
  before constructing the WDK instance.
- Robustness on any webview: `ed25519CryptoShim.ts` installs a noble-ed25519
  fallback only when the host's WebCrypto lacks Ed25519 (needed by WDK key
  derivation), and `sodium-javascript` is pinned so the browser build of
  `sodium-universal` resolves under Vite.
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
- [x] WDK core orchestrator (`@tetherto/wdk`) with the Solana wallet module
- [x] Multichain: EVM (Sepolia) account derived from the same seed, with USDt send flow
- [x] Gasless USDt transfers via a Kora-compatible paymaster (fees sponsored in USDt)
- [x] USDt (devnet) balance, send and receive through the WDK account API
- [x] WDK transaction policy engine guarding transfers (fail-closed caps)
- [x] Deterministic self-custodial accounts (BIP-39 + SLIP-0010, multi-index)
- [x] Seed phrase backup and import/recovery flows in-game
- [x] On-chain transaction history with explorer links
- [x] Wallet auth handshake signing
- [x] LFG SPL token balance + transfer support
- [x] Tests, type-check, production build all green (85 unit tests)
- [x] Robustness on webviews without native Ed25519 WebCrypto
- [x] Clean public repo (no secrets, no build artifacts)
