"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Buffer } from "buffer";
import { useCallback, useEffect, useState } from "react";
import { shortKey } from "@/lib/format";

interface FlagshipState {
  launched: boolean;
  onChain?: boolean;
  network?: string;
  name?: string;
  symbol?: string;
  config?: string;
  baseMint?: string;
  pool?: string;
  quoteMint?: string;
  quoteSymbol?: string;
  decimals?: number;
  totalSupply?: string;
  price?: number;
  progress?: number;
  quoteReserve?: number;
  baseReserve?: number;
  marketCapSol?: number;
  migrated?: boolean;
  error?: string;
}

export default function Launchpad() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [state, setState] = useState<FlagshipState | null>(null);
  const [amount, setAmount] = useState("0.5");
  const [slippage, setSlippage] = useState("100");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sol, setSol] = useState(0);
  const [forge, setForge] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/flagship", { cache: "no-store" });
      setState(await res.json());
    } catch {
      setState({ launched: false });
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!wallet.publicKey) {
      setSol(0);
      setForge(0);
      return;
    }
    let active = true;
    (async () => {
      try {
        const lamports = await connection.getBalance(wallet.publicKey!);
        if (active) setSol(lamports / 1e9);
      } catch {
        /* ignore */
      }
      if (state?.baseMint && state.decimals) {
        try {
          const ata = getAssociatedTokenAddressSync(
            new PublicKey(state.baseMint),
            wallet.publicKey!,
            true
          );
          const bal = await connection.getTokenAccountBalance(ata);
          if (active) setForge(bal.value.uiAmount ?? 0);
        } catch {
          if (active) setForge(0);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet.publicKey, connection, state?.baseMint, state?.decimals, busy]);

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

  const trade = async (side: "buy" | "sell") => {
    if (!wallet.publicKey) return;
    await run(side, async () => {
      if (!wallet.signTransaction) throw new Error("wallet cannot sign");
      const res = await fetch("/api/flagship", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: side,
          wallet: wallet.publicKey!.toBase58(),
          amount: Number(amount),
          slippageBps: Number(slippage),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "could not build swap");
      const tx = Transaction.from(Buffer.from(json.transaction, "base64"));
      const signed = await wallet.signTransaction!(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
      });
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    });
    load();
  };

  if (!state) {    return (
      <div className="max-w-6xl mx-auto py-20 text-center text-slate-500 font-mono text-sm">
        Loading flagship launch…
      </div>
    );
  }

  // --- NOT LAUNCHED ---
  if (!state.launched) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-sans font-bold tracking-tight mb-2">
            Meteora Launchpad
          </h1>
          <p className="text-slate-400 font-mono text-sm">
            StockForge Governance ($FORGE) on Meteora&apos;s Dynamic Bonding Curve
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 md:p-8 space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-slate-300 font-sans font-bold">StockForge Governance · $FORGE</h2>
            <span className="px-2 py-1 rounded bg-amber-400/10 text-amber-400 text-[10px] font-mono font-bold">
              Meteora DBC
            </span>
          </div>
          <p className="text-slate-400 font-mono text-xs max-w-3xl">
            A single flagship token launch on Meteora&apos;s Dynamic Bonding Curve — deliberately
            separate from the asset-backed ETF vaults. The curve uses a linear fee scheduler and a
            custom DAMM v2 graduation fee tier tuned for equity-like assets.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-void/50 border border-slate-800 rounded-lg p-4">
              <p className="text-slate-500 font-mono text-[10px] uppercase mb-1">Supply</p>
              <p className="text-white font-mono font-bold">1,000,000,000</p>
              <p className="text-slate-500 font-mono text-[10px] mt-1">6 decimals · immutable</p>
            </div>
            <div className="bg-void/50 border border-slate-800 rounded-lg p-4">
              <p className="text-slate-500 font-mono text-[10px] uppercase mb-1">Base fee</p>
              <p className="text-white font-mono font-bold">3% → 0.5%</p>
              <p className="text-slate-500 font-mono text-[10px] mt-1">Linear · 12 periods / 24h</p>
            </div>
            <div className="bg-void/50 border border-slate-800 rounded-lg p-4">
              <p className="text-slate-500 font-mono text-[10px] uppercase mb-1">Graduation</p>
              <p className="text-white font-mono font-bold">5 SOL</p>
              <p className="text-slate-500 font-mono text-[10px] mt-1">25% migrated · DAMM v2 1% tier</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-void/60 p-4">
            <p className="text-slate-400 font-mono text-xs font-bold uppercase tracking-wide mb-2">
              Launch it
            </p>
            <p className="text-slate-400 font-mono text-xs">
              The DBC program lives on devnet/mainnet. Point the app at devnet and run the launch
              script with a funded key; the pool is then read live here.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 border border-slate-800 p-3 text-[11px] text-slate-200 font-mono">
{`# .env.local
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
RPC_URL=https://api.devnet.solana.com

npm run launch:flagship`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // --- LAUNCHED ---
  const progress = Math.max(0, Math.min(1, state.progress ?? 0));
  const cluster = state.network && state.network !== "mainnet-beta" ? `?cluster=${state.network}` : "";
  const link = (addr?: string) => (addr ? `https://solscan.io/account/${addr}${cluster}` : "#");
  const migTarget = 5;

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-sans font-bold tracking-tight mb-2">
          Meteora Launchpad
        </h1>
        <p className="text-slate-400 font-mono text-sm">
          {state.name} · ${state.symbol} — live on the Dynamic Bonding Curve
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 font-mono text-[10px] uppercase mb-1">{state.symbol} price</p>
          <p className="text-white font-mono font-bold">
            {state.price ? `${state.price.toFixed(6)} SOL` : "—"}
          </p>
          <p className="text-slate-500 font-mono text-[10px] mt-1">Spot on the curve</p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 font-mono text-[10px] uppercase mb-1">Quote raised</p>
          <p className="text-white font-mono font-bold">{(state.quoteReserve ?? 0).toFixed(4)} SOL</p>
          <p className="text-slate-500 font-mono text-[10px] mt-1">Target {migTarget} SOL</p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 font-mono text-[10px] uppercase mb-1">Market cap</p>
          <p className="text-white font-mono font-bold">{(state.marketCapSol ?? 0).toFixed(1)} SOL</p>
          <p className="text-slate-500 font-mono text-[10px] mt-1">
            {Number(state.totalSupply ?? 0).toLocaleString()} {state.symbol}
          </p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-500 font-mono text-[10px] uppercase mb-1">Status</p>
          <p className={`font-mono font-bold ${state.migrated ? "text-emerald-400" : "text-white"}`}>
            {state.migrated ? "Graduated" : "On curve"}
          </p>
          <p className="text-slate-500 font-mono text-[10px] mt-1">
            {state.onChain ? "Live on-chain" : "Indexed only"}
          </p>
        </div>
      </div>

      {/* Trade panel */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 md:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-white font-sans font-bold">
              {state.name} · ${state.symbol}
            </h2>
            <p className="text-slate-500 font-mono text-[11px] mt-1">
              pool {state.pool ? shortKey(state.pool) : "—"} · config{" "}
              {state.config ? shortKey(state.config) : "—"} ·{" "}
              {state.onChain ? "live" : "not found on this cluster"}
            </p>
          </div>
          {state.pool && (
            <a
              className="text-[11px] font-mono text-emerald-400 hover:underline shrink-0"
              href={link(state.pool)}
              target="_blank"
              rel="noreferrer"
            >
              View pool ↗
            </a>
          )}
        </div>

        {/* Progress */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Curve progress to graduation</span>
            <span>{(progress * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-emerald-400 transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-600">
            <span>{(state.baseReserve ?? 0).toLocaleString()} {state.symbol} in curve</span>
            <span>base fee 3% → 0.5% linear</span>
          </div>
        </div>

        {/* Buy / sell */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800 pt-4">
          <div>
            <label className="block text-slate-400 font-mono text-xs mb-2">
              Amount ({state.quoteSymbol ?? "SOL"})
            </label>
            <input
              className="w-full bg-void border border-slate-700 rounded-lg px-4 py-2 font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-mono text-xs mb-2">Slippage (bps)</label>
            <input
              className="w-full bg-void border border-slate-700 rounded-lg px-4 py-2 font-mono text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              type="number"
              min="1"
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <div className="text-[11px] font-mono text-slate-400">
              Wallet: <span className="text-slate-200">{sol.toFixed(3)} SOL</span> ·{" "}
              <span className="text-slate-200">
                {forge.toLocaleString()} {state.symbol}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => trade("buy")}
                disabled={!wallet.publicKey || busy === "buy" || !state.onChain}
                className="flex-1 py-2 rounded border border-emerald-400 text-emerald-400 font-mono text-sm hover:bg-emerald-400/10 transition-colors disabled:opacity-50"
              >
                {busy === "buy" ? "Buying..." : `Buy ${state.symbol}`}
              </button>
              <button
                onClick={() => trade("sell")}
                disabled={!wallet.publicKey || busy === "sell" || !state.onChain || forge <= 0}
                className="flex-1 py-2 rounded border border-orange-400 text-orange-400 font-mono text-sm hover:bg-orange-400/10 transition-colors disabled:opacity-50"
              >
                {busy === "sell" ? "Selling..." : "Sell"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>
            Quote asset: {state.quoteSymbol ?? "SOL"} ·{" "}
            <span>{state.quoteMint ? shortKey(state.quoteMint) : "—"}</span>
          </span>
          {msg ? <span className="text-slate-200">{msg}</span> : null}
        </div>
      </div>

      {/* Flagship is intentionally decoupled from the ETF vaults (review.md section 3) */}
      <p className="text-center text-slate-600 font-mono text-[10px]">
        The flagship DBC launch is intentionally separate from the 1:1 asset-backed ETF
        baskets (see review.md section 3).
      </p>
    </div>
  );
}
