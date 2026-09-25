import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, SEED } from "./constants";

const enc = new TextEncoder();

function u64le(n: number | bigint): Uint8Array {
  const buf = new Uint8Array(8);
  let v = BigInt(n);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

export function configPda(): PublicKey {
  return PublicKey.findProgramAddressSync([enc.encode(SEED.config)], PROGRAM_ID)[0];
}

export function optionPda(writer: PublicKey, id: number | bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode(SEED.option), writer.toBuffer(), u64le(id)],
    PROGRAM_ID
  )[0];
}

export function basketPda(creator: PublicKey, nonce: number | bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode(SEED.basket), creator.toBuffer(), u64le(nonce)],
    PROGRAM_ID
  )[0];
}

export function basketMintPda(basket: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [enc.encode(SEED.basketMint), basket.toBuffer()],
    PROGRAM_ID
  )[0];
}
