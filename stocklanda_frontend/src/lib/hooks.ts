"use client";

/**
 * hooks.ts – Demo-mode hooks
 *
 * These hooks return data from the Zustand demoStore but wrap it in
 * Anchor-compatible payload shapes ({ publicKey, account }) with
 * BN-like objects so the UI components continue to work without changes.
 *
 * The Solana/Anchor connection is completely severed – no RPC calls,
 * no wallet adapter, no program.account.fetch.
 */

import { useMemo } from "react";
import { useDemoStore, DEMO_PRICES, DEMO_MINTS } from "@/store/demoStore";
import type {
  DemoOption,
  DemoBasket,
  BasketComponent,
} from "@/store/demoStore";

// ---------------------------------------------------------------------------
// BN / PublicKey shims  – mimic the subset of methods the UI actually calls
// ---------------------------------------------------------------------------

/** A minimal object that behaves like a BN for display purposes. */
function bnLike(uiValue: number, decimals = 6): { toString(): string } {
  const raw = Math.round(uiValue * 10 ** decimals);
  return {
    toString() {
      return raw.toString();
    },
  };
}

/** A minimal object that behaves like a Solana PublicKey. */
function pubkeyLike(base58: string) {
  return {
    toBase58() {
      return base58;
    },
    toBuffer() {
      return new Uint8Array(32);
    },
    toString() {
      return base58;
    },
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface Registry {
  programId: string;
  config: string;
  quoteMint: string;
  treasury: string;
  admin: string;
  symbolByMint: Record<string, string>;
  mints: { symbol: string; address: string; decimals: number }[];
  baskets: { name: string; basket: string; shareMint: string }[];
}

/** Hardcoded demo registry with NVDA, MSFT, AAPL + the demo PreStocks tokens. */
const DEMO_REGISTRY: Registry = (() => {
  const symbolByMint: Record<string, string> = {};
  const mints: Registry["mints"] = [];

  // Build both look-ups from the demoStore's mint catalogue
  for (const [symbol, address] of Object.entries(DEMO_MINTS)) {
    symbolByMint[address] = symbol;
    mints.push({ symbol, address, decimals: 6 });
  }

  return {
    programId: "E4t7DUwrLKgxpGb88686DtqrRqnHd5GCKE3ASwR8SCwi",
    config: "DemoConfigAddr111111111111111111111111111111",
    quoteMint: DEMO_MINTS.USDC,
    treasury: "DemoTreasury1111111111111111111111111111111",
    admin: "DemoAdmin11111111111111111111111111111111111",
    symbolByMint,
    mints,
    baskets: [],
  };
})();

export function useRegistry(): Registry | null {
  return DEMO_REGISTRY;
}

// ---------------------------------------------------------------------------
// Program & Config  (stubs – still exported so existing imports don't break)
// ---------------------------------------------------------------------------

export function useProgram(): any {
  // Return an inert object – pages that call program.methods.* will need
  // to be rewired to the demoStore actions, but this prevents import crashes.
  return {
    account: {},
    methods: new Proxy(
      {},
      {
        get: () => () => ({
          accounts: () => ({ preInstructions: () => ({ remainingAccounts: () => ({ rpc: async () => "DEMO_SIG" }), rpc: async () => "DEMO_SIG" }) }),
          rpc: async () => "DEMO_SIG",
        }),
      }
    ),
  };
}

export function useConfig(_refreshMs = 15000): any {
  // Return a mock config with the quoteMint so the Write Option form works
  return {
    quoteMint: DEMO_MINTS.USDC,
    treasury: pubkeyLike("DemoTreasury1111111111111111111111111111111"),
    feeBps: 25,
    admin: pubkeyLike("DemoAdmin11111111111111111111111111111111111"),
  };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Convert a flat DemoOption into the Anchor `{ publicKey, account }` shape. */
function wrapOption(opt: DemoOption) {
  return {
    publicKey: pubkeyLike(opt.publicKey),
    account: {
      id: bnLike(parseInt(opt.id, 36) || 0, 0),
      writer: pubkeyLike(opt.writer),
      buyer: opt.buyer ? pubkeyLike(opt.buyer) : pubkeyLike("11111111111111111111111111111111"),
      underlyingMint: pubkeyLike(opt.underlyingMint),
      collateralMint: pubkeyLike(opt.collateralMint),
      premiumMint: pubkeyLike(opt.premiumMint),
      optionType: opt.optionType === "PUT" ? { put: {} } : { call: {} },
      strike: bnLike(opt.strike),
      size: bnLike(opt.size),
      premium: bnLike(opt.premium),
      collateralAmount: bnLike(opt.collateralAmount),
      expiry: bnLike(opt.expiry, 0),
      status: (() => {
        switch (opt.status) {
          case "OPEN": return { open: {} };
          case "ACTIVE": return { active: {} };
          case "SETTLED": return { settled: {} };
          case "CANCELLED": return { cancelled: {} };
          default: return { open: {} };
        }
      })(),
      settledPrice: opt.settlementPrice != null ? bnLike(opt.settlementPrice) : bnLike(0),
    },
  };
}

export function useOptions(_refreshMs = 6000): any[] {
  const options = useDemoStore((s) => s.options);
  return useMemo(() => options.map(wrapOption), [options]);
}

// ---------------------------------------------------------------------------
// Baskets
// ---------------------------------------------------------------------------

/** Convert a flat BasketComponent into the Anchor account shape. */
function wrapComponent(c: BasketComponent) {
  return {
    mint: pubkeyLike(c.mint),
    amountPerUnit: bnLike(c.amountPerUnit),
    weightBps: c.weight * 100, // 40% → 4000 bps
  };
}

/** Convert a flat DemoBasket into the Anchor `{ publicKey, account }` shape. */
function wrapBasket(b: DemoBasket) {
  return {
    publicKey: pubkeyLike(b.publicKey),
    account: {
      creator: pubkeyLike(b.creator),
      name: b.name,
      nonce: bnLike(b.nonce, 0),
      shareMint: pubkeyLike(b.shareMint),
      components: b.components.map(wrapComponent),
      totalSupply: bnLike(b.totalSupply),
    },
  };
}

export function useBaskets(_refreshMs = 10000): any[] {
  const baskets = useDemoStore((s) => s.baskets);
  return useMemo(() => baskets.map(wrapBasket), [baskets]);
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

import type { AssetPrice } from "./prices";

/**
 * Returns a price map keyed by mint address.
 *
 * In demo mode we use the static DEMO_PRICES table instead of
 * fetching from PreStocks / Pyth Hermes.
 */
export function usePriceMap(
  registry: Registry | null,
  _options: any[],
  _baskets: any[]
): Record<string, AssetPrice> {
  return useMemo(() => {
    const map: Record<string, AssetPrice> = {};
    const mints = registry?.mints ?? [];
    for (const m of mints) {
      map[m.address] = {
        symbol: m.symbol,
        usd: DEMO_PRICES[m.symbol] ?? 0,
        source: "prestocks" as const,
      };
    }
    return map;
  }, [registry]);
}

// ---------------------------------------------------------------------------
// basketNav  – re-exported so `import { basketNav } from "@/lib/hooks"` works
// ---------------------------------------------------------------------------

/**
 * Net asset value per basket unit (USD), given the price map.
 * Handles both real Anchor BN values and our bnLike shims.
 */
export function basketNav(
  basket: any,
  prices: Record<string, AssetPrice>
): number {
  return (basket?.account?.components ?? []).reduce(
    (sum: number, c: any) => {
      const mintStr =
        typeof c.mint === "string"
          ? c.mint
          : typeof c.mint?.toBase58 === "function"
            ? c.mint.toBase58()
            : String(c.mint);

      const p = prices[mintStr]?.usd ?? 0;
      const amount = Number(c.amountPerUnit?.toString?.() ?? "0") / 1e6;
      return sum + amount * p;
    },
    0
  );
}
