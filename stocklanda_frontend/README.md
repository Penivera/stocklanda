# StockForge — Frontend

Next.js app for **StockForge**: a peer-to-peer options desk and asset-backed
basket ETFs for tokenized equities on Solana, plus the Meteora Dynamic Bonding
Curve flagship launch.

This app talks to the Anchor program in [`../stockforge`](../stockforge).

## Stack

| Layer | Tech |
| :--- | :--- |
| Framework | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript |
| Styling | Tailwind CSS 4 |
| Chain | `@anchor-lang/core`, `@solana/web3.js`, `@solana/spl-token` |
| Wallet | Solana Wallet Adapter (Phantom, Solflare) |
| Pricing | PreStocks API → Pyth Hermes → indicative fallback |
| Launchpad | `@meteora-ag/dynamic-bonding-curve-sdk` |

## Screens

| Route | Purpose |
| :--- | :--- |
| `/` | Portfolio dashboard — on-chain balances, option/basket stats, recent activity |
| `/options` | P2P options desk — write puts/calls, buy, permissionless settle |
| `/basket` | ETF basket composer — weighted recipe, mint/redeem 1:1 asset-backed shares |
| `/launchpad` | Meteora DBC flagship (`$FORGE`) — live pool state, buy/sell |

Server routes: `POST /api/faucet` (mint demo assets), `POST /api/settle`
(settlement crank), `GET|POST /api/flagship` (DBC state + unsigned swaps).

## Getting started

```bash
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_RPC_URL (defaults to devnet)
npm run dev                    # http://localhost:3000
```

### Environment

| Variable | Purpose |
| :--- | :--- |
| `NEXT_PUBLIC_RPC_URL` | Cluster the app + wallet adapter talk to (default: devnet) |
| `NEXT_PUBLIC_PYTH_API_KEY` | Optional Pyth Hermes key; without it, public-equity prices fall back to indicative values |
| `KEYPAIR_PATH` | Server-side admin/deployer keypair for API routes (default: `~/.config/solana/id.json`) |
| `RPC_URL` | Cluster used by the `seed` / `launch:flagship` scripts |

### Devnet bootstrap

The on-chain UI is empty until the program is deployed and `public/registry.json`
exists. With a funded keypair:

```bash
# 1. Deploy the Anchor program (see ../stockforge/setup)
# 2. Create mints, config and demo options/baskets; writes public/registry.json
RPC_URL=https://api.devnet.solana.com npm run seed

# 3. Launch the Meteora DBC flagship; writes public/flagship.json
RPC_URL=https://api.devnet.solana.com npm run launch:flagship
```

`seed.ts` targets whatever `RPC_URL` points at (defaults to devnet). The DBC
program only exists on devnet/mainnet, so `launch:flagship` must not run against
a local validator.

## Architecture notes

- `src/lib/hooks.ts` — all chain reads (`useProgram/useRegistry/useConfig/useOptions/useBaskets/usePriceMap`).
- `src/lib/program.ts`, `pda.ts`, `tx.ts`, `prices.ts` — program factory, PDAs, ATA helpers, price resolution.
- `src/lib/flagship.ts` — server-only DBC curve config; never import from a client component.
- `src/lib/server.ts` — server-only program/keypair factory + registry readers.

Per `review.md` §3, ETF baskets are **1:1 asset-backed vaults** and are
deliberately decoupled from the Meteora DBC launch (which is a separate flagship
token). Tessera / non-PreStocks pre-IPO tokens are intentionally excluded for
PreStocks bounty eligibility.

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run seed` | Seed mints/config/options/basket + `registry.json` |
| `npm run launch:flagship` | Launch the Meteora DBC `$FORGE` pool |
