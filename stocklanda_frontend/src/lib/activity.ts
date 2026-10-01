/**
 * Recent StockForge activity for a wallet, decoded from on-chain history.
 *
 * Fetches the wallet's latest signatures, keeps only transactions that touch
 * the StockForge program, decodes the Anchor instruction against the IDL, and
 * renders a semantic entry (tag + title + amount) for the dashboard —
 * e.g. "NVDA PUT / BOUGHT • 2m ago / -$10.00".
 */
import { BorshInstructionCoder, utils } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import idl from "@/idl/stockforge.json";
import { PROGRAM_ID } from "./constants";
import { shortKey } from "./format";
import type { Registry } from "./hooks";

export interface ActivityEntry {
  signature: string;
  /** e.g. "LISTED", "BOUGHT", "SETTLED", "MINTED", "REDEEMED". */
  tag: string;
  /** e.g. "NVDA PUT", "AI Titans ×2". */
  title: string;
  /** Signed amount with symbol, e.g. "-10 USDC". Null when nothing moved. */
  amount: string | null;
  positive: boolean;
  err: boolean;
  /** Relative time label, e.g. "2m ago". */
  time: string;
}

const PROGRAM_ID_STR = PROGRAM_ID.toBase58();
const coder = new BorshInstructionCoder(idl as never);

/** Instruction account ordering, straight from the IDL. */
const IX_ACCOUNTS: Record<string, string[]> = {};
for (const ix of (idl as any).instructions) {
  IX_ACCOUNTS[ix.name] = (ix.accounts as any[]).map((a) => a.name);
}

function decodeInstruction(dataB58: string): { name: string; data: any } | null {
  try {
    const raw = Buffer.from(utils.bytes.bs58.decode(dataB58));
    const decoded = coder.decode(raw) as any;
    return decoded ? { name: decoded.name, data: decoded.data } : null;
  } catch {
    return null;
  }
}

function toKeyStr(key: any): string {
  if (!key) return "";
  if (typeof key === "string") return key;
  if (typeof key.toBase58 === "function") return key.toBase58();
  return String(key);
}

/** "just now" · "5m ago" · "3h ago" · locale date beyond 24h. */
function relTime(blockTime: number | null | undefined): string {
  if (!blockTime) return "pending";
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - blockTime);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(blockTime * 1000).toLocaleDateString();
}

/** Net token-balance change for the wallet, per mint. */
function walletTokenDeltas(tx: any, walletStr: string): { mint: string; delta: number }[] {
  const by = new Map<string, number>();
  const add = (mint: string, v: number) => by.set(mint, (by.get(mint) ?? 0) + v);
  for (const b of tx?.meta?.preTokenBalances ?? []) {
    if (b?.owner === walletStr) add(b.mint, -(b.uiTokenAmount?.uiAmount ?? 0));
  }
  for (const b of tx?.meta?.postTokenBalances ?? []) {
    if (b?.owner === walletStr) add(b.mint, b.uiTokenAmount?.uiAmount ?? 0);
  }
  return [...by.entries()]
    .map(([mint, delta]) => ({ mint, delta }))
    .filter((d) => Math.abs(d.delta) > 1e-9);
}

/** Pick the most meaningful delta: basket shares first, then quote, then biggest. */
function pickDelta(
  deltas: { mint: string; delta: number }[],
  registry: Registry | null
): { mint: string; delta: number } | null {
  if (deltas.length === 0) return null;
  const shareMints = new Set((registry?.baskets ?? []).map((b) => b.shareMint));
  const quote = registry?.quoteMint;
  return (
    deltas.find((d) => shareMints.has(d.mint)) ??
    deltas.find((d) => d.mint === quote) ??
    deltas.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a))
  );
}

function fmtAmount(mint: string, delta: number, registry: Registry | null): string {
  const symbol = registry?.symbolByMint?.[mint] ?? shortKey(mint);
  const abs = Math.abs(delta);
  const txt =
    abs >= 1000
      ? abs.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : String(parseFloat(abs.toFixed(4)));
  return `${delta < 0 ? "-" : "+"}${txt} ${symbol}`;
}

/**
 * Fetch and decode the wallet's recent StockForge activity. Only transactions
 * that invoke the StockForge program are returned; everything else (random
 * transfers, DBC trades, airdrops) is filtered out.
 */
