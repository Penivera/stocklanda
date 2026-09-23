"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";
import OptionsDesk from "./OptionsDesk";
import Baskets from "./Baskets";
import { Badge, Card } from "./ui";
import { fetchPrestocks, resolvePrice, type AssetPrice } from "@/lib/prices";
import { RPC_URL } from "@/lib/constants";

type Tab = "options" | "baskets" | "markets";

const TABS: { id: Tab; label: string }[] = [
  { id: "options", label: "Options desk" },
  { id: "baskets", label: "Basket ETFs" },
  { id: "markets", label: "Markets" },
];

const EQUITIES = ["NVDA", "MSFT", "AAPL"];

function Markets() {
  const [prestocks, setPrestocks] = useState<AssetPrice[]>([]);
  const [equities, setEquities] = useState<AssetPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const ps = await fetchPrestocks();
        const rows = Array.from(ps.values())
          .slice(0, 8)
          .map((r) => ({
            symbol: r.symbol,
            usd: r.tokenPrice,
            source: "prestocks" as const,
            logo: r.image,
          }));
        if (active) setPrestocks(rows);
      } catch {
        /* ignore */
      }
      const eq = await Promise.all(EQUITIES.map((s) => resolvePrice(s)));
      if (active) {
        setEquities(eq);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const PriceCard = ({ p, pre }: { p: AssetPrice; pre?: boolean }) => (
    <Card className="flex items-center justify-between gap-3 py-3.5">
      <div className="flex items-center gap-3">
        {p.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logo} alt="" className="h-8 w-8 rounded-full border border-ink-700" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-700 text-[10px] text-ink-400">
            {p.symbol.slice(0, 2)}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-white">{p.symbol}</div>
          <div className="text-[11px] text-ink-400">
            {pre
              ? "PreStocks · pre-IPO"
              : p.source === "pyth"
                ? "Pyth · 24/7 equity"
                : "Pyth feed · indicative"}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="num text-sm font-semibold text-white">
          {p.usd ? `$${p.usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
        </div>
        {typeof p.changePct === "number" ? (
          <div className={`num text-[11px] ${p.changePct >= 0 ? "text-up" : "text-down"}`}>
            {p.changePct >= 0 ? "+" : ""}
            {p.changePct.toFixed(2)}% vs EMA
          </div>
        ) : (
          <div className="text-[11px] text-ink-600">mark</div>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Pre-IPO markets</h2>
          <Badge tone="brand">PreStocks API</Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {prestocks.map((p) => (
            <PriceCard key={p.symbol} p={p} pre />
          ))}
          {prestocks.length === 0 ? (
            <Card className="text-xs text-ink-400">Loading PreStocks catalogue…</Card>
          ) : null}
        </div>
      </div>
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Public equities</h2>
          <Badge tone="warn">Pyth Network</Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {equities.map((p) => (
            <PriceCard key={p.symbol} p={p} />
          ))}
        </div>
      </div>
      {loading ? <div className="text-xs text-ink-400">Fetching live prices…</div> : null}
    </div>
  );
}

export default function StockForgeApp() {
  const [tab, setTab] = useState<Tab>("options");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-sm font-bold text-brand">
              SF
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white">StockForge</div>
              <div className="text-[11px] text-ink-400">Options & ETFs on tokenised stocks</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] text-ink-400 md:inline">
              {RPC_URL.includes("127.0.0.1") ? "localnet" : "devnet"}
            </span>
            <WalletMultiButton />
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 px-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "border-brand text-white"
                  : "border-transparent text-ink-400 hover:text-ink-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        {tab === "options" ? <OptionsDesk /> : null}
        {tab === "baskets" ? <Baskets /> : null}
        {tab === "markets" ? <Markets /> : null}
      </main>

      <footer className="mx-auto max-w-7xl px-5 pb-10 pt-4 text-[11px] text-ink-600">
        StockForge · fully-collateralised options & asset-backed baskets · settled on
        Solana with Pyth & PreStocks data
      </footer>
    </div>
  );
}
