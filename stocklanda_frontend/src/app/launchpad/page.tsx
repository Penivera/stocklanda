"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useBaskets } from "@/lib/hooks";

// Helper to reliably extract a base58 string from either PublicKey or string
const toBase58Str = (key: any): string => {
  if (!key) return "";
  if (typeof key === "string") return key;
  if (typeof key.toBase58 === "function") return key.toBase58();
  return String(key);
};

// Safe URI decoder to prevent malformed URL crashes
const safeDecode = (str: string | null): string => {
  if (!str) return "";
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
};

export default function Launchpad() {
  const searchParams = useSearchParams();
  const passedMint = searchParams.get("mint");
  const passedSymbol = searchParams.get("symbol");
  const passedNav = searchParams.get("nav");

  const wallet = useWallet();
  const baskets = useBaskets();

  // Parse passedNav safely with fallback
  const parsedNav = passedNav ? parseFloat(passedNav) : 1.5;
  const initialBasePrice = Number.isFinite(parsedNav) && parsedNav > 0 ? parsedNav : 1.5;

  const [basePrice, setBasePrice] = useState<number>(initialBasePrice);
  const [liquidity, setLiquidity] = useState<number>(50000);
  const [selectedAsset, setSelectedAsset] = useState<string>(passedMint || "forge");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  // Safe asset amount calculation (guards against division by 0 or NaN)
  const safeAssetUnits = () => {
    if (!basePrice || basePrice <= 0 || !Number.isFinite(basePrice)) return 0;
    const units = Math.floor(liquidity / basePrice);
    return Number.isFinite(units) ? units : 0;
  };

  // Helper to display the correct asset name in the Deployment Summary
  const getSelectedName = () => {
    if (passedSymbol && selectedAsset === passedMint) {
      return safeDecode(passedSymbol);
    }

    const liveBasket = (baskets ?? []).find(
      (b: any) => toBase58Str(b?.account?.shareMint) === selectedAsset
    );
    if (liveBasket?.account?.name) return liveBasket.account.name;

    return selectedAsset === "pre" ? "PRE" : "FORGE";
  };

  const handleInitializePool = async () => {
    setIsDeploying(true);
    setStatusMsg(null);
    try {
      // UI feedback state for demonstration
      await new Promise((resolve) => setTimeout(resolve, 800));
      setStatusMsg("✓ Meteora DLMM pool initialized successfully");
    } catch {
      setStatusMsg("✕ Failed to initialize pool");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-sans font-bold tracking-tight mb-2">
          Meteora Launchpad
        </h1>
        <p className="text-slate-400 font-mono text-sm">
          Deploy a dynamic AMM pool for single-token equity launches
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column: Configuration Panel */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 md:p-8 flex flex-col">
            <h2 className="text-slate-500 font-mono text-xs tracking-widest uppercase mb-6 border-b border-slate-800 pb-4">
              Token Configuration
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-slate-400 font-mono text-xs mb-2">Select Asset</label>
                <select
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="w-full bg-void border border-slate-700 rounded-lg px-4 py-3 font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                >
                  {/* Auto-injected option if routed directly from Basket Composer */}
                  {passedMint && passedSymbol && !(baskets ?? []).some((b: any) => toBase58Str(b?.account?.shareMint) === passedMint) && (
                    <option value={passedMint} className="bg-slate-900 text-emerald-400">
                      {safeDecode(passedSymbol)} (ETF)
                    </option>
                  )}

                  {/* Map through all live on-chain ETF Baskets */}
                  {(baskets ?? []).map((b: any) => {
                    const shareMintStr = toBase58Str(b?.account?.shareMint);
                    const basketKey = toBase58Str(b?.publicKey) || shareMintStr;
                    return (
                      <option
                        key={basketKey}
                        value={shareMintStr}
                        className="bg-slate-900 text-emerald-400"
                      >
                        {b?.account?.name ?? "Custom Basket"} (ETF)
                      </option>
                    );
                  })}

                  {/* Default non-ETF assets */}
                  <option value="forge" className="bg-slate-900 text-white">StockForge Gov ($FORGE)</option>
                  <option value="pre" className="bg-slate-900 text-white">PreStocks Mock ($PRE)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-mono text-xs mb-2">Pool Type</label>
                <div className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 font-mono text-sm text-slate-300">
                  DLMM (Dynamic Liquidity)
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 md:p-8 flex flex-col">
            <h2 className="text-slate-500 font-mono text-xs tracking-widest uppercase mb-6 border-b border-slate-800 pb-4">
              Liquidity & Curve Strategy
            </h2>

            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-end mb-4">
                  <label className="text-slate-300 font-sans font-bold">Base Starting Price</label>
                  <span className="font-mono text-emerald-400 font-bold">{formatCurrency(basePrice)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={basePrice}
                  onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0.1)}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-slate-500 font-mono text-[10px] mt-2">
                  <span>$0.10</span>
                  <span>$10.00</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-4">
                  <label className="text-slate-300 font-sans font-bold">Initial USDC Liquidity</label>
                  <span className="font-mono text-emerald-400 font-bold">{formatCurrency(liquidity)}</span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="250000"
                  step="5000"
                  value={liquidity}
                  onChange={(e) => setLiquidity(parseInt(e.target.value) || 10000)}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-slate-500 font-mono text-[10px] mt-2">
                  <span>$10,000</span>
                  <span>$250,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pool Summary */}
        <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 flex flex-col h-fit sticky top-6">
          <h2 className="text-slate-500 font-mono text-xs tracking-widest uppercase mb-6 border-b border-slate-800 pb-4">
            Deployment Summary
          </h2>

          <div className="space-y-6 flex-1">
            <div>
              <p className="text-slate-400 font-mono text-xs mb-3">Pool Composition</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-mono text-slate-300 uppercase">
                    {getSelectedName()}
                  </span>
                  <span className="font-mono text-emerald-400">
                    {new Intl.NumberFormat("en-US").format(safeAssetUnits())}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-mono text-slate-300">USDC</span>
                  <span className="font-mono text-emerald-400">{formatCurrency(liquidity)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <p className="text-slate-400 font-mono text-xs mb-1">Total Value Locked (Est)</p>
              <p className="text-3xl font-sans font-bold mb-1">{formatCurrency(liquidity * 2)}</p>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2 text-xs font-mono text-slate-500">
              <div className="flex justify-between">
                <span>Curve Type</span>
                <span className="text-slate-300">Volatile</span>
              </div>
              <div className="flex justify-between">
                <span>Dynamic Fee</span>
                <span className="text-slate-300">0.15% - 1.5%</span>
              </div>
              <div className="flex justify-between">
                <span>Protocol</span>
                <span className="text-slate-300">Meteora DLMM</span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            {statusMsg && (
              <p className="text-xs font-mono text-emerald-400 text-center mb-2">
                {statusMsg}
              </p>
            )}
            <button
              onClick={handleInitializePool}
              disabled={!wallet.publicKey || isDeploying}
              className="w-full py-3 rounded-lg font-sans font-bold text-lg bg-emerald-400 text-void hover:bg-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeploying ? "Deploying Pool..." : "Initialize Pool"}
            </button>
            <p className="text-center text-slate-600 font-mono text-[10px]">
              {!wallet.publicKey ? "Requires wallet connection" : "Meteora DLMM On-Chain Pool"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}