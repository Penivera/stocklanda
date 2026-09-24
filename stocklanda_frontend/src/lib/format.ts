import BN from "bn.js";
import { PRICE_DECIMALS } from "./constants";

export function toUi(value: BN | bigint | number, decimals = 6): number {
  return Number(value.toString()) / 10 ** decimals;
}

export function fromUi(value: number, decimals = 6): BN {
  return new BN(Math.round(value * 10 ** decimals));
}

export function usd(value: BN | bigint | number, decimals = 6): string {
  const n = toUi(value, decimals);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 1 ? 4 : 2,
  });
}

export function token(value: BN | bigint | number, decimals = 6): string {
  const n = toUi(value, decimals);
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function shortKey(key: { toBase58(): string } | string): string {
  const k = typeof key === "string" ? key : key.toBase58();
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export function bps(percent: number): BN {
  return new BN(Math.round((percent / 100) * 10_000));
}

export { PRICE_DECIMALS };
