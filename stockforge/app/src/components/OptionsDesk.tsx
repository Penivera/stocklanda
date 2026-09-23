"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@anchor-lang/core";
import { SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { useMemo, useState } from "react";
import {
  useConfig,
  useOptions,
  usePriceMap,
  useProgram,
  useRegistry,
} from "@/lib/hooks";
import { configPda, optionPda } from "@/lib/pda";
import { ensureAta, compactIxs } from "@/lib/tx";
import { fromUi, shortKey, toUi, token, usd } from "@/lib/format";
import { Badge, Button, Card, Field, Spinner, Stat, inputClass } from "./ui";

function typeOf(account: any): "put" | "call" {
  return account.optionType?.put !== undefined ? "put" : "call";
}
function statusOf(account: any): string {
  const s = account.status;
  if (s?.open !== undefined) return "open";
  if (s?.active !== undefined) return "active";
  if (s?.settled !== undefined) return "settled";
  if (s?.cancelled !== undefined) return "cancelled";
  return "unknown";
}

export default function OptionsDesk() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useProgram();
  const registry = useRegistry();
  const config = useConfig();
  const options = useOptions();
  const prices = usePriceMap(
    registry,
    options,
    []
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showWrite, setShowWrite] = useState(false);

  const quoteMint = config?.quoteMint;
  const symbolOf = (mint: string) => registry?.symbolByMint?.[mint] ?? shortKey(mint);

  const tradableMints = useMemo(
    () => (registry?.mints ?? []).filter((m) => m.symbol !== "USDC"),
    [registry]
  );

  const [type, setType] = useState<"put" | "call">("put");
  const [underlying, setUnderlying] = useState<string>("");
  const [strike, setStrike] = useState("120");
  const [size, setSize] = useState("1");
  const [premium, setPremium] = useState("5");
  const [minutes, setMinutes] = useState("60");

  const collateralPreview = useMemo(() => {
    const s = Number(size) || 0;
    if (type === "put") return (s * (Number(strike) || 0)).toFixed(2) + " USDC";
    return s.toFixed(2) + " underlying";
  }, [type, size, strike]);

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

  const faucet = async () => {
    if (!wallet.publicKey) return;
    await run("faucet", async () => {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: wallet.publicKey!.toBase58() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "faucet failed");
      return json.signature ?? "funded";
    });
  };

  const write = async () => {
    if (!wallet.publicKey || !quoteMint) return;
    await run("write", async () => {
      const writer = wallet.publicKey!;
      const id = Date.now() % 1_000_000_000;
      const option = optionPda(writer, id);
      const underlyingMint = (type === "call"
        ? tradableMints.find((m) => m.address === underlying)
        : tradableMints.find((m) => m.address === underlying))?.address;
      if (!underlyingMint) throw new Error("select an underlying");

      const collateralMint =
        type === "put" ? quoteMint : new (await import("@solana/web3.js")).PublicKey(underlyingMint);
      const sizeBn = fromUi(Number(size));
      const strikeBn = fromUi(Number(strike));
      const collateral =
        type === "put"
          ? fromUi((Number(size) * Number(strike)))
          : sizeBn;

      const writerCollateral = await ensureAta(
        connection,
        writer,
        writer,
        collateralMint
      );
      const vault = getAssociatedTokenAddressSync(collateralMint, option, true);
      const expiry = Math.floor(Date.now() / 1000) + Number(minutes) * 60;

      return program.methods
        .listOption(
          new BN(id),
          type === "put" ? { put: {} } : { call: {} },
          strikeBn,
          sizeBn,
          fromUi(Number(premium)),
          collateral,
          new BN(expiry)
        )
        .accounts({
          writer,
          config: configPda(),
          option,
          underlyingMint,
          collateralMint,
          premiumMint: quoteMint,
          writerCollateral: writerCollateral.address,
          vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions(writerCollateral.ix ? [writerCollateral.ix] : [])
        .rpc();
    });
  };

  const buy = async (option: any) => {
    if (!wallet.publicKey) return;
    const key = `buy-${option.publicKey.toBase58()}`;
    await run(key, async () => {
      const buyer = wallet.publicKey!;
      const a = option.account;
      const premiumMint = a.premiumMint;
      const [buyerAta, writerAta] = await Promise.all([
        ensureAta(connection, buyer, buyer, premiumMint),
        ensureAta(connection, buyer, a.writer, premiumMint),
      ]);
      const { ix } = compactIxs([buyerAta, writerAta]);
      return program.methods
        .buyOption()
        .accounts({
          buyer,
          config: configPda(),
          option: option.publicKey,
          premiumMint,
          buyerPremium: buyerAta.address,
          writerPremium: writerAta.address,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .preInstructions(ix)
        .rpc();
    });
  };

  const settle = async (option: any) => {
    const key = `settle-${option.publicKey.toBase58()}`;
    await run(key, async () => {
      const res = await fetch("/api/settle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ option: option.publicKey.toBase58() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "settle failed");
      return json.signature ?? "settled";
    });
  };

  const openCount = options.filter((o) => statusOf(o.account) === "open").length;
  const activeCount = options.filter((o) => statusOf(o.account) === "active").length;
  const collateralLocked = options
    .filter((o) => statusOf(o.account) !== "settled" && statusOf(o.account) !== "cancelled")
    .reduce((s, o) => {
      const t = typeOf(o.account);
      const amt = toUi(o.account.collateralAmount);
      return s + (t === "put" ? amt : 0);
    }, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open listings" value={openCount} />
        <Stat label="Active contracts" value={activeCount} />
        <Stat label="USDC collateral" value={usd(collateralLocked * 1e6)} />
        <Stat
          label="Quote asset"
          value={quoteMint ? symbolOf(quoteMint.toString()) : "—"}
          sub="Premium & put collateral"
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Options desk</h2>
            <p className="text-xs text-ink-400">
              Fully-collateralised puts and covered calls, settled on-chain.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {msg ? <span className="text-xs text-ink-300">{msg}</span> : null}
            {busy === "faucet" ? <Spinner /> : null}
            <Button variant="ghost" onClick={faucet} disabled={!wallet.publicKey || busy === "faucet"}>
              Get test tokens
            </Button>
            <Button onClick={() => setShowWrite((v) => !v)}>
              {showWrite ? "Close" : "Write option"}
            </Button>
          </div>
        </div>

        {showWrite ? (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-ink-800 pt-5 md:grid-cols-3">
            <Field label="Type">
              <div className="flex gap-2">
                {(["put", "call"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold uppercase ${
                      type === t
                        ? t === "put"
                          ? "border-down/50 bg-down/10 text-down"
                          : "border-up/50 bg-up/10 text-up"
                        : "border-ink-700 text-ink-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Underlying">
              <select
                className={inputClass}
                value={underlying}
                onChange={(e) => setUnderlying(e.target.value)}
              >
                <option value="">Select…</option>
                {tradableMints.map((m) => (
                  <option key={m.address} value={m.address}>
                    {m.symbol}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Strike (USD)">
              <input className={inputClass} value={strike} onChange={(e) => setStrike(e.target.value)} />
            </Field>
            <Field label="Size (tokens)">
              <input className={inputClass} value={size} onChange={(e) => setSize(e.target.value)} />
            </Field>
            <Field label="Premium (USDC)">
              <input className={inputClass} value={premium} onChange={(e) => setPremium(e.target.value)} />
            </Field>
            <Field label="Expiry (minutes)">
              <input className={inputClass} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </Field>
            <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-ink-400">
                Writer locks <span className="num text-ink-200">{collateralPreview}</span> as collateral
              </div>
              <Button onClick={write} disabled={!wallet.publicKey || busy === "write" || !underlying}>
                {busy === "write" ? <Spinner label="Listing…" /> : "Lock collateral & list"}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {options.length === 0 ? (
          <Card className="text-sm text-ink-400">
            No options on-chain yet. Connect a wallet and write the first listing.
          </Card>
        ) : null}
        {options
          .slice()
          .sort((a, b) => Number(b.account.expiry.toString()) - Number(a.account.expiry.toString()))
          .map((o) => {
            const a = o.account;
            const t = typeOf(a);
            const st = statusOf(a);
            const symbol = symbolOf(a.underlyingMint.toString());
            const spot = prices[a.underlyingMint.toString()]?.usd ?? 0;
            const strike = toUi(a.strike);
            const itm = t === "put" ? spot > 0 && spot < strike : spot > 0 && spot > strike;
            const expired = Date.now() / 1000 >= Number(a.expiry.toString());
            return (
              <Card key={o.publicKey.toBase58()} className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone={t === "put" ? "down" : "up"}>{t}</Badge>
                    <span className="text-sm font-semibold text-white">{symbol}</span>
                    <span className="num text-xs text-ink-400">
                      ${strike.toLocaleString()}
                    </span>
                  </div>
                  <Badge
                    tone={
                      st === "open" ? "brand" : st === "active" ? "warn" : "muted"
                    }
                  >
                    {st}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-ink-400">Size</div>
                    <div className="num text-ink-100">{token(a.size)}</div>
                  </div>
                  <div>
                    <div className="text-ink-400">Premium</div>
                    <div className="num text-ink-100">{usd(a.premium)}</div>
                  </div>
                  <div>
                    <div className="text-ink-400">Spot</div>
                    <div className={`num ${itm ? "text-up" : "text-ink-100"}`}>
                      {spot ? usd(spot * 1e6) : "—"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-ink-400">
                  <span>
                    exp {new Date(Number(a.expiry.toString()) * 1000).toLocaleString()}
                  </span>
                  <span className="num">{shortKey(a.writer.toString())}</span>
                </div>

                <div className="flex items-center gap-2">
                  {st === "open" && !expired ? (
                    <Button
                      onClick={() => buy(o)}
                      disabled={!wallet.publicKey || busy === `buy-${o.publicKey.toBase58()}`}
                      className="flex-1"
                    >
                      {busy === `buy-${o.publicKey.toBase58()}` ? (
                        <Spinner label="Buying…" />
                      ) : (
                        `Buy for ${usd(a.premium)}`
                      )}
                    </Button>
                  ) : null}
                  {st === "active" && expired ? (
                    <Button
                      variant="ghost"
                      onClick={() => settle(o)}
                      disabled={busy === `settle-${o.publicKey.toBase58()}`}
                      className="flex-1"
                    >
                      {busy === `settle-${o.publicKey.toBase58()}` ? (
                        <Spinner label="Settling…" />
                      ) : (
                        "Settle (crank)"
                      )}
                    </Button>
                  ) : null}
                  {st === "settled" ? (
                    <span className="text-xs text-ink-400">
                      Settled at {usd(a.settledPrice)}
                    </span>
                  ) : null}
                  {st === "active" && !expired ? (
                    <span className="text-xs text-ink-400">
                      Awaiting expiry · holder {shortKey(a.buyer.toString())}
                    </span>
                  ) : null}
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
