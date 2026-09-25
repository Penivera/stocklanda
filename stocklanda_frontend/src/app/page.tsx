"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useEffect, useMemo, useState } from "react";
import {
  basketNav,
  useBaskets,
  useOptions,
  usePriceMap,
  useRegistry,
} from "@/lib/hooks";

// Helper to reliably extract a base58 string from either PublicKey or string
const toBase58Str = (key: any): string => {
  if (!key) return "";
  if (typeof key === "string") return key;
  if (typeof key.toBase58 === "function") return key.toBase58();
  return String(key);
};

function statusOf(account: any): string {
  const s = account?.status;
  if (s?.open !== undefined) return "OPEN";
  if (s?.active !== undefined) return "ACTIVE";
  if (s?.settled !== undefined) return "SETTLED";
  if (s?.cancelled !== undefined) return "CANCELLED";
  return "UNKNOWN";
}

function typeOf(account: any): "CALL" | "PUT" {
  return account?.optionType?.put !== undefined ? "PUT" : "CALL";
}

export default function Dashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58() ?? null;

  const registry = useRegistry();
  const baskets = useBaskets();
  const options = useOptions();
  const prices = usePriceMap(registry, options, baskets);

  const [rawBalances, setRawBalances] = useState<Record<string, number>>({});
  const [rawActivity, setRawActivity] = useState<any[]>([]);
  const balances = useMemo(
    () => (wallet.publicKey ? rawBalances : {}),
    [wallet.publicKey, rawBalances]
  );
  const activity = useMemo(
    () => (wallet.publicKey ? rawActivity : []),
    [wallet.publicKey, rawActivity]
  );

  // On-chain token balances for registry mints + basket share mints
  useEffect(() => {
    if (!wallet.publicKey) return;
    let active = true;
    (async () => {
      const mints = [
        ...(registry?.mints ?? []).map((m) => m.address),
        ...(baskets ?? []).map((b: any) => toBase58Str(b?.account?.shareMint)),
      ].filter(Boolean);

      try {
        const entries = await Promise.all(
          mints.map(async (mint) => {
            try {
              const ata = getAssociatedTokenAddressSync(
                new PublicKey(mint),
                wallet.publicKey!,
                true
              );
              const bal = await connection.getTokenAccountBalance(ata);
              return [mint, bal.value.uiAmount ?? 0] as const;
            } catch {
              return [mint, 0] as const;
            }
          })
        );
        if (active) setRawBalances(Object.fromEntries(entries));
      } catch {
        /* ignore RPC errors */
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet.publicKey, registry, baskets, connection]);

  // Recent on-chain activity
  useEffect(() => {
    if (!wallet.publicKey) return;
    let active = true;
    connection
      .getSignaturesForAddress(wallet.publicKey, { limit: 6 })
      .then((sigs) => {
        if (active) setRawActivity(sigs);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      active = false;
    };
  }, [wallet.publicKey, connection]);

  // 1. Compute Total Portfolio Value from holdings × oracle prices (guarded against NaN)
  const totalValue = useMemo(() => {
    let sum = 0;

    // Value of underlying / registry tokens held
    (registry?.mints ?? []).forEach((m) => {
      const bal = balances[m.address] ?? 0;
      const spot = prices[m.address]?.usd ?? (m.symbol === "USDC" ? 1 : 0);
      const val = bal * spot;
      if (Number.isFinite(val)) sum += val;
    });

    // Value of ETF basket shares held
    (baskets ?? []).forEach((b: any) => {
      const shareMint = toBase58Str(b?.account?.shareMint);
      if (!shareMint) return;

      const bal = balances[shareMint] ?? 0;
      const rawNav = basketNav(b, prices);
      const nav = Number.isFinite(rawNav) ? rawNav : 0;
      const val = bal * nav;
      if (Number.isFinite(val)) sum += val;
    });

    return sum;
  }, [balances, prices, registry, baskets]);

  // 2. Option metrics
  const optionStats = useMemo(() => {
    const active = (options ?? []).filter((o) => statusOf(o.account) === "ACTIVE");
    const open = (options ?? []).filter((o) => statusOf(o.account) === "OPEN");
    const calls = active.filter((o) => typeOf(o.account) === "CALL").length;
    const puts = active.filter((o) => typeOf(o.account) === "PUT").length;
    return { active: active.length, open: open.length, calls, puts };
  }, [options]);

  // 3. Basket metrics: count baskets created by user vs baskets where user owns shares
  const basketStats = useMemo(() => {
    if (!walletAddress) return { total: 0, minted: 0, holding: 0 };

    const basketList = baskets ?? [];

    const createdByMe = basketList.filter((b: any) => {
      const creatorStr = toBase58Str(b?.account?.creator);
      return creatorStr === walletAddress;
    });

    const holdingShares = basketList.filter((b: any) => {
      const shareMint = toBase58Str(b?.account?.shareMint);
      return (balances[shareMint] ?? 0) > 0;
    });

    return {
      total: basketList.length,
      minted: createdByMe.length,
      holding: holdingShares.length,
    };
  }, [baskets, balances, walletAddress]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
      <div>
        <h1 className="text-slate-500 font-mono text-xs tracking-widest uppercase mb-4">
          Portfolio Overview
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* --- LEFT COLUMN: METRICS --- */}
        <div className="md:col-span-2 space-y-6 md:space-y-8">
          {/* Total Value Card */}
          <section className="border border-slate-800 rounded-xl p-6 md:p-8 bg-slate-900/40 relative overflow-hidden transition-colors hover:bg-slate-800/30">
            <p className="text-slate-400 text-sm font-mono mb-2">Total Value</p>
            <h2 className="text-4xl md:text-5xl font-sans font-bold text-white mb-2 tracking-tight">
              {formatCurrency(totalValue)}
            </h2>
            <p className="text-slate-300 font-mono text-sm flex items-center space-x-1">
              <span className="text-[10px] text-emerald-400">●</span>
              <span className="text-slate-400 text-xs">
                {walletAddress ? "Devnet" : "Wallet not connected"}
              </span>
            </p>
            <div className="absolute right-6 bottom-6 text-xs font-mono text-slate-600 hidden md:block uppercase">
              USDC
            </div>
          </section>

          {/* 2x2 Stats Grid */}
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div className="bg-slate-900/40 rounded-xl p-5 md:p-6 border border-slate-800 flex flex-col justify-between transition-colors hover:bg-slate-800/30">
              <p className="text-slate-400 text-xs md:text-sm font-mono mb-4">Active Options</p>
              <div>
                <p className="text-2xl md:text-3xl font-sans font-bold text-white mb-1">
                  {optionStats.active}
                </p>
                <p className="text-slate-500 text-[10px] md:text-xs font-mono uppercase">
                  {optionStats.calls} calls • {optionStats.puts} puts
                </p>
              </div>
            </div>

            <div className="bg-slate-900/40 rounded-xl p-5 md:p-6 border border-slate-800 flex flex-col justify-between transition-colors hover:bg-slate-800/30">
              <p className="text-slate-400 text-xs md:text-sm font-mono mb-4">ETF Baskets</p>
              <div>
                <p className="text-2xl md:text-3xl font-sans font-bold text-white mb-1">
                  {basketStats.holding}
                </p>
                <p className="text-slate-500 text-[10px] md:text-xs font-mono uppercase">
                  {basketStats.minted} created • {basketStats.total} network
                </p>
              </div>
            </div>

            <div className="bg-slate-900/40 rounded-xl p-5 md:p-6 border border-slate-800 flex flex-col justify-between transition-colors hover:bg-slate-800/30">
              <p className="text-slate-400 text-xs md:text-sm font-mono mb-4">Open Listings</p>
              <p className="text-xl md:text-2xl font-sans font-bold text-white">
                {optionStats.open}
              </p>
            </div>

            <div className="bg-slate-900/40 rounded-xl p-5 md:p-6 border border-slate-800 flex flex-col justify-between transition-colors hover:bg-slate-800/30">
              <p className="text-slate-400 text-xs md:text-sm font-mono mb-4">Holdings Count</p>
              <p className="text-xl md:text-2xl font-sans font-bold text-white">
                {Object.values(balances).filter((b) => b > 0).length} assets
              </p>
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: RECENT ACTIVITY --- */}
        <section className="md:col-span-1 bg-slate-900/40 border border-slate-800 rounded-xl p-5 md:p-6 flex flex-col h-full transition-colors hover:bg-slate-800/30">
          <h2 className="text-slate-500 text-xs font-mono tracking-widest uppercase mb-6 border-b border-slate-800 pb-4 shrink-0">
            Recent Activity
          </h2>

          <div className="space-y-6 overflow-y-auto pr-2 pb-2 flex-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {!walletAddress ? (
              <p className="text-xs font-mono text-slate-500 py-4 text-center">
                Connect wallet to view recent activity
              </p>
            ) : activity.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-4 text-center">
                No recent transactions found
              </p>
            ) : (
              activity.map((tx) => (
                <div key={tx.signature} className="flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-white truncate">
                      {tx.signature.slice(0, 16)}…
                    </p>
                    <p className="text-slate-500 text-[10px] font-mono mt-0.5 uppercase">
                      {tx.blockTime
                        ? new Date(tx.blockTime * 1000).toLocaleString()
                        : "pending"}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded shrink-0 ${
                      tx.err
                        ? "text-red-400 bg-red-400/10"
                        : "text-emerald-400 bg-emerald-400/10"
                    }`}
                  >
                    {tx.err ? "failed" : "success"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
