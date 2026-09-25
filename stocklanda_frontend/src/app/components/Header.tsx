"use client";

import { useState, useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Header() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="w-full border-b border-slate-800 bg-void px-4 md:px-8 py-3.5 flex items-center justify-between z-40">
      <div className="text-xl md:text-2xl font-sans font-bold tracking-tight">
        Stock<span className="text-emerald-400">Forge</span>
      </div>

      <div>
        {mounted ? (
          <WalletMultiButton />
        ) : (
          <div className="h-10 w-37.5 bg-transparent" />
        )}
      </div>
    </header>
  );
}
