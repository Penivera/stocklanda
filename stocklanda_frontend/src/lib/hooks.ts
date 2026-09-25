"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useMemo, useState } from "react";
import { makeProgram } from "./program";
import { configPda } from "./pda";
import { fetchPrestocks, resolvePrice, type AssetPrice } from "./prices";

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

export function useProgram(): any {
  const { connection } = useConnection();
  const wallet = useWallet();
  return useMemo(
    () => makeProgram(connection, wallet as never),
    [connection, wallet]
  );
}

export function useRegistry(): Registry | null {
  const [registry, setRegistry] = useState<Registry | null>(null);
  useEffect(() => {
    fetch("/registry.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setRegistry)
      .catch(() => setRegistry(null));
  }, []);
  return registry;
}

export function useConfig(refreshMs = 15000) {
  const program = useProgram();
  const [config, setConfig] = useState<any | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const acc = await (program.account as any).config.fetch(configPda());
        if (active) setConfig(acc);
      } catch {
        if (active) setConfig(null);
      }
    };
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [program, refreshMs]);
  return config;
}

export function useOptions(refreshMs = 6000) {
  const program = useProgram();
  const [options, setOptions] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const all = await (program.account as any).optionContract.all();
        if (active) setOptions(all);
      } catch {
        /* ignore transient RPC errors */
      }
    };
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [program, refreshMs]);
  return options;
}

export function useBaskets(refreshMs = 10000) {
  const program = useProgram();
  const [baskets, setBaskets] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const all = await (program.account as any).basket.all();
        if (active) setBaskets(all);
      } catch {
        /* ignore transient RPC errors */
      }
    };
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [program, refreshMs]);
  return baskets;
}

/**
 * Resolve USD prices for every mint referenced by the registry, options and
 * baskets. PreStocks first, then Pyth, then indicative fallback.
 */
export function usePriceMap(
  registry: Registry | null,
  options: any[],
  baskets: any[]
): Record<string, AssetPrice> {
  const [prices, setPrices] = useState<Record<string, AssetPrice>>({});

  const mints = useMemo(() => {
    const set = new Set<string>();
    (registry?.mints ?? []).forEach((m) => set.add(m.address));
    options.forEach(
      (o) => o?.account?.underlyingMint?.toBase58?.() && set.add(o.account.underlyingMint.toBase58())
    );
    baskets.forEach((b) =>
      (b?.account?.components ?? []).forEach((c: any) => set.add(c.mint.toBase58()))
    );
    return Array.from(set);
  }, [registry, options, baskets]);

  const key = mints.slice().sort().join(",");

  useEffect(() => {
    let active = true;
    const load = async () => {
      let prestocks;
      try {
        prestocks = await fetchPrestocks();
      } catch {
        prestocks = undefined;
      }
      const entries = await Promise.all(
        mints.map(async (mint) => {
          const symbol = registry?.symbolByMint?.[mint] ?? "UNKNOWN";
          const price = await resolvePrice(symbol, prestocks);
          return [mint, price] as const;
        })
      );
      if (active) setPrices(Object.fromEntries(entries));
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, registry]);

  return prices;
}

/** Net asset value per basket unit (USD), given the price map. */
export function basketNav(basket: any, prices: Record<string, AssetPrice>): number {
  return (basket?.account?.components ?? []).reduce((sum: number, c: any) => {
    const mintStr =
      typeof c.mint === "string"
        ? c.mint
        : typeof c.mint?.toBase58 === "function"
          ? c.mint.toBase58()
          : String(c.mint);
    const p = prices[mintStr]?.usd ?? 0;
    return sum + (Number(c.amountPerUnit?.toString?.() ?? "0") / 1e6) * p;
  }, 0);
}
