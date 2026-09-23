# Changelog

All notable changes to StockForge. This entry covers the initial end-to-end
implementation built for the Stocklana hackathon (target deadline 2026-09-25).

## [0.1.0] — 2026-09-23

### 0. Scope decisions (resolving the PRD ↔ review conflict)

The PRD (`stockforge_prd.md`) and the later architecture review (`review.md`)
disagreed. `review.md` is the newer, controlling document, so the build follows
it:

- **Tessera / T-tokens removed.** Integrating any non-PreStocks pre-IPO token
  disqualifies the project from the $10K PreStocks bounty. All pre-IPO exposure
  now comes exclusively from the PreStocks API
  (`https://prestocks.com/api/prestocks`) and its Solana SPL tokens.
- **Baskets decoupled from Meteora DBC.** A basket is now a fully asset-backed
  1:1 Anchor vault, not a bonding-curve pool (which would collect the quote
  currency instead of the underlying equities). Meteora DBC is reserved for a
  separate flagship token launch.
- **Pre-IPO settlement uses an admin-attested price** (the on-chain program has
  no Pyth feed for unlisted companies). **Public equities settle from an
  on-chain Pyth price account.**
- **Settlement is permissionless** ("the crank"): any signer may settle an
  expired option and earns a share of the protocol fee.

### 1. Toolchain & environment

- Installed the full Solana/Anchor toolchain inside **WSL2 Ubuntu 24.04**:
  - Rust 1.92.0 (`rustup`), pinned compiler `1.89.0` for the workspace.
  - Solana CLI 4.1.2 (Agave), configured for devnet and localnet.
  - Anchor CLI 1.2.0 via `avm`, plus `cargo-build-sbf` platform-tools v1.57.
