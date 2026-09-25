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

## Docker / VPS deployment

A `Dockerfile` and a repo-root `docker-compose.yml` are provided.

```bash
# from the repo root
mkdir -p secrets data
cp /path/to/devnet/id.json secrets/id.json   # deployer/admin keypair (never baked into the image)

docker compose up -d --build                 # serves on :3000
```

The compose file mounts `./secrets` (read-only, keypair) and `./data`
(`registry.json`, `flagship.json`) and points the server at them via
`KEYPAIR_PATH` / `REGISTRY_PATH` / `FLAGSHIP_PATH`, so chain metadata can be
updated without rebuilding. `NEXT_PUBLIC_RPC_URL` and `NEXT_PUBLIC_PYTH_API_KEY`
are passed as build args (they are inlined into the client bundle).

One-off admin jobs run in the same image:

```bash
docker compose --profile admin run --rm admin npm run seed
docker compose --profile admin run --rm admin npm run launch:flagship
```

Notes:
- The image is a non-standalone Next.js build (full `node_modules`) for
  robustness with the dynamic server routes; expect a ~1 GB image.
- `next/font/google` fetches fonts during `docker build`, so the builder needs
  outbound network access.
- The `web` container exposes `/api/faucet`, `/api/settle` and `/api/flagship`,
  which use the mounted keypair. Keep that key funded and treat the container as
  privileged infrastructure.

## Deploying with Coolify

This is a monorepo (`stockforge/` + `stocklanda_frontend/`), so use the
**Dockerfile** build pack with the correct base directory.

1. **New Resource** → *Public/Private Repository* → this repo + the branch to deploy.
2. **Build Pack: Dockerfile**
   - **Base Directory:** `/stocklanda_frontend`
   - **Dockerfile Location:** `/Dockerfile`
   - **Port:** `3000` (matches `EXPOSE`; the container honors Coolify's `PORT`)
3. **Build Variables** (inlined at build time — `NEXT_PUBLIC_*` must be set here, not only at runtime)
   - `NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com`
   - `NEXT_PUBLIC_PYTH_API_KEY=` (optional)
4. **Persistent Storage** — mount one volume at **`/data`** and place:
   - `/data/id.json` — deployer/admin keypair (required by `/api/faucet`, `/api/settle`, `/api/flagship`)
   - `/data/registry.json` — written by `npm run seed`
   - `/data/flagship.json` — written by `npm run launch:flagship`

   The image already defaults `KEYPAIR_PATH`, `REGISTRY_PATH`, and `FLAGSHIP_PATH`
   to those paths, so no runtime env wiring is needed for storage.
5. **Environment Variables** — add `RPC_URL=https://api.devnet.solana.com` (used by the admin scripts).
6. **Domain** — attach a domain; Coolify's proxy fronts container port `3000`.
7. **Deploy.** For first-time admin jobs open the container **Terminal**:
   ```bash
   npm run seed            # -> /data/registry.json
   npm run launch:flagship # -> /data/flagship.json
   ```

Notes:
- The Dockerfile's `HEALTHCHECK` hits `/`, so Coolify's health check works as-is.
- The container runs as uid `1001`; make sure `/data/id.json` (and the JSON
  metadata) are readable by it, e.g. `chmod 644 /data/id.json`.
- Because `NEXT_PUBLIC_*` is compiled into the client bundle, changing the RPC URL
  requires a **rebuild** (not just an env change + restart).
- Coolify's Docker Compose build pack is not required here; the Dockerfile pack is
  simpler and avoids the repo-relative bind mounts in `docker-compose.yml`.
