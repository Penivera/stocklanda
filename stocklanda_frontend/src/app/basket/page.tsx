"use client";

import { useState } from "react";

// Mock metadata for the pre-IPO assets available for the basket
const availableAssets = [
  { id: "SX", name: "SpaceX", tier: "PRIVATE • Series X", price: 185.00 },
  { id: "OA", name: "OpenAI", tier: "PRIVATE • Series D", price: 210.00 },
  { id: "AN", name: "Anthropic", tier: "PRIVATE • Series E", price: 320.00 },
];

export default function BasketComposer() {
  // Initial state matches the 100% distribution from the wireframe
  const [allocations, setAllocations] = useState<Record<string, number>>({
    SX: 40,
    OA: 35,
    AN: 25,
  });

  const handleSliderChange = (id: string, value: number) => {
    setAllocations((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const totalAllocation = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const isValid = totalAllocation === 100;

  // Mock NAV calculation based on weights and prices
  const estimatedNAV = availableAssets.reduce((total, asset) => {
    const weight = allocations[asset.id] || 0;
    return total + asset.price * (weight / 100);
  }, 0);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-sans font-bold tracking-tight mb-2">
          Basket Composer
        </h1>
        <p className="text-slate-400 font-mono text-sm">
          Configure asset weights and mint your on-chain basket
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column: Configuration Panel */}
        <div className="md:col-span-2 bg-slate-900/40 border border-slate-800 rounded-xl p-5 md:p-8 flex flex-col">
          <h2 className="text-slate-500 font-mono text-xs tracking-widest uppercase mb-6 md:mb-8 border-b border-slate-800 pb-4">
            Asset Allocation
          </h2>

          <div className="space-y-8 flex-1">
            {availableAssets.map((asset) => (
              <div key={asset.id} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="font-sans font-bold text-lg">{asset.name}</h3>
                    <p className="text-slate-500 font-mono text-[10px] md:text-xs uppercase">
                      {asset.tier}
                    </p>
                  </div>
                  <div className="bg-slate-800 px-3 py-1.5 rounded font-mono text-sm text-emerald-400 font-bold border border-slate-700">
                    {allocations[asset.id]}%
                  </div>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={allocations[asset.id]}
                  onChange={(e) => handleSliderChange(asset.id, parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>
            ))}
          </div>

          {/* Validation Message & Add Button */}
          <div className="mt-10 space-y-6">
            <p
              className={`font-mono text-sm font-bold flex items-center space-x-2 ${
                isValid ? "text-emerald-400" : "text-red-400"
              }`}
            >
              <span>{isValid ? "✓" : "✗"}</span>
              <span>
                Total equals {totalAllocation}% {isValid ? "" : "(Must be exactly 100%)"}
              </span>
            </p>

            <button className="w-full border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-800/30 py-4 rounded-lg font-mono text-sm transition-colors">
              + Add asset
            </button>

            <div className="text-slate-500 font-mono text-xs space-y-1">
              <p>Basket token: $FORGE-001</p>
              <p>Min. investment: $500.00 USDC</p>
            </div>
          </div>
        </div>

        {/* Right Column: Summary Panel */}
        <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 flex flex-col h-fit sticky top-6">
          <h2 className="text-slate-500 font-mono text-xs tracking-widest uppercase mb-6 border-b border-slate-800 pb-4">
            Basket Overview
          </h2>

          <div className="space-y-6 flex-1">
            <div>
              <p className="text-slate-400 font-mono text-xs mb-2">Basket name</p>
              <div className="bg-void border border-slate-800 rounded px-3 py-2 font-mono text-sm text-slate-300 text-center">
                FORGE-001
              </div>
            </div>

            <div>
              <p className="text-slate-400 font-mono text-xs mb-3">Allocation</p>
              <div className="space-y-2">
                {availableAssets.map((asset) => (
                  <div key={asset.id} className="flex justify-between items-center text-sm">
                    <span className="font-mono text-slate-300">{asset.name}</span>
                    <span className="font-mono text-emerald-400">{allocations[asset.id]}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <p className="text-slate-400 font-mono text-xs mb-1">Estimated NAV</p>
              <p className="text-3xl font-sans font-bold mb-1">{formatCurrency(estimatedNAV)}</p>
              <p className="text-emerald-400 font-mono text-xs">▲ +2.4% (7d)</p>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2 text-xs font-mono text-slate-500">
              <div className="flex justify-between">
                <span>Protocol fee</span>
                <span>0.25%</span>
              </div>
              <div className="flex justify-between">
                <span>Est. gas</span>
                <span>~$0.004</span>
              </div>
              <div className="flex justify-between">
                <span>Network</span>
                <span>Solana</span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            <button
              disabled={!isValid}
              className={`w-full py-3 rounded-lg font-sans font-bold text-lg transition-colors ${
                isValid
                  ? "bg-emerald-400 text-void hover:bg-emerald-300"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              Mint Basket
            </button>
            <p className="text-center text-slate-600 font-mono text-[10px]">
              Requires wallet connection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}