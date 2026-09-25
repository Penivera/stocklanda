import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "E4t7DUwrLKgxpGb88686DtqrRqnHd5GCKE3ASwR8SCwi"
);

/** RPC endpoint. Defaults to devnet for the deployed demo; override via env. */
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

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

/** Wrapped SOL — used as the quote asset for the Meteora DBC flagship launch. */
export const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Meteora Dynamic Bonding Curve program (same address on devnet & mainnet). */
export const DBC_PROGRAM_ID =
  "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";
