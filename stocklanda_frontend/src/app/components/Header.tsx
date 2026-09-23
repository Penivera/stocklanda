"use client";

export default function Header() {
  return (
    <header className="w-full border-b border-slate-800 bg-void px-4 md:px-8 py-3.5 flex items-center justify-between z-40">
      <div className="text-xl md:text-2xl font-sans font-bold tracking-tight">
        Stock<span className="text-emerald-400">Forge</span>
      </div>

      <button className="border border-slate-700 hover:border-emerald-400 text-white px-4 py-1.5 md:py-2 rounded-lg font-mono text-xs md:text-sm font-medium transition-colors flex items-center space-x-1.5 whitespace-nowrap">
        <span>Connect Wallet</span>
      </button>
    </header>
  );
}