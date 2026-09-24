import { NextResponse } from "next/server";
import { BN } from "@anchor-lang/core";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getServer, readRegistry } from "@/lib/server";
import { configPda } from "@/lib/pda";
import { resolvePrice } from "@/lib/prices";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Permissionless settlement crank. Any caller can settle an expired option.
 * Here the server plays both the admin (attesting the off-chain PreStocks/Pyth
 * price) and the crank caller, which earns half of the protocol fee.
 */
export async function POST(req: Request) {
  try {
    const { option } = await req.json();
    if (!option) {
      return NextResponse.json({ error: "option required" }, { status: 400 });
    }
    const registry = readRegistry();
    const { connection, payer, program } = getServer();
    const optionPk = new PublicKey(option);
    const acc = await (program.account as any).optionContract.fetch(optionPk);
    const config = configPda();
    const cfg = await (program.account as any).config.fetch(config);

    const symbol = registry?.symbolByMint?.[acc.underlyingMint.toBase58()] ?? "UNKNOWN";
    const price = await resolvePrice(symbol);
    const priceUsd = Math.round(price.usd * 1e6);

    const collateralMint: PublicKey = acc.collateralMint;
    const vault = getAssociatedTokenAddressSync(collateralMint, optionPk, true);

    // Ensure every destination token account exists.
    const writerDest = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      collateralMint,
      acc.writer
    );
    const buyerDest = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      collateralMint,
      acc.buyer
    );
    const treasuryDest = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      collateralMint,
      cfg.treasury
    );

    const keeper = Keypair.generate();
    const sig = await connection.requestAirdrop(keeper.publicKey, 1_000_000_000);
    await connection.confirmTransaction(sig, "confirmed");
    const callerDest = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      collateralMint,
      keeper.publicKey
    );

    const now = Math.floor(Date.now() / 1000);
    const tx = await program.methods
      .settleOption(new BN(priceUsd), new BN(now))
      .accounts({
        caller: keeper.publicKey,
        admin: payer.publicKey,
        config,
        option: optionPk,
        vault,
        writerDest: writerDest.address,
        buyerDest: buyerDest.address,
        treasury: treasuryDest.address,
        callerDest: callerDest.address,
        collateralMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([keeper])
      .rpc();

    return NextResponse.json({
      signature: tx,
      price: price.usd,
      source: price.source,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "settle failed" },
      { status: 500 }
    );
  }
}
