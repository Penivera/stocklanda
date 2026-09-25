"use client";

import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

export interface AtaResult {
  address: PublicKey;
  ix?: TransactionInstruction;
}

/** Return the ATA for (owner, mint), plus a create instruction if missing. */
export async function ensureAta(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  allowOwnerOffCurve = true
): Promise<AtaResult> {
  const address = getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const info = await connection.getAccountInfo(address);
  if (info) return { address };
  return {
    address,
    ix: createAssociatedTokenAccountInstruction(
      payer,
      address,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
  };
}

export function compactIxs(
  results: AtaResult[]
): { addresses: PublicKey[]; ix: TransactionInstruction[] } {
  return {
    addresses: results.map((r) => r.address),
    ix: results.filter((r) => r.ix).map((r) => r.ix as TransactionInstruction),
  };
}
