# StockForge — Consolidation & Submission Plan

| Metadata | Details |
| :--- | :--- |
| **Repo** | `github.com/Penivera/stocklanda` |
| **Deadline** | 2026-09-25 |
| **Status** | Decisions locked; work starting on a branch |
| **Baseline** | `origin/main` @ `b8576f2` |
| **Canonical frontend** | `stocklanda_frontend/` (as directed) |
| **Target** | Real Solana **devnet** deployment |
| **Author shorthand** | **D** = Devonlegend (program + `stockforge/app`) · **M** = ohotuowo-morgan (`stocklanda_frontend`) · **U** = unassigned |

> This is the working plan. It supersedes the first draft and incorporates the
> review of `stocklanda_frontend` gaps/errors (§5).

---

## 1. Current state (verified)

All remotes fetched and pruned. Local `main` at `b8576f2`; both feature branches
exist locally as tracking branches.

| Branch | HEAD | vs `main` | Owner |
| :--- | :--- | :--- | :--- |
| `main` / `origin/main` | `b8576f2` | — | D |
| `origin/feature/hackathon-demo` | `752956c` | 3 behind, 5 ahead | M |
| `origin/stocklanda_frontend` | `4bc9215` | 3 behind, 4 ahead | M |

- `feature/hackathon-demo` = `stocklanda_frontend` **+ 1 commit** (demo store + handoff doc).
- Both frontend branches predate PR #2's Flagship/Meteora work.
- Merge of `feature/hackathon-demo` into `main` is **path-disjoint** (frontend adds
  `stocklanda_frontend/`; main only touched `changelog.md` + `stockforge/app/`), so
  it should be conflict-free.

Merged PRs: **#1** `dee3170` (v0.1.0 backend + app), **#2** `b8576f2` (Meteora DBC
flagship `$FORGE`).

Two parallel frontends:

