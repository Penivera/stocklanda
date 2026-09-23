"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@anchor-lang/core";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { useEffect, useMemo, useState } from "react";
import {
  basketNav,
  useBaskets,
  useConfig,
  usePriceMap,
  useProgram,
  useRegistry,
} from "@/lib/hooks";
import { basketMintPda, basketPda, configPda } from "@/lib/pda";
import { ensureAta, compactIxs } from "@/lib/tx";
import { shortKey, token, usd } from "@/lib/format";
import { Badge, Button, Card, Field, Spinner, Stat, inputClass } from "./ui";

interface Row {
  mint: string;
  amount: string;
  weight: string;
}

export default function Baskets() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useProgram();
  const registry = useRegistry();
  const config = useConfig();
  const baskets = useBaskets();
  const prices = usePriceMap(registry, [], baskets);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const tradable = useMemo(
    () => (registry?.mints ?? []).filter((m) => m.symbol !== "USDC"),
    [registry]
  );

  const [name, setName] = useState("AI Titans");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (rows.length === 0 && tradable.length > 0) {
      const defaults = [4000, 3500, 2500];
      setRows(
        tradable.slice(0, 3).map((m, i) => ({
          mint: m.address,
          amount: i === 0 ? "2" : "1",
          weight: String(defaults[i] ?? Math.floor(10000 / tradable.length)),
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradable.length]);

  const symbolOf = (mint: string) =>
    registry?.symbolByMint?.[mint] ?? shortKey(mint);

  // wallet share balances per basket
  useEffect(() => {
    if (!wallet.publicKey || baskets.length === 0) return;
    let active = true;
    (async () => {
      const entries = await Promise.all(
        baskets.map(async (b) => {
          const mint = b.account.shareMint as PublicKey;
          const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey!, true);
          try {
            const bal = await connection.getTokenAccountBalance(ata);
            return [b.publicKey.toBase58(), bal.value.uiAmount ?? 0] as const;
          } catch {
            return [b.publicKey.toBase58(), 0] as const;
          }
        })
      );
      if (active) setBalances(Object.fromEntries(entries));
    })();
    return () => {
      active = false;
    };
  }, [wallet.publicKey, baskets, connection, busy]);

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

  const create = async () => {
    if (!wallet.publicKey) return;
    await run("create", async () => {
      const creator = wallet.publicKey!;
      const nonce = Date.now() % 1_000_000_000;
      const basket = basketPda(creator, nonce);
      const shareMint = basketMintPda(basket);
      const components = rows.map((r) => ({
        mint: new PublicKey(r.mint),
        amountPerUnit: new BN(Math.round(Number(r.amount) * 1e6)),
        weightBps: Number(r.weight),
      }));
      return program.methods
        .createBasket(new BN(nonce), name, components)
        .accounts({
          creator,
          config: configPda(),
          basket,
          shareMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });
  };

  const mint = async (b: any, units: string) => {
    if (!wallet.publicKey) return;
    const key = `mint-${b.publicKey.toBase58()}`;
    await run(key, async () => {
      const user = wallet.publicKey!;
      const components = b.account.components;
      const rem: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[] = [];
      const ixs = [];
      for (const c of components) {
        const cmint = c.mint as PublicKey;
        const vault = getAssociatedTokenAddressSync(cmint, b.publicKey, true);
        const vaultRes = await ensureAta(connection, user, b.publicKey, cmint);
        const srcRes = await ensureAta(connection, user, user, cmint);
        if (vaultRes.ix) ixs.push(vaultRes.ix);
        if (srcRes.ix) ixs.push(srcRes.ix);
        rem.push({ pubkey: cmint, isWritable: true, isSigner: false });
        rem.push({ pubkey: vault, isWritable: true, isSigner: false });
        rem.push({ pubkey: srcRes.address, isWritable: true, isSigner: false });
      }
      const userShare = await ensureAta(connection, user, user, b.account.shareMint);
      if (userShare.ix) ixs.push(userShare.ix);
      return program.methods
        .mintBasket(new BN(Math.round(Number(units) * 1e6)))
        .accounts({
          user,
          basket: b.publicKey,
          shareMint: b.account.shareMint,
          userShare: userShare.address,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(rem)
        .preInstructions(ixs)
        .rpc();
    });
  };

  const redeem = async (b: any, units: string) => {
    if (!wallet.publicKey) return;
    const key = `redeem-${b.publicKey.toBase58()}`;
    await run(key, async () => {
      const user = wallet.publicKey!;
      const rem: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[] = [];
      const ixs = [];
      for (const c of b.account.components) {
        const cmint = c.mint as PublicKey;
        const vault = getAssociatedTokenAddressSync(cmint, b.publicKey, true);
        const destRes = await ensureAta(connection, user, user, cmint);
        if (destRes.ix) ixs.push(destRes.ix);
        rem.push({ pubkey: cmint, isWritable: true, isSigner: false });
        rem.push({ pubkey: vault, isWritable: true, isSigner: false });
        rem.push({ pubkey: destRes.address, isWritable: true, isSigner: false });
      }
      const userShare = getAssociatedTokenAddressSync(b.account.shareMint, user, true);
      return program.methods
        .redeemBasket(new BN(Math.round(Number(units) * 1e6)))
        .accounts({
          user,
          basket: b.publicKey,
          shareMint: b.account.shareMint,
          userShare,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts(rem)
        .preInstructions(ixs)
        .rpc();
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Baskets" value={baskets.length} />
        <Stat
          label="Components"
          value={baskets.reduce((s, b) => s + (b.account.components?.length ?? 0), 0)}
        />
        <Stat label="Quote asset" value={config ? symbolOf(config.quoteMint.toString()) : "—"} />
        <Stat label="Model" value="1:1 vault" sub="Asset-backed, burn to redeem" />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Basket composer</h2>
            <p className="text-xs text-ink-400">
              Define a weighted recipe, mint a share token, redeem for the underlying.
            </p>
          </div>
          {msg ? <span className="text-xs text-ink-300">{msg}</span> : null}
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-5">
                  <Field label={i === 0 ? "Underlying" : ""}>
                    <select
                      className={inputClass}
                      value={r.mint}
                      onChange={(e) =>
                        setRows(rows.map((x, j) => (j === i ? { ...x, mint: e.target.value } : x)))
                      }
                    >
                      {tradable.map((m) => (
                        <option key={m.address} value={m.address}>
                          {m.symbol}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="col-span-3">
                  <Field label={i === 0 ? "Units / share" : ""}>
                    <input
                      className={inputClass}
                      value={r.amount}
                      onChange={(e) =>
                        setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
                      }
                    />
                  </Field>
                </div>
                <div className="col-span-3">
                  <Field label={i === 0 ? "Weight (bps)" : ""}>
                    <input
                      className={inputClass}
                      value={r.weight}
                      onChange={(e) =>
                        setRows(rows.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))
                      }
                    />
                  </Field>
                </div>
                <div className="col-span-1 pb-1.5">
                  {rows.length > 1 ? (
                    <button
                      className="w-full rounded-lg border border-ink-700 py-2 text-xs text-ink-400 hover:text-down"
                      onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-ink-400">
              Weights sum:{" "}
              <span className="num text-ink-200">
                {rows.reduce((s, r) => s + Number(r.weight || 0), 0)}
              </span>{" "}
              / 10000 bps
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() =>
                  setRows([...rows, { mint: tradable[0]?.address ?? "", amount: "1", weight: "0" }])
                }
                disabled={rows.length >= 8 || tradable.length === 0}
              >
                Add component
              </Button>
              <Button onClick={create} disabled={!wallet.publicKey || busy === "create" || rows.length === 0}>
                {busy === "create" ? <Spinner label="Creating…" /> : "Create basket"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {baskets.length === 0 ? (
          <Card className="text-sm text-ink-400">No baskets yet.</Card>
        ) : null}
        {baskets.map((b) => {
          const nav = basketNav(b, prices);
          const bal = balances[b.publicKey.toBase58()] ?? 0;
          const key = b.publicKey.toBase58();
          return (
            <Card key={key} className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{b.account.name}</div>
                  <div className="num text-[11px] text-ink-400">
                    {b.account.shareMint.toString().slice(0, 8)}…
                  </div>
                </div>
                <Badge tone="brand">ETF</Badge>
              </div>

              <div className="space-y-1.5">
                {(b.account.components ?? []).map((c: any, i: number) => {
                  const symbol = symbolOf(c.mint.toString());
                  const p = prices[c.mint.toString()]?.usd ?? 0;
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-ink-300">
                        {symbol}{" "}
                        <span className="text-ink-600">
                          {Number(c.weightBps) / 100}%
                        </span>
                      </span>
                      <span className="num text-ink-400">
                        {token(c.amountPerUnit)} · {p ? usd(p * 1e6) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-ink-800 pt-3 text-xs">
                <div>
                  <div className="text-ink-400">NAV / unit</div>
                  <div className="num text-base text-white">{usd(nav * 1e6)}</div>
                </div>
                <div className="text-right">
                  <div className="text-ink-400">Your shares</div>
                  <div className="num text-base text-white">{bal.toLocaleString()}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => mint(b, "1")}
                  disabled={!wallet.publicKey || busy === `mint-${key}`}
                >
                  {busy === `mint-${key}` ? <Spinner label="Minting…" /> : "Mint 1 unit"}
                </Button>
                <Button
                  className="flex-1"
                  variant="ghost"
                  onClick={() => redeem(b, bal > 1 ? "1" : String(bal))}
                  disabled={!wallet.publicKey || bal <= 0 || busy === `redeem-${key}`}
                >
                  {busy === `redeem-${key}` ? <Spinner label="Redeeming…" /> : "Redeem 1 unit"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
