# Lifetopia World — Farming Game

A web3 farming game built with React + Vite, playable in the browser and as a Capacitor Android app. Solana (devnet) in-game economy backed by **Tether's Wallet Development Kit (WDK)** for self-custodial wallets.

## Highlights

- **Self-custodial wallets via WDK** — no browser extension required. Players get a BIP-39 seed phrase generated locally by `@tetherto/wdk`, with deterministic Solana accounts via `@tetherto/wdk-wallet-solana` (SLIP-0010 `m/44'/501'/i'/0'`).
- **Wallet auth handshake (SIWS-style)** — the game signs a login message with the WDK account and links the wallet to the player's cloud save (Supabase).
- **LFG in-game economy (Solana devnet)** — mint, burn and transfer LFG SPL tokens, NFT checks, and a devnet treasury faucet for testing.
- **No extension, no popups** — the WDK wallet connects silently and deterministically (seamless reload persistence).
- **Extension wallets also supported** — Phantom, Solflare and Backpack via the standard Solana provider adapter.

## Repository layout

```
artifacts/farming-game   Main game (Vite + React + TypeScript + Capacitor)
lib/                     Shared workspace libraries
scripts/                 Workspace tooling
```

Key game modules under `artifacts/farming-game/src/game/`:

| File | Purpose |
| --- | --- |
| `wdkWallet.ts` | WDK self-custodial wallet (create/import seed, sign, balances, transfers) |
| `walletHandshake.ts` | Wallet login/auth + Supabase verification |
| `solanaConfig.ts` | Devnet RPC + canonical LFG mint constants |
| `devnetTransactions.ts` | Devnet faucet/mint/burn hooks for testing |
| `Web3Config.ts` | Phantom / Solflare / Backpack connector |

## Getting started

```bash
pnpm install
pnpm --filter @workspace/farming-game dev
```

Production build:

```bash
pnpm --filter @workspace/farming-game build
pnpm --filter @workspace/farming-game serve
```

Type-check and tests:

```bash
pnpm typecheck
pnpm --filter @workspace/farming-game test
```

### Environment

Copy `artifacts/farming-game/.env.example` to `.env` and fill in your deployment URL. All crypto is devnet-only; the treasury key is optional and should never be committed.

## WDK integration

- **Create wallet**: `connectWdkWallet()` — generates a 12-word BIP-39 seed via `WDK.getRandomSeedPhrase(12)` if none is stored, then instantiates a `WalletManagerSolana` and returns `getAccount(0)`'s address.
- **Sign login**: the account's `sign()` produces the Ed25519 signature used by the game's wallet handshake.
- **Balances**: `getBalance()` (SOL) and `getTokenBalance(mint)` (LFG) through the WDK account API.
- **Transfer**: `account.transfer({ token, recipient, amount })` for in-game LFG transfers.
- **Reload persistence**: the seed is stored in the player's browser storage and the wallet reconnects deterministically on page load.

See `docs/TETHER_GRANT_PROPOSAL.md` for the full implementation notes.
