"use client";

import { useState } from "react";

// This interface maps directly to the on-chain Anchor account structure
interface OrderBookState {
  id: string;
  assetSymbol: string;
  assetName: string;
  assetTier: string;
  type: "CALL" | "PUT";
  strikePrice: number;
  expiry: string;
  daysLeft: number;
  premium: number;
  action: "Buy" | "Write";
}

// Replace this with your Zustand store selector later
const mockOrders: OrderBookState[] = [
  {
    id: "1",
    assetSymbol: "SX",
    assetName: "SpaceX",
    assetTier: "PRIVATE • Series X",
    type: "CALL",
    strikePrice: 185.00,
    expiry: "2025-03-28",
    daysLeft: 94,
    premium: 4.20,
    action: "Buy",
  },
  {
    id: "2",
    assetSymbol: "OA",
    assetName: "OpenAI",
    assetTier: "PRIVATE • Series D",
    type: "PUT",
    strikePrice: 210.00,
    expiry: "2025-04-11",
    daysLeft: 108,
    premium: 7.85,
    action: "Write",
  },
  {
    id: "3",
    assetSymbol: "AN",
    assetName: "Anthropic",
    assetTier: "PRIVATE • Series E",
    type: "CALL",
    strikePrice: 320.00,
    expiry: "2025-06-30",
    daysLeft: 188,
    premium: 12.50,
    action: "Buy",
  },
];

export default function OptionsDesk() {
  const [filter, setFilter] = useState<"ALL" | "CALL" | "PUT">("ALL");

  const filteredOrders = mockOrders.filter(
    (order) => filter === "ALL" || order.type === filter
  );

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between space-y-6 md:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-sans font-bold tracking-tight mb-4 md:mb-6">
            P2P Options Desk
          </h1>
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
        
        <div className="flex items-center space-x-3">
          <button className="flex-1 md:flex-none border border-emerald-400 text-emerald-400 px-5 py-2.5 rounded-lg font-mono text-sm hover:bg-emerald-400/10 transition-colors">
            Write Option
          </button>
          <button className="flex-1 md:flex-none border border-slate-700 text-slate-300 px-5 py-2.5 rounded-lg font-mono text-sm hover:text-white transition-colors">
            Buy Option
          </button>
        </div>
      </div>

      {/* Tabular Order Book */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        
        {/* Desktop Table Headers */}
        <div className="hidden md:grid grid-cols-7 gap-4 p-5 border-b border-slate-800 text-slate-500 font-mono text-xs tracking-widest uppercase bg-slate-900/80">
          <div className="col-span-2">Asset</div>
          <div className="col-span-1">Type</div>
          <div className="col-span-1">Strike Price</div>
          <div className="col-span-1">Expiry</div>
          <div className="col-span-1">Premium</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {/* Order Rows */}
        <div className="divide-y divide-slate-800">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="p-5 flex flex-col md:grid md:grid-cols-7 md:items-center gap-y-4 md:gap-x-4 hover:bg-slate-800/30 transition-colors"
            >
              
              {/* Asset Identity */}
              <div className="col-span-2 flex items-center justify-between md:justify-start">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center font-mono text-sm text-emerald-400 font-bold border border-slate-700">
                    {order.assetSymbol}
                  </div>
                  <div>
                    <p className="font-sans font-bold text-base md:text-sm">
                      {order.assetName}
                    </p>
                    <p className="text-slate-500 font-mono text-[10px] md:text-xs">
                      {order.assetTier}
                    </p>
                  </div>
                </div>
                {/* Mobile-only Type Badge */}
                <div className="md:hidden">
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${
                      order.type === "CALL"
                        ? "bg-emerald-400/10 text-emerald-400"
                        : "bg-red-400/10 text-red-400"
                    }`}
                  >
                    {order.type}
                  </span>
                </div>
              </div>

              {/* Desktop Type Badge */}
              <div className="hidden md:block col-span-1">
                <span
                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${
                    order.type === "CALL"
                      ? "bg-emerald-400/10 text-emerald-400"
                      : "bg-red-400/10 text-red-400"
                  }`}
                >
                  {order.type}
                </span>
              </div>

              {/* Mobile Middle Row / Desktop Columns 3 & 6 */}
              <div className="flex justify-between items-start md:contents">
                <div className="col-span-1">
                  <p className="text-slate-500 font-mono text-xs md:hidden mb-1">
                    Strike Price
                  </p>
                  <p className="font-mono text-sm">{formatCurrency(order.strikePrice)}</p>
                </div>
                <div className="col-span-1 md:col-start-6">
                  <p className="text-slate-500 font-mono text-xs md:hidden mb-1">
                    Premium
                  </p>
                  <p className="font-mono text-sm font-bold text-emerald-400">
                    {formatCurrency(order.premium)}
                  </p>
                  <p className="text-slate-500 font-mono text-[10px] mt-0.5">
                    per contract
                  </p>
                </div>
              </div>

              {/* Mobile Bottom Row / Desktop Columns 4 & 7 */}
              <div className="flex justify-between items-center md:contents">
                <div className="col-span-1 md:col-start-4">
                  <p className="text-slate-500 font-mono text-xs md:hidden mb-1">
                    Expiry
                  </p>
                  <p className="font-mono text-sm">{order.expiry}</p>
                  <p className="text-slate-500 font-mono text-[10px] mt-0.5">
                    {order.daysLeft}d left
                  </p>
                </div>
                <div className="col-span-1 md:col-start-7 flex justify-end w-full md:w-auto mt-2 md:mt-0">
                  <button
                    className={`w-full md:w-auto px-6 py-2 md:py-1.5 rounded border font-mono text-sm transition-colors ${
                      order.action === "Buy"
                        ? "border-emerald-400 text-emerald-400 hover:bg-emerald-400/10"
                        : "border-slate-500 text-slate-300 hover:text-white hover:border-slate-400"
                    }`}
                  >
                    {order.action}
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}