| | `stockforge/app/` (main) | `stocklanda_frontend/` (chosen) |
| :--- | :--- | :--- |
| Next / React / Tailwind | 14 / 18 / 3 | 16 / 19 / 4 |
| Web3 | Real Anchor + RPC | Zustand mock (airgapped) |
| Assets | NVDA/MSFT/AAPL (PreStocks-compliant) | SPACEX/OPENAI/ANTHROPIC… (Tessera-flavored) |
| Meteora | ✅ DBC flagship (PR #2) | ❌ fake "DLMM" launchpad |
| Seed tooling | ✅ `scripts/seed.ts`, `registry.json` | ❌ none |

---

## 2. Decisions locked

| # | Decision | Source |
| :--- | :--- | :--- |
| D1 | `stocklanda_frontend/` is the canonical UI, merged onto `main` | user |
| D2 | Target a **real devnet** deployment (not the airgapped demo) | user |
| D3 | The agent executes the consolidation on a branch + PR | user |
| D4 | Remove the Zustand mock path (implied by D2) | derived |
| D5 | Tessera / T-tokens stay removed for PreStocks compliance | `review.md` §2 |

---

## 3. Track selection

| Track | Prize | Submit? |
| :--- | :--- | :--- |
| **Main Track** | $100K pool | ✅ |
| **PreStocks** | $10K | ✅ (requires 100% PreStocks) |
| **Meteora DBC** | $5K | ✅ |
| Tessera | $6K | ❌ dropped (D5) |
| Pyth | 3mo Pro (non-cash) | ➕ bonus, strengthens Main |

**Recommended three: Main + PreStocks + Meteora DBC, with Pyth as a bonus.**

### The frontend ↔ Tessera conflict

There is no literal "Tessera" reference in `stocklanda_frontend`, but its whole demo
asset identity is Tessera-flavored pre-IPO tokens:

- `demoStore.ts` L156–164: `SPACEX, OPENAI, ANTHROPIC, ANDURIL, STRIPE, FIGUREAI`
- `prices.ts` L81–93 + `basket/page.tsx` L65–74: SpaceX, OpenAI, Anthropic,
  Anduril, Stripe, Figure AI, Kalshi, Neuralink…

Meanwhile `stockforge/app` seeds PreStocks-compliant **NVDA/MSFT/AAPL**. So the
frontend leans **toward the Tessera pre-IPO narrative + a Meteora launch**, which
directly collides with `review.md`'s PreStocks-only rule.

**Implication:** if we submit PreStocks, the frontend's demo catalogue must be
swapped to official PreStocks SPL tokens. The plumbing already exists
(`fetchPrestocks`, `resolvePrice`, `contract_address`), so this is a data/narrative
swap, not a rewrite. The Meteora launchpad must likewise be replaced by the real
**DBC** flow ported from PR #2.

---

## 4. Target end state

One canonical Next.js app on `main` that:

- is `stocklanda_frontend/` (Next 16 / React 19 / Tailwind 4) with **real Anchor**
  hooks and transactions (no mock store),
- carries the **PreStocks-compliant** asset catalogue,
- includes the **Meteora DBC flagship** ported from `stockforge/app`,
- has working seed + registry tooling and env documentation for devnet.

---

## 5. Frontend gaps & errors (tracked)

Severity: **P0** blocks real devnet · **P1** correctness/config · **P2** polish.

### A. Blocking — the app is entirely mocked (P0)

| ID | Gap | Location |
| :--- | :--- | :--- |
| A1 | `useProgram()` returns an inert Proxy | `src/lib/hooks.ts` L97–112 |
| A2 | `useConfig()` returns hardcoded fake | `src/lib/hooks.ts` L114–122 |
| A3 | `useRegistry()` returns hardcoded `DEMO_REGISTRY` of fake pubkeys | `src/lib/hooks.ts` L67–91 |
| A4 | `useOptions()` / `useBaskets()` read Zustand | `src/lib/hooks.ts` L159–195 |
| A5 | `usePriceMap()` returns static `DEMO_PRICES`, no Pyth/PreStocks fetch | `src/lib/hooks.ts` L209–226 |
| A6 | All write paths call `useDemoStore.getState()` | `options/page.tsx` L86–149; `basket/page.tsx` L150–224 |
| A7 | Wallet/balances/activity sourced from Zustand | `page.tsx`, `basket/page.tsx`, `options/page.tsx`, `Header.tsx` |
| A8 | `src/store/demoStore.ts` must be removed/flagged | `src/store/demoStore.ts` |

> The real hook implementations already exist on `main` at
> `stockforge/app/src/lib/hooks.ts` — port them.

### B. Missing devnet bootstrap assets (P0)

| ID | Gap |
| :--- | :--- |
| B1 | No `public/registry.json` → `readRegistry()` returns null → faucet/settle fail |
| B2 | No `scripts/seed.ts` and no `seed` npm script |
| B3 | No flagship/DBC: `lib/flagship.ts`, `api/flagship/route.ts`, `Flagship.tsx`, `scripts/launch-flagship.ts`; `@meteora-ag/dynamic-bonding-curve-sdk` not in deps |
| B4 | No `.env.example` (`NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_PYTH_API_KEY`, `KEYPAIR_PATH`) |

### C. Config / portability (P1)

| ID | Gap | Location |
| :--- | :--- | :--- |
| C1 | `RPC_URL` defaults to `http://127.0.0.1:8899` (must be devnet) | `src/lib/constants.ts` L7–8 |
| C2 | `KEYPAIR_PATH` hardcoded WSL path | `src/lib/server.ts` L8–10 |
| C3 | Keeper funded via `connection.requestAirdrop` (rate-limited on devnet) | `api/settle/route.ts` L62 |
| C4 | `next.config.ts` missing node-builtin webpack fallbacks (`fs/path/os/crypto`) present on main | `next.config.ts` |
| C5 | `buffer` imported by `polyfill.ts` but not a declared dependency | `src/lib/polyfill.ts`, `package.json` |

### D. UI / logic bugs (P1–P2)

| ID | Bug | Location |
| :--- | :--- | :--- |
| D-1 | Font variable mismatch: layout sets `--font-space`/`--font-mono`, CSS reads `--font-space-grotesk`/`--font-jetbrains-mono` → fonts fall back | `layout.tsx` L9–10 vs `globals.css` L5–6 |
| D-2 | Launchpad is a no-op (`setTimeout` + fake success), and says **DLMM** not **DBC** | `launchpad/page.tsx` L69–81 |
| D-3 | Dashboard hardcodes Active Options `0`, P&L `+$0.00`, "Demo Mode" | `page.tsx` L135–158 |
| D-4 | Mock basket exposes `totalSupply`; real account is `totalUnits` | `hooks.ts` L187 vs IDL |
| D-5 | `DEMO_MINTS` random `fakePubkey()` per load (invalid keys, SSR mismatch) | `demoStore.ts` L156–164 |
| D-6 | Zustand `persist` + SSR → hydration-mismatch risk (only `Header` guards `mounted`) | `page.tsx`, `basket/page.tsx` |
| D-7 | Unused imports (lint fail): `token` (options), `usd` (basket), `shortKey` (dashboard) | page L10 / L12 / L10 |
| D-8 | Handoff doc says own-option guard is commented out, but `demoStore.ts` L326 enforces it | doc drift |
| D-9 | Demo settle math mixes units; marks SETTLED for callers who are neither writer nor buyer | `demoStore.ts` L358–423 |

### E. Environment blocker (agent)

| ID | Blocker |
| :--- | :--- |
| E1 | This environment has no `node`, `npm`, `rustc`, `anchor`, or `solana`. The agent can edit/merge/port code but **cannot** install, build, typecheck, lint, or deploy. Builds/deploys must run on D/M's machine. |

---

## 6. Tasks

### Phase 0 — Sync (DONE)
P0-1 fetch + prune + local tracking branches ✅ · P0-2 main at `b8576f2` ✅

### Phase 1 — Branch & merge (started)
| ID | Task | Owner | Depends | Acceptance |
| :--- | :--- | :--- | :--- | :--- |
| P1-1 | Create `feat/stocklanda-frontend` off `main` | agent | — | branch exists |
| P1-2 | Merge `feature/hackathon-demo` (adds `stocklanda_frontend/`) | agent | P1-1 | conflict-free; tree clean |
| P1-3 | Decide keep/gate/remove `demoStore.ts` | M | — | D4 → remove |

### Phase 2 — Real Web3 restoration (P0)
| ID | Task | Owner | Gaps | Acceptance |
| :--- | :--- | :--- | :--- | :--- |
| P2-1 | Port real `hooks.ts` from `stockforge/app` | M/agent | A1–A5 | on-chain fetch, no Zustand |
| P2-2 | Rewire `options` write/buy/settle to Anchor builders | M/agent | A6 | real tx signatures |
| P2-3 | Rewire `basket` create/mint/redeem to Anchor builders | M/agent | A6 | real tx signatures |
| P2-4 | Replace demo balances/activity with `useConnection`/`useWallet` | M/agent | A7 | on-chain values |
| P2-5 | Remove `demoStore.ts` + `persist` | M/agent | A8, D-5, D-6 | no imports remain |

### Phase 3 — Devnet bootstrap (P0)
| ID | Task | Owner | Gaps | Acceptance |
| :--- | :--- | :--- | :--- | :--- |
| P3-1 | Port `scripts/seed.ts` + `seed` script | D/agent | B1, B2 | `registry.json` generated |
| P3-2 | Point `RPC_URL` at devnet (env-first) | D | C1 | `NEXT_PUBLIC_RPC_URL` honored |
| P3-3 | Make `KEYPAIR_PATH` portable / env-driven | D | C2 | no machine-specific path |
| P3-4 | Replace airdrop-funding of keeper | D | C3 | works on devnet |
| P3-5 | Add node-builtin webpack fallbacks | D | C4 | client bundle builds |
| P3-6 | Add `buffer` dependency + `.env.example` | D | B4, C5 | documented env |

### Phase 4 — Meteora DBC port ($5K track)
| ID | Task | Owner | Gaps | Acceptance |
| :--- | :--- | :--- | :--- | :--- |
| P4-1 | Port `lib/flagship.ts`, `api/flagship/route.ts`, `Flagship.tsx` | D/agent | B3 | DBC flow present |
| P4-2 | Replace fake launchpad with real DBC buy/sell UI | M/agent | D-2 | no no-op handler |
| P4-3 | Add `@meteora-ag/dynamic-bonding-curve-sdk` dep | D | B3 | installed |
| P4-4 | Run `launch:flagship` on funded devnet | D | P3-2/P3-3 | `flagship.json` populated |

### Phase 5 — PreStocks compliance & polish
| ID | Task | Owner | Gaps | Acceptance |
| :--- | :--- | :--- | :--- | :--- |
| P5-1 | Swap demo catalogue to official PreStocks SPL tokens | M | §3 | no Tessera-flavored mints |
| P5-2 | Fix font variables | M/agent | D-1 | fonts resolve |
| P5-3 | Dashboard reads real options/P&L | M/agent | D-3 | live metrics |
| P5-4 | Align mock→real field names (`totalUnits`) | M/agent | D-4 | matches IDL |
| P5-5 | Fix lint (unused imports) | M/agent | D-7 | lint clean |
| P5-6 | Update `DEMO_TO_PROD_HANDOFF.md` / delete stale notes | M | D-8 | docs match code |
| P5-7 | Re-enable/verify `writer != buyer` on-chain | D | D-8 | guard enforced |

### Phase 6 — Submission hardening (if time)
P6-1 constrain settlement `treasury` to `config.treasury` ATA · P6-2 `litesvm`
tests incl. adversarial cases · P6-3 real PreStocks `contract_address` underlyings ·
P6-4 Pyth Hermes live prices in `usePriceMap`.

---

## 7. Critical path

```
P1-1 ─> P1-2 ─> P2-1..P2-5 (real Web3) ─> P3-1..P3-3 (devnet bootstrap) ─> DEMO
                              └─> P4-1..P4-4 (DBC $5K) ────────────────────┘
P5-1 (PreStocks catalogue) runs parallel — required for the $10K track
```

## 8. Open questions

1. **Confirm the three tracks** (recommend Main + PreStocks + Meteora DBC). This
   decides whether Phase 4 (DBC port) is on the critical path.
2. **PreStocks-only catalogue:** confirm we drop the OpenAI/SpaceX-style names in
   favour of official PreStocks tokens (D5).
3. Build/deploy execution: who runs `npm install` + `next build` + devnet deploy,
   given E1.
