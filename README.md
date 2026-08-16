# Lifetopia World

Lifetopia World is a 2D farming and life-simulation game for the browser and Android, built with React, TypeScript and Vite. It runs a Solana (devnet) in-game economy and integrates **Tether's Wallet Development Kit (WDK)** to give every player a fully self-custodial Solana wallet directly inside the game — no browser extension required.

This repository is the source submission for the **Tether Developer Grant** (see [docs/TETHER_GRANT_PROPOSAL.md](./docs/TETHER_GRANT_PROPOSAL.md)).

## Overview

Players grow crops, fish, mine resources, complete quests and trade in a cozy pixel-art world with multiple maps (home farm, city, garden, fishing area). Progress is saved to the cloud via Supabase and tied to a player-owned wallet.

The wallet layer is the centerpiece of this submission:

- **WDK self-custodial wallet** — the game runs Tether's Wallet Development Kit core (`@tetherto/wdk`) with the Solana module (`@tetherto/wdk-wallet-solana`). A BIP-39 seed phrase is generated locally on the player's device and deterministic accounts are derived via SLIP-0010 (`m/44'/501'/index'/0'`). The game never sees the private keys.
- **USDt (USDT) support on devnet** — players can read, send and receive USDt straight from the wallet panel through the WDK account API, alongside the in-game LFG token.
- **WDK transaction policies** — every transfer is evaluated by the WDK policy engine before it is signed (positive amounts, per-session caps), which fails closed on violations.
- **Multichain from one seed** — the same BIP-39 seed also derives an EVM account (`registerWallet("ethereum", WalletManagerEvm, …)`, Sepolia), so the wallet panel shows a `0x…` address with native ETH and USDt (Sepolia) balances and a send flow.
- **Gasless USDt transfers** — a Kora-compatible paymaster wallet (`registerWallet("solana-gasless", …)`) sponsors Solana transaction fees charged in USDt, so players can move USDt without holding SOL. Activated via env config; the game degrades gracefully when no paymaster is set.
- **Extension-free by default** — the WDK wallet connects silently and reconnects deterministically on reload, with no popups or install prompts. Phantom, Solflare and Backpack are still fully supported through the standard Solana provider adapter.
- **Wallet-based auth** — the game signs a login message with the WDK account (Ed25519) and links the wallet to the player's cloud save.
- **LFG token economy (devnet)** — mint, burn and transfer LFG SPL tokens, on-chain NFT checks, and a devnet treasury faucet for testing.

## Features

- Crop farming with planting, watering, fertilizing and harvesting
- Fishing with rarity tiers (common, rare, exotic) and a bite minigame
- Mining, resource gathering and a buildable shop
- Daily login rewards and streak bonuses
- Quests, levels, milestones and active boosts
- Multiple explorable maps with NPCs and ambient audio
- Multiplayer presence in the garden (live player count + remote players via Supabase)
- Works in the browser and as a Capacitor Android app
- Desktop (keyboard + mouse) and mobile (touch HUD) controls

Wallet capabilities (all devnet):

- Self-custodial WDK wallet with seed phrase backup and import/recovery flows in-game
- SOL, LFG and USDt balance display, USDt send flow, and copy-to-clipboard receive
- Deterministic vault account (derivation index 1) alongside the game account
- Multichain EVM (Sepolia) account derived from the same seed: address, ETH + USDt balances, USDt send flow
- Gasless USDt transfers through a Kora-compatible paymaster (fees sponsored in USDt, quote-before-send)
- Recent on-chain activity list (Solana `getSignaturesForAddress`) with Solscan links
- WDK policy engine guarding every token transfer (positive amounts, per-session caps)

## Tether WDK integration

All WDK code lives in `artifacts/farming-game/src/game/wdkWallet.ts` (wallet core + policies), `artifacts/farming-game/src/game/walletHistory.ts` (on-chain activity) and is wired into the game through `artifacts/farming-game/src/pages/FarmingGame.tsx`.

| Capability | Implementation |
| --- | --- |
| Seed generation | `WDK.getRandomSeedPhrase(12)` (BIP-39) |
| Wallet orchestrator | `new WDK(seed).registerWallet("solana", WalletManagerSolana, …)` |
| Account derivation | `wdk.getAccount("solana", 0)` game account, index 1 vault (SLIP-0010) |
| Balances | `getBalance()` (SOL), `getTokenBalance(mint)` (LFG and USDt SPL) |
| Signing | `account.sign(message)` (Ed25519) for the wallet login handshake |
| Transfers | `account.transfer({ token, recipient, amount })` for LFG and USDt |
| Transaction policies | `registerPolicy` — DENY non-positive and over-cap transfers (fail-closed) |
| Fee rates | `wdk.getFeeRates("solana")` (normal/fast lamports) |
| Multichain (EVM) | `registerWallet("ethereum", WalletManagerEvm, …)` — same seed, Sepolia USDt transfers |
| Gasless | `registerWallet("solana-gasless", WalletManagerSolanaGasless, …)` — paymaster sponsors fees in USDt |
| Persistence | Seed stored in player's browser storage; wallet reconnects deterministically on page load |

The WDK account is exposed through the same provider adapter the rest of the game expects (address, `publicKey`, `signMessage`), so wallet auth, NFT checks and cloud saves work unchanged for WDK and extension wallets alike.

