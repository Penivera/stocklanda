"use client";

import { useMemo, useState } from "react";
import {
  useConfig,
  useOptions,
  usePriceMap,
  useRegistry,
} from "@/lib/hooks";
import { shortKey, toUi, usd } from "@/lib/format";
import { useDemoStore, DEMO_PRICES } from "@/store/demoStore";

// Helper to reliably extract a base58 string from either PublicKey or string
const toBase58Str = (key: any): string => {
  if (!key) return "";
  if (typeof key === "string") return key;
  if (typeof key.toBase58 === "function") return key.toBase58();
  return String(key);
};

function typeOf(account: any): "CALL" | "PUT" {
  return account?.optionType?.put !== undefined ? "PUT" : "CALL";
}

function statusOf(account: any): string {
  const s = account?.status;
  if (s?.open !== undefined) return "OPEN";
  if (s?.active !== undefined) return "ACTIVE";
  if (s?.settled !== undefined) return "SETTLED";
  if (s?.cancelled !== undefined) return "CANCELLED";
  return "UNKNOWN";
}

export default function OptionsDesk() {
  //  DEMO STORE 
  const walletAddress = useDemoStore((s) => s.walletAddress);

  //  DATA HOOKS 
  const registry = useRegistry();
  const config = useConfig();
  const options = useOptions();
  const prices = usePriceMap(registry, options, []);

  // UI STATE 
  const [filter, setFilter] = useState<"ALL" | "CALL" | "PUT">("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showWrite, setShowWrite] = useState(false);

  // FORM STATE 
  const [type, setType] = useState<"PUT" | "CALL">("PUT");
  const [underlying, setUnderlying] = useState<string>("");
  const [strike, setStrike] = useState("120");
  const [size, setSize] = useState("1");
  const [premium, setPremium] = useState("5");
  const [minutes, setMinutes] = useState("60");

  const quoteMint = config?.quoteMint;
  const symbolOf = (mint: string) => registry?.symbolByMint?.[mint] ?? shortKey(mint);
  const tradableMints = useMemo(() => (registry?.mints ?? []).filter((m) => m.symbol !== "USDC"), [registry]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const collateralPreview = useMemo(() => {
    const s = Number(size) || 0;
    if (type === "PUT") return formatCurrency(s * (Number(strike) || 0)) + " USDC";
    return s.toFixed(2) + " Underlying Tokens";
  }, [type, size, strike]);

  // TRANSACTION RUNNER
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

  const faucet = async () => {
    if (!walletAddress) return;
    await run("faucet", async () => {
      await new Promise((res) => setTimeout(res, 800));
      return useDemoStore.getState().faucet();
    });
  };

  const write = async () => {
    if (!walletAddress || !quoteMint) return;
    await run("write", async () => {
      const sym = registry?.symbolByMint?.[underlying];
      if (!sym) throw new Error("Select an underlying asset");

      const safeSize = Math.max(0, Number(size) || 0);
      const safeStrike = Math.max(0, Number(strike) || 0);
      const safePremium = Math.max(0, Number(premium) || 0);
      const safeMinutes = Math.max(0, Number(minutes) || 0);

      if (safeSize === 0 || safeStrike === 0 || safeMinutes === 0) {
        throw new Error("Invalid numeric inputs");
      }

      await new Promise((res) => setTimeout(res, 800));
      return useDemoStore.getState().writeOption({
        underlyingSymbol: sym,
        optionType: type,
        strike: safeStrike,
        size: safeSize,
        premium: safePremium,
        expiryMinutes: safeMinutes,
      });
    });
  };

  const buy = async (option: any) => {
    if (!walletAddress) return;
    const key = `buy-${toBase58Str(option?.publicKey)}`;
    await run(key, async () => {
      const pubkeyStr = toBase58Str(option?.publicKey);
      const storeOpt = useDemoStore.getState().options.find((o) => o.publicKey === pubkeyStr);
      if (!storeOpt) throw new Error("Option not found");

      await new Promise((res) => setTimeout(res, 800));
      return useDemoStore.getState().buyOption(storeOpt.id);
    });
  };

  const settle = async (option: any) => {
    const pubkeyStr = toBase58Str(option?.publicKey);
    if (!pubkeyStr) return;

    const key = `settle-${pubkeyStr}`;
    await run(key, async () => {
      const storeOpt = useDemoStore.getState().options.find((o) => o.publicKey === pubkeyStr);
      if (!storeOpt) throw new Error("Option not found");

      // Use demo price for the underlying as settlement price
      const settlementPrice = DEMO_PRICES[storeOpt.underlyingSymbol] ?? 0;

      await new Promise((res) => setTimeout(res, 800));
      return useDemoStore.getState().settleOption(storeOpt.id, settlementPrice);
    });
  };

  // --- COMPUTED DATA ---
  const filteredOptions = (options ?? [])
    .filter((o) => filter === "ALL" || typeOf(o.account) === filter)
    .sort((a, b) => Number(b.account?.expiry?.toString() ?? 0) - Number(a.account?.expiry?.toString() ?? 0));

  const openCount = options.filter((o) => statusOf(o.account) === "OPEN").length;
  const activeCount = options.filter((o) => statusOf(o.account) === "ACTIVE").length;
  const collateralLocked = options
    .filter((o) => statusOf(o.account) !== "SETTLED" && statusOf(o.account) !== "CANCELLED")
    .reduce((s, o) => {
      const t = typeOf(o.account);
      return s + (t === "PUT" ? toUi(o.account?.collateralAmount) : 0);
    }, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
      {/* HEADER & STATS */}
      <div className="flex flex-col md:flex-row md:items-start justify-between space-y-6 md:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-sans font-bold tracking-tight mb-2">
            P2P Options Desk
          </h1>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-500 mb-6">
            <span>{openCount} Open Listings</span>
            <span>•</span>
            <span>{activeCount} Active Contracts</span>
            <span>•</span>
            <span className="text-emerald-400">TVL: {usd(collateralLocked * 1e6)}</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-slate-500 font-mono text-sm">Filter:</span>
            {["ALL", "CALL", "PUT"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-1.5 font-mono text-xs rounded transition-colors ${
                  filter === f
                    ? "border border-emerald-400 text-emerald-400 bg-emerald-400/10"
                    : "border border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end space-y-3">
          <div className="flex items-center space-x-3">
            {msg && <span className="text-xs font-mono text-emerald-400">{msg}</span>}
            <button
              onClick={faucet}
              disabled={!walletAddress || busy === "faucet"}
              className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
            >
              {busy === "faucet" ? "Funding..." : "Get Test USDC"}
            </button>
            <button
              onClick={() => setShowWrite(!showWrite)}
              className="border border-emerald-400 text-emerald-400 px-5 py-2.5 rounded-lg font-mono text-sm hover:bg-emerald-400/10 transition-colors"
            >
              {showWrite ? "Close Editor" : "Write Option"}
            </button>
          </div>
        </div>
      </div>

      {/* WRITE OPTION PANEL */}
      {showWrite && (
        <div className="bg-slate-900/40 border border-emerald-400/30 rounded-xl p-5 md:p-8 shadow-lg shadow-emerald-400/5 transition-all">
          <h2 className="text-slate-500 font-mono text-xs tracking-widest uppercase mb-6 border-b border-slate-800 pb-4">
            Mint New Contract
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-slate-400 font-mono text-xs mb-2">Option Type</label>
              <div className="flex gap-2">
                {(["PUT", "CALL"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold font-mono transition-colors ${
                      type === t
                        ? t === "PUT"
                          ? "border-red-400/50 bg-red-400/10 text-red-400"
                          : "border-emerald-400/50 bg-emerald-400/10 text-emerald-400"
                        : "border-slate-700 text-slate-500 hover:border-slate-500"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-xs mb-2">Underlying Asset</label>
              <select
                className="w-full bg-void border border-slate-700 rounded-lg px-4 py-2 font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                value={underlying}
                onChange={(e) => setUnderlying(e.target.value)}
              >
                <option value="" className="bg-slate-900">Select Asset…</option>
                {tradableMints.map((m) => (
                  <option key={m.address} value={m.address} className="bg-slate-900">
                    {m.symbol}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-xs mb-2">Strike Price (USD)</label>
              <input
                className="w-full bg-void border border-slate-700 rounded-lg px-4 py-2 font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
                type="number"
                min="0"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-xs mb-2">Size (Tokens)</label>
              <input
                className="w-full bg-void border border-slate-700 rounded-lg px-4 py-2 font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                type="number"
                min="0"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-xs mb-2">Premium (USDC)</label>
              <input
                className="w-full bg-void border border-slate-700 rounded-lg px-4 py-2 font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                type="number"
                min="0"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-xs mb-2">Expiry (Minutes)</label>
              <input
                className="w-full bg-void border border-slate-700 rounded-lg px-4 py-2 font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                type="number"
                min="0"
              />
            </div>

            <div className="md:col-span-3 flex flex-wrap items-center justify-between mt-4 pt-4 border-t border-slate-800">
              <div className="text-xs font-mono text-slate-400">
                Required Collateral: <span className="text-white font-bold">{collateralPreview}</span>
              </div>
              <button
                onClick={write}
                disabled={!walletAddress || busy === "write" || !underlying}
                className="bg-emerald-400 text-void px-6 py-2 rounded-lg font-mono text-sm font-bold hover:bg-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === "write" ? "Processing..." : "Lock Collateral & List"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER BOOK TABLE */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        {/* Desktop Headers */}
        <div className="hidden md:grid grid-cols-8 gap-4 p-5 border-b border-slate-800 text-slate-500 font-mono text-xs tracking-widest uppercase bg-slate-900/80">
          <div className="col-span-2">Asset</div>
          <div className="col-span-1">Type</div>
          <div className="col-span-1">Strike</div>
          <div className="col-span-1">Spot Price</div>
          <div className="col-span-1">Premium</div>
          <div className="col-span-1">Expiry</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {/* Live Order Rows */}
        <div className="divide-y divide-slate-800">
          {filteredOptions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-sm">
              No options match your filter. Connect wallet and write a new listing.
            </div>
          ) : (
            filteredOptions.map((o) => {
              const a = o.account;
              if (!a) return null;

              const t = typeOf(a);
              const st = statusOf(a);
              
              const underlyingMintStr = toBase58Str(a.underlyingMint);
              const symbol = symbolOf(underlyingMintStr);
              const spot = prices[underlyingMintStr]?.usd ?? 0;
              
              const strikeVal = toUi(a.strike);
              const itm = t === "PUT" ? spot > 0 && spot < strikeVal : spot > 0 && spot > strikeVal;
              
              const expiryNum = a.expiry ? Number(a.expiry.toString()) : 0;
              const expired = expiryNum > 0 && Date.now() / 1000 >= expiryNum;
              
              const pubkeyStr = toBase58Str(o.publicKey);
              const writerStr = toBase58Str(a.writer);
              const buyerStr = toBase58Str(a.buyer);

              return (
                <div
                  key={pubkeyStr}
                  className={`p-5 flex flex-col md:grid md:grid-cols-8 md:items-center gap-y-4 md:gap-x-4 transition-colors ${
                    st === "SETTLED" || st === "CANCELLED" ? "opacity-50" : "hover:bg-slate-800/30"
                  }`}
                >
                  {/* Asset */}
                  <div className="col-span-2 flex items-center space-x-3">
                    <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center font-mono text-sm text-emerald-400 font-bold border border-slate-700">
                      {symbol.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-sans font-bold text-base md:text-sm">{symbol}</p>
                      <p className="text-slate-500 font-mono text-[10px] md:text-xs">
                        {st} • {shortKey(writerStr)}
                      </p>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-1 flex md:block justify-between items-center">
                    <p className="text-slate-500 font-mono text-xs md:hidden">Type</p>
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${
                        t === "CALL" ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
                      }`}
                    >
                      {t}
                    </span>
                  </div>

                  {/* Strike */}
                  <div className="col-span-1 flex md:block justify-between items-center">
                    <p className="text-slate-500 font-mono text-xs md:hidden">Strike</p>
                    <p className="font-mono text-sm">{formatCurrency(strikeVal)}</p>
                  </div>

                  {/* Spot Price */}
                  <div className="col-span-1 flex md:block justify-between items-center">
                    <p className="text-slate-500 font-mono text-xs md:hidden">Spot</p>
                    <p className={`font-mono text-sm ${itm ? "text-emerald-400" : "text-slate-300"}`}>
                      {spot ? formatCurrency(spot) : "—"}
                    </p>
                  </div>

                  {/* Premium */}
                  <div className="col-span-1 flex md:block justify-between items-center">
                    <p className="text-slate-500 font-mono text-xs md:hidden">Premium</p>
                    <p className="font-mono text-sm font-bold text-emerald-400">
                      {usd(a.premium)}
                    </p>
                  </div>

                  {/* Expiry */}
                  <div className="col-span-1 flex md:block justify-between items-center">
                    <p className="text-slate-500 font-mono text-xs md:hidden">Expiry</p>
                    <div>
                      <p className="font-mono text-xs md:text-sm">
                        {expiryNum > 0 ? new Date(expiryNum * 1000).toLocaleDateString() : "—"}
                      </p>
                      <p className="text-slate-500 font-mono text-[10px] mt-0.5">
                        {expiryNum > 0 ? new Date(expiryNum * 1000).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }) : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="col-span-1 flex justify-end w-full md:w-auto mt-2 md:mt-0">
                    {st === "OPEN" && !expired && (
                      <button
                        onClick={() => buy(o)}
                        disabled={!walletAddress || busy === `buy-${pubkeyStr}`}
                        className="w-full md:w-auto px-4 py-2 md:py-1.5 rounded border border-emerald-400 text-emerald-400 font-mono text-sm hover:bg-emerald-400/10 transition-colors disabled:opacity-50"
                      >
                        {busy === `buy-${pubkeyStr}` ? "Buying..." : "Buy"}
                      </button>
                    )}

                    {st === "ACTIVE" && expired && (
                      <button
                        onClick={() => settle(o)}
                        disabled={busy === `settle-${pubkeyStr}`}
                        className="w-full md:w-auto px-4 py-2 md:py-1.5 rounded border border-orange-400 text-orange-400 font-mono text-sm hover:bg-orange-400/10 transition-colors disabled:opacity-50"
                      >
                        {busy === `settle-${pubkeyStr}` ? "Settling..." : "Settle"}
                      </button>
                    )}

                    {st === "ACTIVE" && !expired && (
                      <span className="text-[10px] font-mono text-slate-500 text-right">
                        Held by<br />{buyerStr ? shortKey(buyerStr) : "Unknown"}
                      </span>
                    )}

                    {st === "SETTLED" && (
                      <span className="text-[10px] font-mono text-slate-500 text-right">
                        Settled @<br />{usd(a.settledPrice)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}