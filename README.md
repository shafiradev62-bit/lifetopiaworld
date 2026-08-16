# Lifetopia World

Lifetopia World is a 2D farming and life-simulation game for the browser and Android, built with React, TypeScript and Vite. It runs a Solana (devnet) in-game economy and integrates **Tether's Wallet Development Kit (WDK)** to give every player a fully self-custodial Solana wallet directly inside the game — no browser extension required.

This repository is the source submission for the **Tether Developer Grant** (see [docs/TETHER_GRANT_PROPOSAL.md](./docs/TETHER_GRANT_PROPOSAL.md)).

## Overview

Players grow crops, fish, mine resources, complete quests and trade in a cozy pixel-art world with multiple maps (home farm, city, garden, fishing area). Progress is saved to the cloud via Supabase and tied to a player-owned wallet.

The wallet layer is the centerpiece of this submission:

- **WDK self-custodial wallet** — a BIP-39 seed phrase is generated locally on the player's device and a deterministic Solana account is derived with `@tetherto/wdk-wallet-solana` (SLIP-0010 path `m/44'/501'/0'/0'`). The game never sees the private keys.
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

## Tether WDK integration

All WDK code lives in `artifacts/farming-game/src/game/wdkWallet.ts` and is wired into the game through `artifacts/farming-game/src/pages/FarmingGame.tsx`.

| Capability | Implementation |
| --- | --- |
| Seed generation | `WDK.getRandomSeedPhrase(12)` (BIP-39) |
| Account derivation | `WalletManagerSolana` + `getAccount(0)` (SLIP-0010) |
| Balances | `getBalance()` (SOL) and `getTokenBalance(mint)` (LFG SPL) |
| Signing | `account.sign(message)` (Ed25519) for the wallet login handshake |
| Transfers | `account.transfer({ token, recipient, amount })` for in-game LFG transfers |
| Persistence | Seed stored in player's browser storage; wallet reconnects deterministically on page load |

The WDK account is exposed through the same provider adapter the rest of the game expects (address, `publicKey`, `signMessage`), so wallet auth, NFT checks and cloud saves work unchanged for WDK and extension wallets alike.

**Tests:** unit tests in `wdkWallet.test.ts` cover seed generation, deterministic address derivation, seed import, cross-seed isolation, Phantom-compatible `signMessage` and the hex signature format used by the handshake. Full suite: **67 tests passing**.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS 4
- **Mobile:** Capacitor 8 (Android)
- **Blockchain:** Solana (devnet), `@tetherto/wdk`, `@tetherto/wdk-wallet-solana`, `@solana/kit` v3, `@solana/spl-token`, `@solana/web3.js`
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
| `wdkWallet.ts` | WDK self-custodial wallet: seed generation/import, deterministic accounts, balances, transfers |
| `walletHandshake.ts` | Wallet login handshake and Supabase verification |
| `solanaConfig.ts` | Devnet RPC and canonical LFG mint constants |
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
pnpm --filter @workspace/farming-game test    # 67 unit tests
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
| `VITE_WALLET_DAPP_URL` | Yes* | Deployed HTTPS URL (required for mobile wallet deep links) |

All crypto interactions are **devnet-only** during public alpha. The treasury key is optional and must never be committed.

## Security notes

- Private keys never leave the player's device; the WDK seed phrase is stored in the player's browser storage.
- No secrets are committed. `.env` files are git-ignored; only `.env.example` is tracked.
- The `buffer` npm polyfill (required for the browser bundle) fails WDK's `instanceof Uint8Array` check, so `wdkWallet.ts` normalizes `bip39.mnemonicToSeedSync()` output to a plain `Uint8Array` before constructing `WalletManagerSolana`.
- `@solana/kit@3.0.3` is pinned to match `@tetherto/wdk-wallet-solana`'s `@solana/*` v3 dependency set.

## License

MIT
