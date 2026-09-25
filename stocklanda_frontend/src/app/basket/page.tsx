"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  basketNav,
  useBaskets,
  usePriceMap,
  useRegistry,
} from "@/lib/hooks";
import { shortKey, token } from "@/lib/format";
import { useDemoStore } from "@/store/demoStore";

// Helper to reliably extract a base58 string from either PublicKey or string
const toBase58Str = (key: any): string => {
  if (!key) return "";
  if (typeof key === "string") return key;
  if (typeof key.toBase58 === "function") return key.toBase58();
  return String(key);
};

export default function BasketComposer() {
  // --- DEMO STORE ---
  const walletAddress = useDemoStore((s) => s.walletAddress);
  const storeBalances = useDemoStore((s) => s.balances);

  // --- DATA HOOKS ---
  const registry = useRegistry();
  const baskets = useBaskets();
  const prices = usePriceMap(registry, [], baskets);

  // --Router--
  const router = useRouter();

  // --- UI STATE ---
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // new modal state for launchpad navigation
  const [createdModal, setCreatedModal] = useState<{
    name: string;
    mint: string;
    nav: number;
  } | null>(null);

  // Composer State
  const [basketName, setBasketName] = useState("AI Titans");
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [units, setUnits] = useState<Record<string, number>>({});

  const tradableAssets = useMemo(
    () => (registry?.mints ?? []).filter((m) => m.symbol !== "USDC"),
    [registry]
  );

  const symbolOf = (mint: string) => registry?.symbolByMint?.[mint] ?? shortKey(mint);

  // Map on-chain symbols to full display names
  const nameOf = (symbol: string) => {
    const names: Record<string, string> = {
      NVDA: "Nvidia Corporation",
      MSFT: "Microsoft",
      AAPL: "Apple Inc.",
      SX: "SpaceX",
      OA: "OpenAI",
      AN: "Anthropic",
      PRE: "PreStocks Mock",
      SPACEX: "SpaceX",
      OPENAI: "OpenAI",
      ANTHROPIC: "Anthropic",
      ANDURIL: "Anduril Industries",
      STRIPE: "Stripe",
      FIGUREAI: "Figure AI",
    };
    return names[symbol] || symbol;
  };

  // Initialize sliders dynamically based on available assets
  useEffect(() => {
    if (tradableAssets.length > 0 && Object.keys(allocations).length === 0) {
      const initAllocs: Record<string, number> = {};
      const initUnits: Record<string, number> = {};

      tradableAssets.forEach((m, i) => {
        // Default to a 40/35/25 split for the first three assets, 0 for the rest
        if (i === 0) initAllocs[m.address] = 40;
        else if (i === 1) initAllocs[m.address] = 35;
        else if (i === 2) initAllocs[m.address] = 25;
        else initAllocs[m.address] = 0;

        // Default to 1 token of underlying per basket share
        initUnits[m.address] = 1;
      });
      setAllocations(initAllocs);
      setUnits(initUnits);
    }
  }, [tradableAssets, allocations]);

  // Derive basket share balances from the Zustand store
  // Keyed by basket publicKey (matching the JSX access pattern)
  const balances = useMemo(() => {
    const result: Record<string, number> = {};
    (baskets ?? []).forEach((b: any) => {
      const pubkeyStr = toBase58Str(b?.publicKey);
      const name = b?.account?.name ?? "";
      if (pubkeyStr && name) {
        result[pubkeyStr] = storeBalances[`SHARE-${name}`] ?? 0;
      }
    });
    return result;
  }, [baskets, storeBalances]);

  const handleSliderChange = (id: string, value: number) => {
    setAllocations((prev) => ({ ...prev, [id]: value }));
  };

  const totalAllocation = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const isValid = totalAllocation === 100;

  // Calculate NAV of the basket currently being composed
  const estimatedNAV = tradableAssets.reduce((total, asset) => {
    if (allocations[asset.address] > 0) {
      const spot = prices[asset.address]?.usd ?? 0;
      const amount = units[asset.address] ?? 1;
      const value = spot * amount;
      return total + (Number.isFinite(value) ? value : 0);
    }
    return total;
  }, 0);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  // --- TRANSACTION RUNNERS ---
  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    setMsg(null);
    try {
      const sig = await fn();
      setMsg(`✓ tx: ${sig.slice(0, 8)}…`);
    } catch (e: any) {
      console.error(e);
      setMsg(`✕ ${e?.message ?? "Transaction failed"}`);
    } finally {
      setBusy(null);
    }
  };

  const createBasket = async () => {
    if (!walletAddress) return;
    await run("create", async () => {
      const components = Object.entries(allocations)
        .filter(([_, weight]) => weight > 0)
        .map(([mint, weight]) => {
          const sym = registry?.symbolByMint?.[mint] ?? "UNKNOWN";
          return { symbol: sym, weight };
        });

      if (components.length === 0) throw new Error("Must select at least one component");

      await new Promise((res) => setTimeout(res, 800));
      const txSig = useDemoStore.getState().createBasket({
        name: basketName,
        components,
      });

      // Grab the newly created basket for the modal
      const allBaskets = useDemoStore.getState().baskets;
      const lastBasket = allBaskets[allBaskets.length - 1];

      setCreatedModal({
        name: basketName,
        mint: lastBasket?.shareMint ?? "DemoMint",
        nav: estimatedNAV,
      });

      return txSig;
    });
  };

  const mintShare = async (b: any, unitCount: string) => {
    if (!walletAddress) return;

    const pubkeyStr = toBase58Str(b?.publicKey);
    if (!pubkeyStr) return;

    const key = `mint-${pubkeyStr}`;

    await run(key, async () => {
      const storeBasket = useDemoStore.getState().baskets.find(
        (basket) => basket.publicKey === pubkeyStr
      );
      if (!storeBasket) throw new Error("Basket not found");

      const safeUnits = Math.max(0, Number(unitCount) || 0);
      if (safeUnits === 0) throw new Error("Invalid unit count");

      await new Promise((res) => setTimeout(res, 800));
      return useDemoStore.getState().mintBasketShare(storeBasket.id, safeUnits);
    });
  };

  const redeemShare = async (b: any, unitCount: string) => {
    if (!walletAddress) return;

    const pubkeyStr = toBase58Str(b?.publicKey);
    if (!pubkeyStr) return;

    const key = `redeem-${pubkeyStr}`;

    await run(key, async () => {
      const storeBasket = useDemoStore.getState().baskets.find(
        (basket) => basket.publicKey === pubkeyStr
      );
      if (!storeBasket) throw new Error("Basket not found");

      const safeUnits = Math.max(0, Number(unitCount) || 0);
      if (safeUnits === 0) throw new Error("Invalid unit count");

      await new Promise((res) => setTimeout(res, 800));
      return useDemoStore.getState().redeemBasketShare(storeBasket.id, safeUnits);
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 md:space-y-12">

      {/* --- BASKET COMPOSER SECTION --- */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-sans font-bold tracking-tight mb-2">
              ETF Basket Composer
            </h1>
            <p className="text-slate-400 font-mono text-sm">
              Configure asset weights and mint a customized 1:1 on-chain portfolio
            </p>
          </div>
          {msg && <span className="text-xs font-mono text-emerald-400 mt-4 md:mt-0">{msg}</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column: Configuration Panel */}
          <div className="md:col-span-2 bg-slate-900/40 border border-slate-800 rounded-xl p-5 md:p-8 flex flex-col">
            <h2 className="text-slate-500 font-mono text-xs tracking-widest uppercase mb-6 md:mb-8 border-b border-slate-800 pb-4">
              Asset Allocation
            </h2>

            <div className="space-y-8 flex-1">
              {tradableAssets.length === 0 ? (
                <div className="text-slate-500 font-mono text-sm text-center py-10">
                  Waiting for PreStocks asset registry...
                </div>
              ) : (
                tradableAssets.map((asset) => (
                  <div key={asset.address} className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div>
                        <h3 className="font-sans font-bold text-lg">{nameOf(asset.symbol)}</h3>
                        <p className="text-slate-500 font-mono text-[10px] md:text-xs uppercase">
                          {asset.symbol} • PreStocks API
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-500 font-mono uppercase mb-1">Units/Share</span>
                          <input
                            type="number"
                            min="1"
                            value={units[asset.address] || 1}
                            onChange={(e) => setUnits(prev => ({ ...prev, [asset.address]: parseInt(e.target.value) || 1 }))}
                            className="w-16 bg-void border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono text-center focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          />
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-500 font-mono uppercase mb-1">Weight</span>
                          <div className="bg-slate-800 px-3 py-1 rounded font-mono text-sm text-emerald-400 font-bold border border-slate-700 h-6.5 flex items-center">
                            {allocations[asset.address] || 0}%
                          </div>
                        </div>
                      </div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={allocations[asset.address] || 0}
                      onChange={(e) => handleSliderChange(asset.address, parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                  </div>
                ))
              )}
            </div>

            {/* Validation Message */}
            <div className="mt-10 pt-6 border-t border-slate-800">
              <p className={`font-mono text-sm font-bold flex items-center space-x-2 ${isValid ? "text-emerald-400" : "text-red-400"}`}>
                <span>{isValid ? "" : ""}</span>
                <span>
                  Total equals {totalAllocation}% {isValid ? "" : "(Must be exactly 100%)"}
                </span>
              </p>
            </div>
          </div>

          {/* Right Column: Summary Panel */}
          <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 flex flex-col h-fit sticky top-6">
            <h2 className="text-slate-500 font-mono text-xs tracking-widest uppercase mb-6 border-b border-slate-800 pb-4">
              Deployment Summary
            </h2>

            <div className="space-y-6 flex-1">
              <div>
                <p className="text-slate-400 font-mono text-xs mb-2">Basket Name</p>
                <input
                  type="text"
                  value={basketName}
                  onChange={(e) => setBasketName(e.target.value)}
                  className="w-full bg-void border border-slate-700 rounded px-3 py-2 font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 text-center"
                />
              </div>

              <div>
                <p className="text-slate-400 font-mono text-xs mb-3">Composition</p>
                <div className="space-y-2">
                  {tradableAssets
                    .filter(a => allocations[a.address] > 0)
                    .map((asset) => (
                      <div key={asset.address} className="flex justify-between items-center text-sm">
                        <span className="font-mono text-slate-300">{asset.symbol}</span>
                        <span className="font-mono text-emerald-400">{allocations[asset.address]}%</span>
                      </div>
                    ))}
                  {Object.values(allocations).every(v => v === 0) && (
                    <span className="font-mono text-xs text-slate-500">No assets selected</span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <p className="text-slate-400 font-mono text-xs mb-1">Estimated Base NAV</p>
                <p className="text-3xl font-sans font-bold mb-1">{formatCurrency(estimatedNAV)}</p>
              </div>
            </div>

            <div className="mt-8 space-y-2">
              <button
                onClick={createBasket}
                disabled={!isValid || !walletAddress || busy === "create"}
                className={`w-full py-3 rounded-lg font-sans font-bold text-lg transition-colors ${
                  isValid && walletAddress && busy !== "create"
                    ? "bg-emerald-400 text-void hover:bg-emerald-300"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                {busy === "create" ? "Initializing..." : "Mint Basket Vault"}
              </button>
              <p className="text-center text-slate-600 font-mono text-[10px]">
                {!walletAddress ? "Requires wallet connection" : "1:1 Pro-rata Asset Vault"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- LIVE ETF BASKETS SECTION --- */}
      <div className="space-y-6 pt-6 border-t border-slate-800/50">
        <div>
          <h2 className="text-xl md:text-2xl font-sans font-bold tracking-tight">Active Portfolios</h2>
          <p className="text-slate-400 font-mono text-xs mt-1">Deposit underlying tokens to mint shares, or burn shares to redeem.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {!baskets || baskets.length === 0 ? (
            <div className="text-sm font-mono text-slate-500 p-8 border border-dashed border-slate-800 rounded-xl text-center">
              No portfolios deployed yet. Be the first to create one above.
            </div>
          ) : (
            baskets.map((b) => {
              const nav = basketNav(b, prices);
              const pubkeyStr = toBase58Str(b?.publicKey);
              const shareMintStr = toBase58Str(b?.account?.shareMint);
              
              if (!pubkeyStr) return null;
              
              const bal = balances[pubkeyStr] ?? 0;
              const name = b?.account?.name ?? "Unknown Basket";

              return (
                <div key={pubkeyStr} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 md:p-6 flex flex-col space-y-5 hover:border-slate-700 transition-colors">

                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-sans font-bold text-white">{name}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        Mint: {shareMintStr.slice(0, 12)}...
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded bg-emerald-400/10 text-emerald-400 text-[10px] font-mono font-bold">
                      1:1 ETF
                    </span>
                  </div>

                  {/* Components */}
                  <div className="space-y-2 bg-void/50 rounded-lg p-3 border border-slate-800/50">
                    {(b?.account?.components ?? []).map((c: any, i: number) => {
                      const mintStr = toBase58Str(c.mint);
                      const symbol = symbolOf(mintStr);
                      const p = prices[mintStr]?.usd ?? 0;
                      return (
                        <div key={i} className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-300">
                            {symbol} <span className="text-slate-600 ml-1">({Number(c.weightBps) / 100}%)</span>
                          </span>
                          <span className="text-slate-400">
                            {token(c.amountPerUnit)} req. <span className="text-slate-600 mx-1">·</span> {p ? formatCurrency(p) : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* NAV & Balances */}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <div className="text-slate-500 font-mono text-[10px] uppercase mb-1">Live NAV / Share</div>
                      <div className="text-xl font-mono font-bold text-emerald-400">{formatCurrency(nav)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500 font-mono text-[10px] uppercase mb-1">Your Balance</div>
                      <div className="text-xl font-mono font-bold text-white">{bal.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => mintShare(b, "1")}
                      disabled={!walletAddress || busy === `mint-${pubkeyStr}`}
                      className="w-full py-2 rounded border border-emerald-400 text-emerald-400 font-mono text-sm hover:bg-emerald-400/10 transition-colors disabled:opacity-50"
                    >
                      {busy === `mint-${pubkeyStr}` ? "Minting..." : "Mint 1 Share"}
                    </button>
                    <button
                      onClick={() => redeemShare(b, bal > 1 ? "1" : String(bal))}
                      disabled={!walletAddress || bal <= 0 || busy === `redeem-${pubkeyStr}`}
                      className="w-full py-2 rounded border border-orange-400 text-orange-400 font-mono text-sm hover:bg-orange-400/10 transition-colors disabled:opacity-50"
                    >
                      {busy === `redeem-${pubkeyStr}` ? "Redeeming..." : "Redeem 1 Share"}
                    </button>

                    {/* Meteora Launch Button */}
                    <button
                      onClick={() => {
                        const nameStr = encodeURIComponent(name);
                        router.push(`/launchpad?mint=${shareMintStr}&symbol=${nameStr}&nav=${nav}`);
                      }}
                      className="col-span-2 w-full py-2.5 rounded bg-emerald-400 text-slate-950 font-mono text-xs uppercase tracking-wider font-bold hover:bg-emerald-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>Launch Pool on Meteora</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Simple Flat Prompt Modal */}
      {createdModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full space-y-4">
            <div>
              <h3 className="text-base font-sans font-bold text-white">Basket Vault Deployed</h3>
              <p className="text-slate-400 font-mono text-xs mt-1">
                {createdModal.name} has been minted on-chain. Would you like to initialize a Meteora liquidity pool for it?
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-850 rounded p-3 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Est. Base NAV:</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(createdModal.nav)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Mint:</span>
                <span className="text-slate-300">{shortKey(createdModal.mint)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setCreatedModal(null)}
                className="w-1/2 py-2 rounded border border-slate-700 text-slate-300 font-mono text-xs hover:bg-slate-800 transition-colors"
              >
                Later
              </button>
              <button
                onClick={() => {
                  const url = `/launchpad?mint=${createdModal.mint}&symbol=${encodeURIComponent(createdModal.name)}&nav=${createdModal.nav}`;
                  setCreatedModal(null);
                  router.push(url);
                }}
                className="w-1/2 py-2 rounded bg-emerald-400 text-slate-950 font-mono text-xs font-bold hover:bg-emerald-300 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Launch Pool</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}