"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useCallback, useEffect, useState } from "react";
import { shortKey } from "@/lib/format";
import { Badge, Button, Card, Field, Spinner, Stat, inputClass } from "./ui";

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

export default function Flagship() {
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
      setMsg(`✓ ${sig.slice(0, 12)}…`);
    } catch (e: any) {
      console.error(e);
      setMsg(`✕ ${e?.message ?? "transaction failed"}`);
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

  if (!state) {
    return <Card className="text-sm text-ink-400">Loading flagship launch…</Card>;
  }

  if (!state.launched) {
    return (
      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">
                  StockForge Governance · $FORGE
                </h2>
                <Badge tone="warn">Meteora DBC</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-xs text-ink-400">
                A single flagship token launch on Meteora&apos;s Dynamic Bonding Curve —
                deliberately separate from the asset-backed ETF vaults. The curve uses a
                linear fee scheduler and a custom DAMM v2 graduation fee tier tuned for
                equity-like assets.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Stat label="Supply" value="1,000,000,000" sub="6 decimals · immutable" />
            <Stat label="Base fee" value="3% → 0.5%" sub="Linear, 12 periods / 24h" />
            <Stat label="Graduation" value="5 SOL" sub="25% supply migrated · DAMM v2 1% tier" />
          </div>

          <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
              Launch it
            </div>
            <p className="mt-2 text-xs text-ink-400">
              The DBC program is on devnet/mainnet. Point the app at devnet and run the
              launch script with a funded key; the pool address is then read live here.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-950 p-3 text-[11px] text-ink-200">
{`# .env.local
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
RPC_URL=https://api.devnet.solana.com

npm run launch:flagship`}
            </pre>
          </div>
        </Card>
      </div>
    );
  }

  const progress = Math.max(0, Math.min(1, state.progress ?? 0));
  const cluster = state.network && state.network !== "mainnet-beta" ? `?cluster=${state.network}` : "";
  const link = (addr?: string) => (addr ? `https://solscan.io/account/${addr}${cluster}` : "#");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={`${state.symbol} price`}
          value={state.price ? `${state.price.toFixed(6)} SOL` : "—"}
          sub="Spot on the bonding curve"
        />
        <Stat
          label="Quote raised"
          value={`${(state.quoteReserve ?? 0).toFixed(4)} SOL`}
          sub={`Target ${5} SOL`}
        />
        <Stat
          label="Market cap"
          value={`${(state.marketCapSol ?? 0).toFixed(1)} SOL`}
          sub={`${Number(state.totalSupply ?? 0).toLocaleString()} ${state.symbol}`}
        />
        <Stat
          label="Status"
          value={state.migrated ? "Graduated" : "On curve"}
          sub={state.onChain ? "Live on-chain" : "Indexed only"}
          tone={state.migrated ? "up" : "neutral"}
        />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">
                {state.name} · ${state.symbol}
              </h2>
              <Badge tone="brand">DBC</Badge>
            </div>
            <div className="num mt-1 text-[11px] text-ink-400">
              pool {state.pool ? shortKey(state.pool) : "—"} · config{" "}
              {state.config ? shortKey(state.config) : "—"} ·{" "}
              {state.onChain ? "live" : "not found on this cluster"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state.pool ? (
              <a
                className="text-[11px] text-brand hover:underline"
                href={link(state.pool)}
                target="_blank"
                rel="noreferrer"
              >
                View pool ↗
              </a>
            ) : null}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-ink-400">
            <span>Curve progress to graduation</span>
            <span className="num">{(progress * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-2 rounded-full bg-brand transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-ink-600">
            <span>{(state.baseReserve ?? 0).toLocaleString()} {state.symbol} in curve</span>
            <span>base fee 3% → 0.5% linear</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-ink-800 pt-4 md:grid-cols-3">
          <Field label="Amount" hint={state.quoteSymbol ?? "SOL"}>
            <input
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Slippage (bps)">
            <input
              className={inputClass}
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <div className="text-[11px] text-ink-400">
              Wallet: <span className="num text-ink-200">{sol.toFixed(3)} SOL</span> ·{" "}
              <span className="num text-ink-200">
                {forge.toLocaleString()} {state.symbol}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => trade("buy")}
                disabled={!wallet.publicKey || busy === "buy" || !state.onChain}
              >
                {busy === "buy" ? <Spinner label="Buying…" /> : `Buy ${state.symbol}`}
              </Button>
              <Button
                className="flex-1"
                variant="ghost"
                onClick={() => trade("sell")}
                disabled={!wallet.publicKey || busy === "sell" || !state.onChain || forge <= 0}
              >
                {busy === "sell" ? <Spinner label="Selling…" /> : "Sell"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-ink-400">
          <span>
            Quote asset: {state.quoteSymbol ?? "SOL"} ·{" "}
            <span className="num">{state.quoteMint ? shortKey(state.quoteMint) : "—"}</span>
          </span>
          {msg ? <span className="text-ink-200">{msg}</span> : null}
        </div>
      </Card>
    </div>
  );
}