**Tests:** unit tests in `wdkWallet.test.ts` cover seed generation, deterministic address derivation, seed import, cross-seed isolation, Phantom-compatible `signMessage`, the hex signature format used by the handshake, policy-engine ALLOW/DENY decisions, deterministic vault derivation and USDt formatting. `walletHistory.test.ts` covers on-chain activity parsing against a mocked RPC, and `ed25519CryptoShim.test.ts` covers the WebCrypto fallback (PKCS#8/raw/JWK import, signing, verification). Full suite: **85 tests passing**.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS 4
- **Mobile:** Capacitor 8 (Android)
- **Blockchain:** Solana (devnet) + EVM (Sepolia), `@tetherto/wdk`, `@tetherto/wdk-wallet-solana`, `@tetherto/wdk-wallet-evm`, `@tetherto/wdk-wallet-solana-gasless`, `@solana/kit` v3, `@solana/spl-token`, `@solana/web3.js`
- **Backend services:** Supabase (auth, cloud save, multiplayer presence)
- **Tooling:** pnpm workspace, Vitest, ESLint-free strict TypeScript

## Repository layout

```
artifacts/farming-game/   The entire game: Vite + React + TypeScript + Capacitor
  src/pages/FarmingGame.tsx   Main game screen (WDK wallet UI lives here)
  src/game/                   Game engine, renderer, data + all web3 modules
  src/components/             Game UI components
  public/                     Game art and audio assets
  android/                    Capacitor Android project
docs/TETHER_GRANT_PROPOSAL.md  Grant proposal and implementation notes
```

Key web3 modules under `artifacts/farming-game/src/game/`:

| File | Purpose |
| --- | --- |
| `wdkWallet.ts` | WDK self-custodial wallet: seed generation/import, deterministic accounts, balances, transfers, transaction policies, multichain (EVM) and gasless accounts |
| `walletHistory.ts` | On-chain activity via Solana `getSignaturesForAddress` |
| `ed25519CryptoShim.ts` | WebCrypto Ed25519 fallback (noble-ed25519) for webviews without native Ed25519 |
| `walletHandshake.ts` | Wallet login handshake and Supabase verification |
| `solanaConfig.ts` | Devnet RPC, canonical LFG mint and USDt mint constants |
| `devnetTransactions.ts` | Devnet mint/burn hooks (treasury faucet) for testing |
| `Web3Config.ts` | Phantom / Solflare / Backpack extension connector |

## Getting started

Requires Node.js 20+ and pnpm 9+.

```bash
pnpm install
pnpm --filter @workspace/farming-game dev
```

Open the printed local URL and click **WDK WALLET** in the wallet panel to create a self-custodial wallet and start playing.

### Checks

```bash
pnpm typecheck                       # Type-check all workspaces
pnpm --filter @workspace/farming-game test    # 85 unit tests
pnpm --filter @workspace/farming-game build   # Production bundle
pnpm --filter @workspace/farming-game serve   # Preview the production build
```

### Environment

Copy `artifacts/farming-game/.env.example` to `artifacts/farming-game/.env` and set your values:

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_LIFETOPIA_ALPHA_MINT` | Yes | Canonical LFG devnet mint address |
| `VITE_TOKEN_MINT_ADDRESS` | Yes | Alias of the canonical LFG mint |
| `VITE_DEVNET_TOKEN_MINT` | Yes | Alias of the canonical LFG mint |
| `VITE_SOLANA_DEVNET_RPC` | Yes | Devnet JSON-RPC endpoint |
| `VITE_ALPHA_NFT_MINT` | No | Optional NFT mint for on-chain ownership checks |
| `VITE_LFG_TREASURY_KEY` | No | Optional devnet treasury key array for the test faucet. Leave empty for WDK-only mode |
| `VITE_DEVNET_USDT_MINT` | No | USDt devnet mint override (defaults to the canonical devnet USDt mint) |
| `VITE_EVM_RPC_URL` | No | EVM RPC for the WDK multichain wallet (defaults to Sepolia public RPC) |
| `VITE_EVM_CHAIN_ID` | No | EVM chain ID for the WDK multichain wallet (default 11155111) |
| `VITE_SEPOLIA_USDT` | No | USDt (Sepolia) ERC-20 address override |
| `VITE_SOLANA_PAYMASTER_URL` | No | Kora-compatible paymaster URL for gasless USDt transfers (empty = gasless off) |
| `VITE_SOLANA_PAYMASTER_ADDRESS` | No | Paymaster authority address (required together with the paymaster URL) |
| `VITE_SOLANA_PAYMASTER_TOKEN` | No | Paymaster fee token (defaults to the devnet USDt mint) |
| `VITE_WALLET_DAPP_URL` | Yes* | Deployed HTTPS URL (required for mobile wallet deep links) |

All crypto interactions are **devnet-only** during public alpha (EVM multichain runs on Sepolia). The treasury key is optional and must never be committed. The gasless paymaster is optional: leave the `VITE_SOLANA_PAYMASTER_*` variables empty to run with regular WDK transfers.

## Security notes

- Private keys never leave the player's device; the WDK seed phrase is stored in the player's browser storage.
- No secrets are committed. `.env` files are git-ignored; only `.env.example` is tracked.
- The `buffer` npm polyfill (required for the browser bundle) fails WDK's `instanceof Uint8Array` check, so `wdkWallet.ts` normalizes `bip39.mnemonicToSeedSync()` output to a plain `Uint8Array` before constructing the WDK instance.
- USDt is integrated on Solana devnet (classic SPL, 6 decimals) so transfers can be tested without funds; the WDK integration is mint-agnostic, and switching to mainnet only changes the mint constant to Tether's official USDt mint.
- Some embedded webviews ship a WebCrypto implementation without Ed25519, which would break WDK key derivation at connect time. `ed25519CryptoShim.ts` detects this and installs a noble-ed25519 fallback (only when needed); `sodium-javascript` is pinned so `sodium-universal`'s browser build resolves in Vite dev.
- `@solana/kit@3.0.3` is pinned to match `@tetherto/wdk-wallet-solana`'s `@solana/*` v3 dependency set.

## License

MIT
