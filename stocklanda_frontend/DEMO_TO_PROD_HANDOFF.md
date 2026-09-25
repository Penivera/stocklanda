# StockForge: Demo to Production Handoff Guide

## Current State: The Hackathon Demo Branch
**Branch:** `feature/hackathon-demo`

To ensure a flawless, zero-lag presentation for the hackathon judges, the frontend is currently completely airgapped from the Solana RPC. 
* All Web3 reads and writes have been intercepted and routed to a local Zustand database (`src/store/demoStore.ts`).
* The UI is fully functional but relies on `localStorage` to simulate the blockchain state (balances, option listings, basket mints).
* The Phantom wallet `<WalletMultiButton />` visually remains, but silently syncs its public key to the Zustand store rather than triggering real transactions.

---

## Task 1: Pyth Network Oracle (Devon's Action Items)

### Phase A: The Hackathon Presentation (Immediate)
To satisfy the Pyth Network integration requirements for the judges, we need to visibly demonstrate live price feeds.
* **Target:** `src/lib/hooks.ts` -> `usePriceMap()`
* **Action:** Restore the Pyth Hermes API fetch logic inside this hook. Instead of relying on the static `DEMO_PRICES` object, this hook should fetch the real-time prices for the underlying assets and return them. The Zustand mock store will automatically use these live prices to accurately calculate ETF Basket NAVs and Option settlement payouts.

### Phase B: Post-Hackathon (Production)
* **Target:** Anchor Smart Contract Integration
* **Action:** When moving back to the real Web3 implementation, the Pyth price update accounts must be passed directly into the Anchor transaction instructions (`mint_basket`, `settle_option`). Relying purely on the frontend Pyth fetch is unsafe for the real smart contract; the on-chain programs must resolve the Pyth oracle natively.

---

## Task 2: Real Web3 Engine Restoration (Post-Hackathon)

Once the hackathon is over and the localnet/RPC stability issues are resolved on Windows, we need to transition back to the real Anchor contracts.

### Step 1: Remove the Mock Store
* Delete `src/store/demoStore.ts`.

### Step 2: Restore Anchor Hooks
* Revert `src/lib/hooks.ts` to its previous state.
* Re-import `@solana/wallet-adapter-react` and `@anchor-lang/core`.
* Re-wire `useBaskets` and `useOptions` to fetch via `program.account.basket.all()` and `program.account.optionContract.all()`.

### Step 3: Restore Transaction Runners
* **Targets:** `src/app/basket/page.tsx`, `src/app/options/page.tsx`
* Locate all runner functions (`createBasket`, `mintShare`, `write`, `buy`, `settle`).
* Replace the `useDemoStore.getState()` calls with the real Anchor builder logic: `await program.methods.[instruction]().accounts({...}).rpc()`.
* Restore the `ensureAta` checks for proper SPL token account derivation.

---

## Task 3: Reverting Demo Overrides
If you need to test the Option lifecycle (Write -> Buy -> Settle) locally without switching Phantom wallets, there is a bypass currently active in the mock store.

* **Target:** `src/store/demoStore.ts` -> `buyOption()`
* **Action:** The rule preventing a user from buying their own option has been commented out. When transitioning back to production, ensure the on-chain smart contract strictly enforces `require!(option.writer != buyer, ErrorCode::CannotBuyOwnOption)`.