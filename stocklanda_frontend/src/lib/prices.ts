import { PRESTOCKS_API, PYTH_HERMES } from "./constants";

export type PriceSource = "prestocks" | "pyth" | "unknown";

export interface AssetPrice {
  symbol: string;
  usd: number;
  source: PriceSource;
  changePct?: number;
  logo?: string;
  contract?: string;
}

interface PrestockRecord {
  symbol: string;
  markPrice: number;
  tokenPrice: number;
  contract_address: string;
  image?: string;
}

/** Fetch the PreStocks catalogue (pre-IPO equities on Solana). */
export async function fetchPrestocks(): Promise<Map<string, PrestockRecord>> {
  const res = await fetch(PRESTOCKS_API, { cache: "no-store" });
  if (!res.ok) throw new Error(`PreStocks API ${res.status}`);
  const json = (await res.json()) as PrestockRecord[];
  const map = new Map<string, PrestockRecord>();
  for (const r of json) map.set(r.symbol.toUpperCase(), r);
  return map;
}

/** Resolve the Pyth feed id for an equity symbol, preferring the 24/7 index feed. */
export async function pythFeedId(symbol: string): Promise<string | null> {
  const url = `${PYTH_HERMES}/v2/price_feeds?query=${encodeURIComponent(
    symbol
  )}&asset_type=equity`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const feeds = (await res.json()) as Array<{
    id: string;
    attributes?: { symbol?: string; display_symbol?: string };
  }>;
  const exact = feeds.filter(
    (f) =>
      (f.attributes?.display_symbol ?? "").toUpperCase() === symbol.toUpperCase()
  );
  const list = exact.length ? exact : feeds;
  const indexFeed = list.find((f) =>
    (f.attributes?.symbol ?? "").includes("Equity.Index")
  );
  return (indexFeed ?? list[0])?.id ?? null;
}

export async function pythLatest(
  feedId: string
): Promise<{ usd: number; changePct?: number } | null> {
  const url = `${PYTH_HERMES}/v2/updates/price/latest?ids[]=${feedId}&parsed=true`;
  const key = process.env.NEXT_PUBLIC_PYTH_API_KEY;
  const res = await fetch(url, {
    cache: "no-store",
    headers: key ? { Authorization: `Bearer ${key}` } : undefined,
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    parsed?: Array<{
      price: { price: string; expo: number; conf: string };
      ema_price?: { price: string; expo: number };
    }>;
  };
  const p = json.parsed?.[0];
  if (!p) return null;
  const usd = Number(p.price.price) * 10 ** p.price.expo;
  let changePct: number | undefined;
  if (p.ema_price) {
    const ema = Number(p.ema_price.price) * 10 ** p.ema_price.expo;
    if (ema > 0) changePct = ((usd - ema) / ema) * 100;
  }
  return { usd, changePct };
}

const FALLBACK: Record<string, number> = {
  NVDA: 121.4,
  MSFT: 417.2,
  AAPL: 228.6,
  SPACEX: 112.5,
  OPENAI: 1315.39,
  ANTHROPIC: 1015.08,
  ANDURIL: 149.48,
  KALSHI: 882.7,
  FIGUREAI: 172.24,
  NEURALINK: 430.7,
  POLYMARKET: 145.55,
};

/**
 * Resolve a USD price for a symbol, checking PreStocks first, then Pyth,
 * then falling back to a cached demo value.
 */
export async function resolvePrice(
  symbol: string,
  prestocks?: Map<string, PrestockRecord>
): Promise<AssetPrice> {
  const upper = symbol.toUpperCase();
  try {
    const ps = prestocks ?? (await fetchPrestocks());
    const rec = ps.get(upper);
    if (rec && rec.tokenPrice > 0) {
      return {
        symbol: upper,
        usd: rec.tokenPrice,
        source: "prestocks",
        logo: rec.image,
        contract: rec.contract_address,
      };
    }
  } catch {
    // ignore and try Pyth
  }
  try {
    const id = await pythFeedId(upper);
    if (id) {
      const latest = await pythLatest(id);
      if (latest) {
        return { symbol: upper, usd: latest.usd, source: "pyth", changePct: latest.changePct };
      }
    }
  } catch {
    // ignore
  }
  return { symbol: upper, usd: FALLBACK[upper] ?? 0, source: "unknown" };
}

export function tokenSymbol(mint: string, registry: Record<string, string>): string {
  return registry[mint] ?? `${mint.slice(0, 4)}…`;
}
