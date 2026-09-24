import { AnchorProvider, Program } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import idl from "@/idl/stockforge.json";
import { PROGRAM_ID } from "./constants";

export interface WalletLike {
  publicKey: PublicKey | null;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  signAllTransactions?: (txs: unknown[]) => Promise<unknown[]>;
  signMessage?: (msg: Uint8Array) => Promise<Uint8Array>;
}

function readonlyWallet() {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: async (tx: unknown) => tx,
    signAllTransactions: async (txs: unknown[]) => txs,
  };
}

/** Build an Anchor program bound to a connection and (optionally) a wallet. */
export function makeProgram(connection: Connection, wallet?: WalletLike | null) {
  const w = wallet && wallet.publicKey ? wallet : readonlyWallet();
  const provider = new AnchorProvider(connection, w as never, {
    commitment: "confirmed",
  });
  return new Program(idl as never, provider) as Program<any>;
}

export { PROGRAM_ID };
