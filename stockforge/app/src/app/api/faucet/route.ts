import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { getServer, readRegistry } from "@/lib/server";

export const runtime = "nodejs";

/**
 * Demo faucet: mints the registry's demo assets to a connected wallet so the
 * user can immediately list, buy and mint baskets on a local validator.
 */
export async function POST(req: Request) {
  try {
    const { wallet } = await req.json();
    if (!wallet) {
      return NextResponse.json({ error: "wallet required" }, { status: 400 });
    }
    const registry = readRegistry();
    if (!registry) {
      return NextResponse.json({ error: "registry not seeded" }, { status: 400 });
    }

    const owner = new PublicKey(wallet);
    const { connection, payer } = getServer();
    const signatures: string[] = [];

    for (const m of registry.mints) {
      const mint = new PublicKey(m.address);
      const amount = m.symbol === "USDC" ? 25_000n : 500n;
      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        owner
      );
      const sig = await mintTo(
        connection,
        payer,
        mint,
        ata.address,
        payer,
        amount * 1_000_000n
      );
      signatures.push(sig);
    }

    return NextResponse.json({ signature: signatures[0], count: signatures.length });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "faucet failed" }, { status: 500 });
  }
}