export async function fetchRecentActivity(
  connection: Connection,
  wallet: PublicKey,
  registry: Registry | null,
  program: any,
  limit = 6
): Promise<ActivityEntry[]> {
  const walletStr = wallet.toBase58();
  const sigs = await connection.getSignaturesForAddress(wallet, { limit: 20 });
  if (sigs.length === 0) return [];

  const optionCache = new Map<string, any | null>();
  const fetchOption = async (pk?: string) => {
    if (!pk) return null;
    if (!optionCache.has(pk)) {
      try {
        optionCache.set(pk, await program.account.optionContract.fetch(new PublicKey(pk)));
      } catch {
        optionCache.set(pk, null);
      }
    }
    return optionCache.get(pk);
  };

  const symbolOf = (mint?: string) =>
    (mint && registry?.symbolByMint?.[mint]) || (mint ? shortKey(mint) : "");
  // Anchor enum shapes differ by source: instruction decoding yields
  // PascalCase keys ({ Put: {} }), account fetches yield lowercase ({ put: {} }).
  const typeOf = (t: any): "PUT" | "CALL" => {
    const keys = Object.keys(t ?? {}).map((k) => k.toLowerCase());
    return keys.includes("put") ? "PUT" : "CALL";
  };
  const basketName = (shareMint?: string, basketPk?: string) =>
    (shareMint && registry?.baskets?.find((b) => b.shareMint === shareMint)?.name) ||
    (basketPk && registry?.baskets?.find((b) => b.basket === basketPk)?.name) ||
    "Basket";

  const entries: ActivityEntry[] = [];

  // Fetch transactions one at a time (each is a separate RPC call) and stop
  // as soon as we have enough program activity — parallel batches trip the
  // public RPC rate limit (HTTP 429).
  for (let i = 0; i < sigs.length && entries.length < limit; i++) {
    let tx: any;
    try {
      tx = await connection.getParsedTransaction(sigs[i].signature, {
        maxSupportedTransactionVersion: 0,
      });
    } catch {
      break; // rate-limited or transient RPC failure — keep what we have
    }
    if (!tx) continue;

    // First outer instruction that targets the StockForge program.
    const ix = (tx.transaction.message.instructions as any[]).find(
      (x) => toKeyStr(x?.programId) === PROGRAM_ID_STR
    );
    if (!ix?.data) continue;
    const decoded = decodeInstruction(ix.data);
    if (!decoded) continue;

    const acctStrs = (ix.accounts ?? []).map(toKeyStr);
    const acct = (name: string): string | undefined => {
      const idx = (IX_ACCOUNTS[decoded.name] ?? []).indexOf(name);
      return idx >= 0 ? acctStrs[idx] : undefined;
    };

    let tag = decoded.name.replace(/_/g, " ").toUpperCase();
    let title = "StockForge";

    switch (decoded.name) {
      case "list_option": {
        tag = "LISTED";
        // Instruction decoding keeps snake_case arg names + PascalCase enum
        // keys; account fetches are camelCase/lowercase. Accept both.
        const optType = decoded.data?.option_type ?? decoded.data?.optionType;
        title = `${symbolOf(acct("underlying_mint"))} ${typeOf(optType)}`;
        break;
      }
      case "buy_option": {
        tag = "BOUGHT";
        const opt = await fetchOption(acct("option"));
        title = opt ? `${symbolOf(toKeyStr(opt.underlyingMint))} ${typeOf(opt.optionType)}` : "Option";
        break;
      }
      case "settle_option":
      case "settle_option_pyth": {
        tag = "SETTLED";
        const opt = await fetchOption(acct("option"));
        title = opt ? `${symbolOf(toKeyStr(opt.underlyingMint))} ${typeOf(opt.optionType)}` : "Option";
        break;
      }
      case "cancel_option": {
        tag = "CANCELLED";
        const opt = await fetchOption(acct("option"));
        title = opt ? `${symbolOf(toKeyStr(opt.underlyingMint))} ${typeOf(opt.optionType)}` : "Option";
        break;
      }
      case "create_basket": {
        tag = "BASKET CREATED";
        title = decoded.data?.name ?? "Basket";
        break;
      }
      case "mint_basket":
      case "redeem_basket": {
        tag = decoded.name === "mint_basket" ? "MINTED" : "REDEEMED";
        const units = Number(decoded.data?.units?.toString?.() ?? "0") / 1e6;
        title = `${basketName(acct("share_mint"), acct("basket"))} ×${parseFloat(units.toFixed(4))}`;
        break;
      }
      case "initialize_config": {
        tag = "CONFIG INIT";
        title = "Protocol config";
        break;
      }
    }

    const err = !!tx.meta?.err;
    const picked = err ? null : pickDelta(walletTokenDeltas(tx, walletStr), registry);

    entries.push({
      signature: sigs[i].signature,
      tag,
      title,
      amount: picked ? fmtAmount(picked.mint, picked.delta, registry) : null,
      positive: picked ? picked.delta > 0 : true,
      err,
      time: relTime(tx.blockTime ?? sigs[i].blockTime),
    });
  }

  return entries;
}
