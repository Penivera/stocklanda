# StockForge

**On-chain derivatives and structured products for tokenized equities on Solana — options, asset-backed ETFs, and a Meteora Dynamic Bonding Curve launch.**

| | |
|---|---|
| **Live app** | https://stockforge.usebantr.site |
| **Network** | Solana **devnet** |
| **Program ID** | `5qNeAcUKD45g3T5osCLVk13Q8CZLtT7BWhivG5og9CMf` |
| **Hackathon** | Stocklana |
| **Bounty targets** | Main Track · PreStocks · Meteora DBC · Pyth Network |

---

## Table of contents

1. [The problem](#the-problem)
2. [The solution](#the-solution)
3. [Live deployment](#live-deployment)
4. [How it works](#how-it-works)
5. [Architecture](#architecture)
6. [Repository layout](#repository-layout)
7. [Running locally / devnet bootstrap](#running-locally--devnet-bootstrap)
8. [Deploying (Docker / Coolify)](#deploying-docker--coolify)
9. [Bounty alignment](#bounty-alignment)
10. [Design decisions & compliance](#design-decisions--compliance)
11. [Roadmap & known limitations](#roadmap--known-limitations)

---

## The problem

Tokenized equities (pre-IPO and public) can now be bought and sold on Solana 24/7. But a holder can only do one thing with them: **hold or sell**. There is no on-chain way to:

- **Hedge downside risk** with an options contract.
- **Earn yield** by writing covered calls against a position.
- **Pool assets into a composable index** (a custom "ETF") that others can subscribe to and that can itself be used as collateral.

The result is **dead capital**: tokenized equity sits idle without the derivatives and structured products that make equity functional and liquid. Traditional equity options also stop trading after market hours — they cannot serve a market that never closes.

## The solution

StockForge delivers **two interconnected primitives** plus a **flagship launch**, all in one interface:

### 1. P2P Options Desk

- **Writers** lock collateral to list fully-collateralised **puts** (cash-secured in USDC) or **calls** (covered by the underlying token) at a fixed strike and expiry.
- **Buyers** pay an upfront premium; the contract goes live in on-chain escrow.
- **Settlement is permissionless** (a "crank"): anyone can settle an expired option and earns a share of the protocol fee.
- **Pricing** comes from an oracle: **Pyth** for public equities, and an **admin-attested price** for unlisted pre-IPO assets that have no on-chain feed.
- **24/7**: because settlement is on-chain and oracle-driven, contracts resolve without market-open restrictions or KYC.

### 2. Asset-backed Basket ETFs

- Any user defines a weighted basket of tokenized stocks (e.g. *"AI Titans"*: 40% NVDA / 35% MSFT / 25% AAPL) and mints a single SPL share token.
- The basket is a **1:1 asset-backed Anchor vault** — to mint, you deposit the exact underlying tokens; to exit, you burn shares and withdraw your pro-rata share. The vault always holds the real assets.
- **Live NAV** is computed from oracle prices, weighted across the components.

### 3. The differentiator: options on baskets

Because a basket token is a standard SPL token, it is a valid underlying for the options desk. **You can hedge an entire themed portfolio — e.g. SpaceX + OpenAI + NVDA — in a single on-chain trade.** There is no existing on-chain mechanism to write a put on a custom bundle of pre-IPO equities.

### 4. Meteora DBC flagship launch

Separately from the ETF vaults, StockForge launches a flagship *StockForge Governance* (`$FORGE`) token on **Meteora's Dynamic Bonding Curve** with equity-like curve mechanics (linear fee scheduler, dynamic fees, custom DAMM v2 graduation tier, permanently locked LP).

## Live deployment

Everything below is deployed and verifiable on **devnet**.

| Component | Address |
|---|---|
| Program | `5qNeAcUKD45g3T5osCLVk13Q8CZLtT7BWhivG5og9CMf` |
| Config (PDA) | `HTiuEo46kCeL59LG61Asg2fp7xo2hZJB73RBLEzG73BF` |
| USDC (quote) mint | `AJqUVbJea3kxcSg6kcytNZRZr821X97LgdeJYGf72Um3` |
| NVDA mint | `CjkuNJfuyi6yjMGLQehzzQSvG6jaTpPFMJGwPnvTwzs` |
| MSFT mint | `qZYDpLbTUxPozzfriYbvTFtD18Kjb6N8CeTaL6Qcac1` |
| AAPL mint | `9BJg4u5Zyu6DAmTde5vVjWod5MQKBMj2SdhHwMRsnYHm` |
| Option — NVDA PUT (settled ITM) | `CTypWYQuokKmFsZD91EFMCkEWdZXpfij766TJor2fBZz` |
| Option — MSFT CALL (open) | `GZ79qFgRBePnbGrqoGQWwtkm1UsFBCk3er1mGzPfZqwv` |
| Option — AAPL PUT (active) | `3sYzZDJkjGTx2KvcnHXDp212N7yWHFVsDXQeAhsCcsA3` |
| Basket — "AI Titans" | `9wqFM4Wkj2UUZky4NtHLEugitXNDmHjQ9X5ZdKJjJCY5` |
| Basket share mint | `CGzeZ6FAefidzT8xLhvzT4uNyBxdvbMN7NSh8k7CBCLj` |
| `$FORGE` DBC config | `3yNTNwsKpapaSjiCRokfdXWLL1ZUx6ydg1cReV1U8y85` |
| `$FORGE` mint | `64BE8j4P9PYQ8akS91zDPYCQ3FtW5wXoDfUasLERpm2` |
| `$FORGE` pool | `9J1T4T71yoW14FXJRb2m8AqgWR9eK1FedKXaJv9HEMck` |

The end-to-end lifecycle has been exercised on devnet: an NVDA put was listed → bought → settled **in-the-money** (buyer USDC `1000 → 1007`), and the "AI Titans" basket was created → minted (1 unit) → redeemed (0.25).

## How it works

### Flow A — Options ("Panic Put")

```
[Writer] ──► locks collateral (USDC for puts / underlying for calls), sets strike + expiry
      │
[Buyer]  ──► pays premium; funds held in on-chain escrow
      │
[Oracle] ──► Pyth price account (public equities)  ·  admin-attested price (pre-IPO)
      │
[Settle] ──► permissionless crank at expiry
        ──► ITM:  buyer receives payout from locked collateral
        ──► OTM:  writer reclaims collateral + keeps premium
```

Protocol fee = `collateral × fee_bps / 10000`, split half to the crank caller (incentive to settle) and half to the treasury.

### Flow B — Baskets ("Group ETF")

```
[Creator] ──► composes 1–8 weighted components, names the basket
      │
[Program] ──► creates the basket PDA + share mint
      │
[Users]   ──► deposit the underlying recipe into the vault, receive shares 1:1
      │
[Redeem]  ──► burn shares → withdraw the proportional underlying
```

### Flow C — Flagship launch (Meteora DBC)

```
[Partner]  ──► createConfig (linear fee scheduler 300→50 bps, dynamic fees)
[Creator]  ──► createPool ($FORGE / SOL)  ·  locked LP  ·  DAMM v2 graduation at 5 SOL
[Traders]  ──► buy/sell against the curve (unsigned tx built server-side, signed in-wallet)
```

## Architecture

```
┌──────────────────────────── Solana (devnet) ────────────────────────────┐
│  Anchor program: stockforge                                             │
│   • Options: list_option · buy_option · cancel_option                   │
│              settle_option (admin price) · settle_option_pyth (Pyth)    │
│   • Baskets: create_basket · mint_basket · redeem_basket                │
│   • State:   Config · OptionContract · Basket                           │
│   • Oracle:  dependency-free classic Pyth PriceAccount parser           │
└───────────────▲───────────────────────────────▲─────────────────────────┘
                │ RPC / transactions            │ unsigned swap tx
┌───────────────┴───────────────┐   ┌───────────┴─────────────────────────┐
│  Frontend — Next.js 16        │   │  Meteora Dynamic Bonding Curve      │
│   • Options desk              │   │   • $FORGE launch config + pool      │
│   • Basket composer           │   └─────────────────────────────────────┘
│   • Launchpad (flagship)      │
│   • Dashboard                 │   Server routes:
│   • API: /api/{faucet,settle, │   • faucet   (mint demo assets)
│          registry,flagship}   │   • settle   (permissionless crank)
└───────────────┬───────────────┘   • registry (chain metadata)
                │
        PreStocks API  ·  Pyth Hermes  ·  Solana Wallet Adapter
```

| Layer | Technology | Purpose |
|---|---|---|
| Core program | **Anchor 1.2 / Rust** | Options escrow + settlement, basket vaults |
| Oracle (public equities) | **Pyth** | On-chain price accounts for settlement |
| Oracle (pre-IPO) | **Admin-attested price** | No Pyth feed exists for unlisted companies |
| Basket pools | **Anchor 1:1 vaults** | Fully asset-backed issuance/redemption |
| Flagship launch | **Meteora DBC SDK** | Curved token launch + DAMM v2 graduation |
| Pre-IPO catalogue | **PreStocks API** | Metadata, prices, SPL token addresses |
| Frontend | **Next.js 16 · React 19 · Tailwind 4** | Dashboard, options, baskets, launchpad |
| Wallet | **Solana Wallet Adapter** | Phantom, Solflare |
| Deployment | **Docker · Coolify** | Frontend hosting on a VPS |

## Repository layout

```
stocklanda/
├── stockforge/                 # Solana/Anchor workspace
│   ├── programs/stockforge/    # ← the on-chain program (Rust)
│   └── app/                    # original reference web app (Next.js 14)
├── stocklanda_frontend/        # ← the shipped frontend (Next.js 16) + Dockerfile
│   ├── src/app/                #   dashboard · options · basket · launchpad · api/*
│   ├── src/lib/                #   hooks · program · pda · tx · prices · flagship · server
│   └── scripts/                #   seed.ts · launch-flagship.ts
├── docker-compose.yml          # Coolify compose
├── docker-compose.selfhost.yml # plain-VPS compose
├── stockforge_prd.md           # product requirements
├── review.md                   # architecture review / bounty strategy
└── changelog.md                # implementation log
```

> `stockforge/programs` is the only piece that goes on-chain. Both web apps talk to it through the generated IDL (`src/idl/stockforge.json`).

## Running locally / devnet bootstrap

**Prerequisites:** Node 20+, Rust + Solana CLI + Anchor 1.2 (for the program), a funded devnet keypair.

```bash
# Program
cd stockforge
anchor build
anchor deploy --provider.cluster devnet

# Frontend
cd ../stocklanda_frontend
npm install
cp .env.example .env.local        # NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com

# Seed mints, config, options and a basket -> public/registry.json
RPC_URL=https://api.devnet.solana.com npm run seed

# Launch the Meteora DBC flagship -> public/flagship.json
RPC_URL=https://api.devnet.solana.com npm run launch:flagship

npm run dev                       # http://localhost:3000
```

The `seed` script is a full integration test: it creates mints + config, lists/buys/settles an ITM put, lists a covered call, and creates/mints/redeems a basket.

## Deploying (Docker / Coolify)

The repo ships a multi-stage `stocklanda_frontend/Dockerfile` and a Coolify compose file.

- **Coolify:** Build Pack **Docker Compose** (repo root). Set the domain, `SERVICE_PORT_WEB=3000`, `NEXT_PUBLIC_RPC_URL` as a build variable, and a host data dir mounted at `/data` holding `id.json`, `registry.json`, `flagship.json`.
- **Plain VPS:** `docker compose -f docker-compose.selfhost.yml up -d --build`.

See `stocklanda_frontend/README.md` for the full walkthrough.


## Design decisions 


- **Baskets decoupled from Meteora DBC.** A bonding-curve pool would collect the *quote currency* rather than the underlying equities, breaking the 1:1 promise of an ETF. Baskets are Anchor vaults; the DBC is reserved for the separate `$FORGE` flagship.
- **Dual settlement routing.** Public equities settle from an on-chain **Pyth** price account; pre-IPO assets settle from an **admin-attested** price (with a freshness window), because no Pyth feed exists for unlisted companies.
- **Permissionless settlement.** Solana programs can't run on a timer, so settlement is a permissionless crank with an incentive split, ensuring expired contracts get resolved.
- **`buy_option` rejects buying your own option** (`CannotBuyOwnOption`).

## Roadmap & known limitations

- **Wire real PreStocks SPL mints** (from the API `contract_address`) as option/basket underlyings — the plumbing exists; the demo currently uses self-minted USDC/NVDA/MSFT/AAPL.
- **Program hardening:** constrain the settlement `treasury` account to `config.treasury`'s ATA; add `litesvm` negative-path tests (expired-without-buyer, capped payouts, duplicate accounts).
- **Pyth Hermes** live pricing requires `NEXT_PUBLIC_PYTH_API_KEY`; without it the UI falls back to indicative prices (feed discovery still works).
- **Post-v1 product scope:** options spreads/straddles, a secondary options market, and auto-rebalancing baskets.
- **Ops:** transaction history / portfolio P&L view; streaming prices instead of polling.

## Contributors

Built for the Stocklana hackathon by **Edmund Antai (Devonlegend)**, **ohotuowo-morgan**,**Peniel Ben (Penivera)**, and **precious**.

## License

MIT
