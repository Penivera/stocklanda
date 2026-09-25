import fs from "fs";
import os from "os";
import path from "path";
import { AnchorProvider, Program } from "@anchor-lang/core";
import { Connection, Keypair } from "@solana/web3.js";
import idl from "@/idl/stockforge.json";
import { RPC_URL } from "./constants";

/**
 * Deployer/admin keypair used by the server-side API routes. Portable by
 * default (`~/.config/solana/id.json`); override with `KEYPAIR_PATH`.
 */
const KEYPAIR_PATH =
  process.env.KEYPAIR_PATH ??
  path.join(os.homedir(), ".config", "solana", "id.json");

export function getServer() {
  const connection = new Connection(RPC_URL, "confirmed");
  const raw = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(raw));
  const wallet = {
    publicKey: payer.publicKey,
    payer,
    signTransaction: async (tx: { partialSign: (k: Keypair) => void }) => {
      tx.partialSign(payer);
      return tx;
    },
    signAllTransactions: async (
      txs: { partialSign: (k: Keypair) => void }[]
    ) => {
      txs.forEach((tx) => tx.partialSign(payer));
      return txs;
    },
  };
  const provider = new AnchorProvider(connection, wallet as never, {
    commitment: "confirmed",
  });
  const program = new Program(idl as never, provider) as unknown as any;
  return { connection, payer, program };
}

export interface Registry {
  config: string;
  quoteMint: string;
  treasury: string;
  admin: string;
  symbolByMint: Record<string, string>;
  mints: { symbol: string; address: string; decimals: number }[];
}

export function readRegistry(): Registry | null {
  try {
    const p = path.join(process.cwd(), "public", "registry.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export interface FlagshipRegistry {
  network: string;
  name: string;
  symbol: string;
  config: string;
  baseMint: string;
  pool: string;
  quoteMint: string;
  quoteSymbol: string;
  decimals: number;
  totalSupply: string;
  createdAt: string;
  txs: Record<string, string>;
}

export function readFlagship(): FlagshipRegistry | null {
  try {
    const p = path.join(process.cwd(), "public", "flagship.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