- Notes/workarounds:
  - `apt` was run as WSL root (the user's `sudo` requires a password).
  - The `avm` shim (`anchor -> avm`) failed with "canonicalizing AVM
    executable"; worked around by repointing `~/.avm/bin/anchor` directly at
    `anchor-1.2.0`.
  - A detached `wsl … sleep 1000000` keep-alive session keeps the distro (and
    the local validator) from being torn down between commands.

### 2. On-chain program — `stockforge/programs/stockforge/`

Anchor 1.2.0 (modular layout). Program ID (localnet/devnet):
`E4t7DUwrLKgxpGb88686DtqrRqnHd5GCKE3ASwR8SCwi`.

**State (`src/state.rs`)**
- `Config` — `admin`, `treasury`, `quote_mint`, `pyth_program`, `fee_bps`, `bump`.
- `OptionContract` — `id`, `writer`, `buyer`, `underlying_mint`,
  `collateral_mint`, `premium_mint`, `option_type`, `status`, `strike`, `size`,
  `premium`, `collateral_amount`, `expiry`, `settled_price`, `vault`, `bump`.
- `OptionType { Put, Call }`, `OptionStatus { Open, Active, Settled, Cancelled }`,
  `PriceSource { Pyth, Admin }`.
- `Basket` — `creator`, `nonce`, `share_mint`, `name`, `components`, `total_units`.
- `BasketComponent { mint, amount_per_unit, weight_bps }`.
- All prices/strikes/quote amounts use **6 decimals** (`PRICE_DECIMALS`); one
  basket unit = `BASKET_UNIT` (1e6) shares.

**Instructions (`src/instructions/`)**
- `initialize_config` — creates `Config`; validates `fee_bps ≤ 1000`.
- `list_option` — writer escrows collateral. Puts must be collateralised in the
  quote mint to `size × strike / 1e6` (worst case price = 0); calls escrow the
  underlying and require `collateral ≥ size`.
- `buy_option` — transfers premium to the writer and flips status to `Active`.
- `settle_option` — permissionless; requires an `admin` signer equal to
  `config.admin` and a `price_timestamp` within `MAX_ADMIN_PRICE_AGE` (1h).
- `settle_option_pyth` — permissionless; validates the price account owner
  against `config.pyth_program`, parses a classic Pyth `PriceAccount`, enforces
  freshness, and scales to 6dp.
- `cancel_option` — writer refunds an unsold listing before expiry.
- `create_basket` — validates 1–8 unique components, weights summing to 10000
  bps, and creates the share mint (PDA, 6 decimals).
- `mint_basket` — lazily creates per-component vault ATAs (authority = basket
  PDA), deposits the recipe, and mints shares 1:1.
- `redeem_basket` — burns shares and withdraws the proportional underlying.

**Oracle (`src/pyth.rs`)** — defensive, dependency-free classic Pyth price
parsing (magic, feed type, exponent, publish time, aggregate price/status) with
`scale_to_6dp`. No third-party Pyth SDK, avoiding Solana-version conflicts.

**Settlement math (`src/instructions/settle.rs`)** — a shared `settle` helper:
- Put ITM payout = `min(size × (strike − spot) / 1e6, distributable)`.
- Call ITM payout = `min(size, distributable)` (writer's escrowed underlying).
- Protocol fee = `collateral × fee_bps / 10000`, split half to the crank caller
  (incentive) and half to the treasury; the remainder is distributed.
- Uses `u128` intermediate math and checked arithmetic; emits `OptionSettled`.

**Build hardening**
- Added `anchor-spl` with `token`, `associated_token`, and `idl-build` features.
- Migrated to Anchor 1.2.0 API changes: `CpiContext::new(Pubkey, …)` (program id
  instead of `AccountInfo`), `Context<'info, T>` single-lifetime contexts, and
  `InterfaceAccount` field access via deref.
- Removed `#[constant]` from `usize` constants so the IDL builder accepts them.

### 3. Verification — `stockforge/app/scripts/seed.ts`

An end-to-end script (run with `tsx`) that both seeds the UI and serves as the
integration test. Against a fresh local validator it performed:
1. Created demo mints (USDC + NVDA/MSFT/AAPL), funded accounts, initialised
   `Config`, and created treasury/keeper wallets.
2. **Options**: listed a cash-secured NVDA put (strike $120) → bought it →
   waited for expiry → settled ITM with an admin price of $100. Buyer USDC went
   `1000 → 1007` after paying both premiums and receiving the put payout
   (verified money conservation). Also listed a covered MSFT call and left an
   AAPL put active.
3. **Basket**: created "AI Titans" (NVDA 40% / MSFT 35% / AAPL 25%), minted
   1 unit (2 NVDA + 1 MSFT + 3 AAPL), and redeemed 0.25 units (shares 1 → 0.75).
4. Wrote `app/public/registry.json` (mint↔symbol map + addresses) for the UI.

### 4. Frontend — `stockforge/app/` (Next.js 14 + Tailwind)

- **Wallet**: Solana wallet adapter with Phantom + Solflare (the all-wallets
  meta-package was dropped — it pulled a multi-GB WalletConnect/viem tree and
  exhausted the disk).
- **Options desk** (`src/components/OptionsDesk.tsx`): live on-chain listings,
  a write form (type / underlying / strike / size / premium / expiry with
  auto-computed collateral), buy, one-click permissionless settle, and a demo
  faucet button.
- **Basket ETFs** (`src/components/Baskets.tsx`): composer for 1–8 weighted
  components, create / mint / redeem, live share balances, and NAV per unit
  computed from oracle prices.
- **Markets** (`src/components/StockForgeApp.tsx`): live PreStocks catalogue
  and Pyth equity feed discovery.
- **Libraries**: `pda.ts`, `format.ts`, `program.ts`, `hooks.tsx`
  (`useProgram/useConfig/useOptions/useBaskets/usePriceMap`), `prices.ts`
  (`resolvePrice` → PreStocks → Pyth → indicative fallback), `tx.ts` (ATA
  helpers), `server.ts` (Node-side program + keypair), `polyfill.ts` (Buffer).
- **API routes**: `POST /api/faucet` mints demo assets to a connected wallet;
  `POST /api/settle` runs the settlement crank server-side (admin attestation +
  a freshly funded keeper), using `resolvePrice` for the settlement price.
- `next build` passes (static `/`, dynamic API routes) and `tsc --noEmit` is
  clean.

### 5. Artifacts & files added

```
stockforge/
  Anchor.toml, Cargo.toml, Cargo.lock, rust-toolchain.toml
  setup/{start_localnet.sh,deploy.sh}
  programs/stockforge/
    Cargo.toml
    src/{lib.rs,constants.rs,error.rs,state.rs,pyth.rs,instructions.rs}
    src/instructions/{initialize_config,list_option,buy_option,settle,
                     cancel_option,create_basket,mint_basket,redeem_basket}.rs
  app/
    package.json, next.config.mjs, tsconfig.json, tailwind.config.ts,
    postcss.config.mjs
    scripts/seed.ts
    public/registry.json
    src/idl/stockforge.json
    src/lib/{constants,pda,format,program,hooks,prices,tx,server,polyfill}.ts
    src/components/{StockForgeApp,OptionsDesk,Baskets,WalletProviders,ui}.tsx
    src/app/{layout,page}.tsx, globals.css
    src/app/api/{faucet,settle}/route.ts
```

### 6. How to run

```bash
# 1. Start a local validator (WSL)
bash stockforge/setup/start_localnet.sh

# 2. Build & deploy the program (WSL)
bash stockforge/setup/deploy.sh

# 3. Seed demo data + registry.json
npm run seed --prefix stockforge/app

# 4. Run the UI
npm run dev --prefix stockforge/app      # http://localhost:3000
```

### 7. Known limitations & remaining work

- **Devnet deployment is blocked.** The public devnet faucet is IP rate-limited,
  so the project currently targets a local validator for a reliable demo. The
  CLI key `EsGwoTWAdTsjPRQhhbquq1qRthCJBr7RAxzGM5t28mBi` needs funding for a
  devnet deploy.
- **Pyth hosted price endpoint requires an API key.** `hermes.pyth.network`
  returns `unauthorized` for `/v2/updates/price/latest`; the UI therefore falls
  back to indicative prices for public equities unless
  `NEXT_PUBLIC_PYTH_API_KEY` is set. Feed **discovery** still works, and the
  on-chain `settle_option_pyth` path is complete but untested against a live
  feed.
- **Meteora DBC flagship launch** (for the $5K Meteora bounty) is not yet
  implemented.
- **Program-side hardening not done**: an admin can still redirect the `treasury`
  token account on settlement (the account is caller-supplied, only constrained
  by collateral mint), there is no `create_basket` fee/dust guard, and there are
  no negative-path unit tests yet. Suggested follow-ups: constrain treasury to
  `config.treasury`'s ATA, add `litesvm` tests for each instruction, and add
  adversarial cases (expired-without-buyer, capped payouts, duplicate accounts).
- **UI polish**: no transaction history/portfolio view yet; prices poll on
  intervals rather than streaming; no automated wallet/demo walkthrough.
- **PreStocks assets are not yet tradable on-chain** — the demo underlyings are
  self-minted USDC/NVDA/MSFT/AAPL. Wiring the real PreStocks SPL token addresses
  (from the API `contract_address`) as option/basket underlyings is a
  drop-in next step.
