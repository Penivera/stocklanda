/**
 * Demo Zustand store – simulates the StockForge Web3 engine entirely in-memory
 * so the UI can run without a local Solana validator or wallet.
 *
 * Uses `zustand/middleware` persist to survive page reloads via localStorage.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Generate a random Base58 string of `len` characters (default 44 for tx sigs, 32 for pubkeys). */
function fakeBase58(len = 44): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += BASE58_CHARS[Math.floor(Math.random() * BASE58_CHARS.length)];
  }
  return out;
}

function fakeTxId(): string {
  return fakeBase58(88); // Solana tx signatures are 88 Base58 chars
}

function fakePubkey(): string {
  return fakeBase58(44); // Solana public keys are 32–44 Base58 chars
}

function ts(): string {
  return new Date().toISOString();
}

let _nextId = Date.now();
function uid(): string {
  return (++_nextId).toString(36);
}

function relativeTime(): string {
  return "just now";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OptionType = "CALL" | "PUT";
export type OptionStatus = "OPEN" | "ACTIVE" | "SETTLED" | "CANCELLED";

export interface DemoOption {
  id: string;
  publicKey: string;
  writer: string;
  buyer: string | null;
  underlyingMint: string;
  underlyingSymbol: string;
  collateralMint: string;
  premiumMint: string;
  optionType: OptionType;
  strike: number;     // USD (UI units)
  size: number;       // token units
  premium: number;    // USD (UI units)
  collateralAmount: number;
  expiry: number;     // unix seconds
  status: OptionStatus;
  settlementPrice: number | null;
  createdAt: string;
}

export interface BasketComponent {
  mint: string;
  symbol: string;
  amountPerUnit: number; // UI units (6 decimals already divided out)
  weight: number;        // percentage 0-100
}

export interface DemoBasket {
  id: string;
  publicKey: string;
  creator: string;
  name: string;
  nonce: number;
  shareMint: string;
  components: BasketComponent[];
  totalSupply: number;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  action: string;
  title: string;
  txSignature: string;
  value: string;
  time: string;
  isPositive: boolean;
}

export interface DemoState {
  // ── Core state ──────────────────────────────────────────────
  walletAddress: string | null;
  /** Token balances keyed by symbol (e.g. USDC, SPACEX, OPENAI). UI units. */
  balances: Record<string, number>;
  baskets: DemoBasket[];
  options: DemoOption[];
  activity: ActivityEntry[];

  // ── Actions ─────────────────────────────────────────────────
  /** Connect a fake wallet (or set a custom address). */
  connectWallet: (address?: string) => void;
  disconnectWallet: () => void;

  /** Faucet: mint demo tokens into the wallet. */
  faucet: () => string;

  /** Write (list) a new option contract. Returns the fake tx signature. */
  writeOption: (params: {
    underlyingSymbol: string;
    optionType: OptionType;
    strike: number;
    size: number;
    premium: number;
    expiryMinutes: number;
  }) => string;

  /** Buy an existing OPEN option. Returns the fake tx signature. */
  buyOption: (optionId: string) => string;

  /** Settle an expired ACTIVE option at a given price. */
  settleOption: (optionId: string, settlementPrice: number) => string;

  /** Create a new basket ETF. */
  createBasket: (params: {
    name: string;
    components: { symbol: string; weight: number }[];
  }) => string;

  /** Mint shares of an existing basket (deposit underlying). */
  mintBasketShare: (basketId: string, units: number) => string;

  /** Redeem (burn) basket shares and withdraw underlying. */
  redeemBasketShare: (basketId: string, units: number) => string;

  /** Reset the entire store to initial state. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Default demo token catalogue (matches the on-chain registry)
// ---------------------------------------------------------------------------

const DEMO_MINTS: Record<string, string> = {
  USDC: fakePubkey(),
  SPACEX: fakePubkey(),
  OPENAI: fakePubkey(),
  ANTHROPIC: fakePubkey(),
  ANDURIL: fakePubkey(),
  STRIPE: fakePubkey(),
  FIGUREAI: fakePubkey(),
};

/** Estimated USD prices for demo calculations. */
const DEMO_PRICES: Record<string, number> = {
  USDC: 1,
  SPACEX: 112.5,
  OPENAI: 1315.39,
  ANTHROPIC: 1015.08,
  ANDURIL: 149.48,
  STRIPE: 72.3,
  FIGUREAI: 172.24,
};

const INITIAL_BALANCES: Record<string, number> = {
  USDC: 0,
  SPACEX: 0,
  OPENAI: 0,
  ANTHROPIC: 0,
  ANDURIL: 0,
  STRIPE: 0,
  FIGUREAI: 0,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const INITIAL_STATE = {
  walletAddress: null as string | null,
  balances: { ...INITIAL_BALANCES },
  baskets: [] as DemoBasket[],
  options: [] as DemoOption[],
  activity: [] as ActivityEntry[],
};

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // ── Wallet ────────────────────────────────────────────

      connectWallet: (address?: string) => {
        const addr = address ?? fakePubkey();
        set({ walletAddress: addr });
      },

      disconnectWallet: () => {
        set({ walletAddress: null });
      },

      // ── Faucet ────────────────────────────────────────────

      faucet: () => {
        const { walletAddress, balances, activity } = get();
        if (!walletAddress) throw new Error("Wallet not connected");

        const txSig = fakeTxId();
        const newBalances = { ...balances };

        // Mint 25,000 USDC and 500 of each equity token
        newBalances.USDC = (newBalances.USDC ?? 0) + 25_000;
        for (const sym of Object.keys(DEMO_MINTS)) {
          if (sym !== "USDC") {
            newBalances[sym] = (newBalances[sym] ?? 0) + 500;
          }
        }

        set({
          balances: newBalances,
          activity: [
            {
              id: uid(),
              action: "Faucet",
              title: "Demo Tokens Minted",
              txSignature: txSig,
              value: "+25,000 USDC",
              time: relativeTime(),
              isPositive: true,
            },
            ...activity,
          ],
        });
        return txSig;
      },

      // ── Write Option ──────────────────────────────────────

      writeOption: (params) => {
        const { walletAddress, balances, options, activity } = get();
        if (!walletAddress) throw new Error("Wallet not connected");

        const txSig = fakeTxId();
        const optionPk = fakePubkey();
        const mint = DEMO_MINTS[params.underlyingSymbol] ?? fakePubkey();
        const quoteMint = DEMO_MINTS.USDC;
        const expiryUnix = Math.floor(Date.now() / 1000) + params.expiryMinutes * 60;

        // Deduct collateral
        const newBalances = { ...balances };
        if (params.optionType === "PUT") {
          // PUT collateral = strike × size in USDC
          const cost = params.strike * params.size;
          if ((newBalances.USDC ?? 0) < cost) throw new Error("Insufficient USDC for collateral");
          newBalances.USDC -= cost;
        } else {
          // CALL collateral = size in underlying tokens
          if ((newBalances[params.underlyingSymbol] ?? 0) < params.size) {
            throw new Error(`Insufficient ${params.underlyingSymbol} for collateral`);
          }
          newBalances[params.underlyingSymbol] -= params.size;
        }

        const newOption: DemoOption = {
          id: uid(),
          publicKey: optionPk,
          writer: walletAddress,
          buyer: null,
          underlyingMint: mint,
          underlyingSymbol: params.underlyingSymbol,
          collateralMint: params.optionType === "PUT" ? quoteMint : mint,
          premiumMint: quoteMint,
          optionType: params.optionType,
          strike: params.strike,
          size: params.size,
          premium: params.premium,
          collateralAmount: params.optionType === "PUT" ? params.strike * params.size : params.size,
          expiry: expiryUnix,
          status: "OPEN",
          settlementPrice: null,
          createdAt: ts(),
        };

        set({
          balances: newBalances,
          options: [newOption, ...options],
          activity: [
            {
              id: uid(),
              action: "Written",
              title: `${params.underlyingSymbol} ${params.optionType}`,
              txSignature: txSig,
              value: `-$${(params.optionType === "PUT" ? params.strike * params.size : params.size * (DEMO_PRICES[params.underlyingSymbol] ?? 0)).toFixed(2)}`,
              time: relativeTime(),
              isPositive: false,
            },
            ...activity,
          ],
        });
        return txSig;
      },

      // ── Buy Option ────────────────────────────────────────

      buyOption: (optionId) => {
        const { walletAddress, balances, options, activity } = get();
        if (!walletAddress) throw new Error("Wallet not connected");

        const idx = options.findIndex((o) => o.id === optionId);
        if (idx === -1) throw new Error("Option not found");
        const opt = options[idx];
        if (opt.status !== "OPEN") throw new Error("Option is not available for purchase");
        if (opt.writer === walletAddress) throw new Error("Cannot buy your own option");

        const newBalances = { ...balances };
        const premiumCost = opt.premium * opt.size;
        if ((newBalances.USDC ?? 0) < premiumCost) throw new Error("Insufficient USDC for premium");
        newBalances.USDC -= premiumCost;

        const txSig = fakeTxId();
        const updated = [...options];
        updated[idx] = { ...opt, buyer: walletAddress, status: "ACTIVE" };

        set({
          balances: newBalances,
          options: updated,
          activity: [
            {
              id: uid(),
              action: "Bought",
              title: `${opt.underlyingSymbol} ${opt.optionType}`,
              txSignature: txSig,
              value: `-$${premiumCost.toFixed(2)}`,
              time: relativeTime(),
              isPositive: false,
            },
            ...activity,
          ],
        });
        return txSig;
      },

      // ── Settle Option ─────────────────────────────────────

      settleOption: (optionId, settlementPrice) => {
        const { walletAddress, balances, options, activity } = get();
        if (!walletAddress) throw new Error("Wallet not connected");

        const idx = options.findIndex((o) => o.id === optionId);
        if (idx === -1) throw new Error("Option not found");
        const opt = options[idx];
        if (opt.status !== "ACTIVE") throw new Error("Option must be ACTIVE to settle");

        const txSig = fakeTxId();
        const newBalances = { ...balances };

        // Determine payout
        let buyerPayout = 0;
        let writerReturn = 0;

        if (opt.optionType === "CALL") {
          // CALL: buyer profits if settlement > strike
          if (settlementPrice > opt.strike) {
            const profit = (settlementPrice - opt.strike) * opt.size;
            buyerPayout = profit;
            writerReturn = opt.collateralAmount * (DEMO_PRICES[opt.underlyingSymbol] ?? 0) - profit;
          } else {
            writerReturn = opt.collateralAmount * (DEMO_PRICES[opt.underlyingSymbol] ?? 0);
          }
        } else {
          // PUT: buyer profits if settlement < strike
          if (settlementPrice < opt.strike) {
            buyerPayout = (opt.strike - settlementPrice) * opt.size;
            writerReturn = opt.collateralAmount - buyerPayout;
          } else {
            writerReturn = opt.collateralAmount;
          }
        }

        // Credit USDC payouts
        if (opt.buyer === walletAddress) {
          newBalances.USDC = (newBalances.USDC ?? 0) + buyerPayout;
        }
        if (opt.writer === walletAddress) {
          newBalances.USDC = (newBalances.USDC ?? 0) + writerReturn;
        }

        const updated = [...options];
        updated[idx] = { ...opt, status: "SETTLED", settlementPrice };

        const netValue = opt.buyer === walletAddress ? buyerPayout : writerReturn;

        set({
          balances: newBalances,
          options: updated,
          activity: [
            {
              id: uid(),
              action: "Settled",
              title: `${opt.underlyingSymbol} ${opt.optionType}`,
              txSignature: txSig,
              value: `+$${netValue.toFixed(2)}`,
              time: relativeTime(),
              isPositive: netValue > 0,
            },
            ...activity,
          ],
        });
        return txSig;
      },

      // ── Create Basket ─────────────────────────────────────

      createBasket: (params) => {
        const { walletAddress, baskets, activity } = get();
        if (!walletAddress) throw new Error("Wallet not connected");
        if (params.components.length === 0) throw new Error("Basket must have at least one component");

        const txSig = fakeTxId();
        const basketPk = fakePubkey();
        const shareMint = fakePubkey();
        const nonce = baskets.length;

        const components: BasketComponent[] = params.components.map((c) => ({
          mint: DEMO_MINTS[c.symbol] ?? fakePubkey(),
          symbol: c.symbol,
          amountPerUnit: (c.weight / 100) * 10, // 10 tokens per full unit, weighted
          weight: c.weight,
        }));

        const newBasket: DemoBasket = {
          id: uid(),
          publicKey: basketPk,
          creator: walletAddress,
          name: params.name,
          nonce,
          shareMint,
          components,
          totalSupply: 0,
          createdAt: ts(),
        };

        set({
          baskets: [...baskets, newBasket],
          activity: [
            {
              id: uid(),
              action: "Basket Created",
              title: params.name,
              txSignature: txSig,
              value: `${params.components.length} assets`,
              time: relativeTime(),
              isPositive: true,
            },
            ...activity,
          ],
        });
        return txSig;
      },

      // ── Mint Basket Share ─────────────────────────────────

      mintBasketShare: (basketId, units) => {
        const { walletAddress, balances, baskets, activity } = get();
        if (!walletAddress) throw new Error("Wallet not connected");
        if (units <= 0) throw new Error("Units must be positive");

        const idx = baskets.findIndex((b) => b.id === basketId);
        if (idx === -1) throw new Error("Basket not found");
        const basket = baskets[idx];

        // Deduct the underlying components from balances
        const newBalances = { ...balances };
        for (const comp of basket.components) {
          const required = comp.amountPerUnit * units;
          if ((newBalances[comp.symbol] ?? 0) < required) {
            throw new Error(`Insufficient ${comp.symbol}: need ${required.toFixed(4)}, have ${(newBalances[comp.symbol] ?? 0).toFixed(4)}`);
          }
          newBalances[comp.symbol] -= required;
        }

        // Credit share tokens
        const shareSymbol = `SHARE-${basket.name}`;
        newBalances[shareSymbol] = (newBalances[shareSymbol] ?? 0) + units;

        const txSig = fakeTxId();
        const updated = [...baskets];
        updated[idx] = { ...basket, totalSupply: basket.totalSupply + units };

        // Calculate total value deposited
        const totalValue = basket.components.reduce(
          (sum, c) => sum + c.amountPerUnit * units * (DEMO_PRICES[c.symbol] ?? 0),
          0
        );

        set({
          balances: newBalances,
          baskets: updated,
          activity: [
            {
              id: uid(),
              action: "Minted",
              title: `${basket.name} ×${units}`,
              txSignature: txSig,
              value: `$${totalValue.toFixed(2)}`,
              time: relativeTime(),
              isPositive: true,
            },
            ...activity,
          ],
        });
        return txSig;
      },

      // ── Redeem Basket Share ────────────────────────────────

      redeemBasketShare: (basketId, units) => {
        const { walletAddress, balances, baskets, activity } = get();
        if (!walletAddress) throw new Error("Wallet not connected");
        if (units <= 0) throw new Error("Units must be positive");

        const idx = baskets.findIndex((b) => b.id === basketId);
        if (idx === -1) throw new Error("Basket not found");
        const basket = baskets[idx];

        const shareSymbol = `SHARE-${basket.name}`;
        if ((balances[shareSymbol] ?? 0) < units) {
          throw new Error(`Insufficient ${shareSymbol} shares`);
        }

        // Burn shares, credit components back
        const newBalances = { ...balances };
        newBalances[shareSymbol] -= units;

        for (const comp of basket.components) {
          const returned = comp.amountPerUnit * units;
          newBalances[comp.symbol] = (newBalances[comp.symbol] ?? 0) + returned;
        }

        const txSig = fakeTxId();
        const updated = [...baskets];
        updated[idx] = { ...basket, totalSupply: basket.totalSupply - units };

        const totalValue = basket.components.reduce(
          (sum, c) => sum + c.amountPerUnit * units * (DEMO_PRICES[c.symbol] ?? 0),
          0
        );

        set({
          balances: newBalances,
          baskets: updated,
          activity: [
            {
              id: uid(),
              action: "Redeemed",
              title: `${basket.name} ×${units}`,
              txSignature: txSig,
              value: `+$${totalValue.toFixed(2)}`,
              time: relativeTime(),
              isPositive: true,
            },
            ...activity,
          ],
        });
        return txSig;
      },

      // ── Reset ─────────────────────────────────────────────

      reset: () => {
        set({ ...INITIAL_STATE, balances: { ...INITIAL_BALANCES } });
      },
    }),
    {
      name: "stockforge-demo",
      // Only persist the data slices, not the action functions
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        balances: state.balances,
        baskets: state.baskets,
        options: state.options,
        activity: state.activity,
      }),
    }
  )
);

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

/** Count of options the connected wallet wrote. */
export const selectMyWrittenOptions = (state: DemoState) =>
  state.options.filter((o) => o.writer === state.walletAddress);

/** Count of options the connected wallet bought. */
export const selectMyBoughtOptions = (state: DemoState) =>
  state.options.filter((o) => o.buyer === state.walletAddress);

/** Only OPEN options available for purchase (not written by current wallet). */
export const selectOpenOptions = (state: DemoState) =>
  state.options.filter((o) => o.status === "OPEN" && o.writer !== state.walletAddress);

/** All baskets created by the connected wallet. */
export const selectMyBaskets = (state: DemoState) =>
  state.baskets.filter((b) => b.creator === state.walletAddress);

/** Portfolio total value in USD (tokens only, not options). */
export const selectPortfolioValue = (state: DemoState) =>
  Object.entries(state.balances).reduce(
    (sum, [sym, qty]) => sum + qty * (DEMO_PRICES[sym] ?? 0),
    0
  );

/** Exported so consumers can look up demo prices for calculations. */
export { DEMO_PRICES, DEMO_MINTS };

