import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "E4t7DUwrLKgxpGb88686DtqrRqnHd5GCKE3ASwR8SCwi"
);

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8899";

/** All prices/strikes/amounts use 6 decimals. */
export const PRICE_DECIMALS = 1_000_000;

export const BPS_DENOMINATOR = 10_000;

export const SEED = {
  config: "config",
  option: "option",
  basket: "basket",
  basketMint: "basket_mint",
} as const;

/** Off-chain price feeds used by the UI. */
export const PRESTOCKS_API = "https://prestocks.com/api/prestocks";
export const PYTH_HERMES = "https://hermes.pyth.network";
