"use client";

import { useState, useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDemoStore } from "@/store/demoStore";

export default function Header() {
  const [mounted, setMounted] = useState(false);
  
  // Bring in the real wallet adapter and our fake store
  const { publicKey } = useWallet();
  const connectWallet = useDemoStore((s) => s.connectWallet);
  const disconnectWallet = useDemoStore((s) => s.disconnectWallet);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync the real wallet's public key into the Zustand store silently
  useEffect(() => {
    if (publicKey) {
      connectWallet(publicKey.toBase58());
    } else {
      disconnectWallet();
    }
  }, [publicKey, connectWallet, disconnectWallet]);

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