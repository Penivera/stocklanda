import { NextResponse } from "next/server";
import BN from "bn.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { getCurrentPoint, SwapMode } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { RPC_URL } from "@/lib/constants";
import { dbcClient, priceInSol } from "@/lib/flagship";
import { readFlagship } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/flagship — live state of the Meteora DBC flagship pool.
 * Returns `{ launched: false }` until `npm run launch:flagship` has written
 * `public/flagship.json`.
 */
export async function GET() {
  const reg = readFlagship();
  if (!reg) return NextResponse.json({ launched: false });

  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const client = dbcClient(connection);
    const pool = await client.state.getPool(reg.pool);
    if (!pool) {
      return NextResponse.json({ launched: true, onChain: false, ...reg });
    }

    let price = 0;
    try {
      price = priceInSol(pool.poolState.sqrtPrice, reg.decimals);
    } catch {
      price = 0;
    }

    let progress = Number(pool.poolState.migrationProgress) / 100;
    try {
      progress = await client.state.getPoolQuoteTokenCurveProgress(reg.pool);
    } catch {
      /* keep account progress */
    }

    const quoteReserve = Number(pool.poolState.quoteReserve.toString()) / 1e9;
    const baseReserve =
      Number(pool.poolState.baseReserve.toString()) / 10 ** reg.decimals;

    return NextResponse.json({
      launched: true,
      onChain: true,
      ...reg,
      price,
      progress,
      migrated: Number(pool.poolState.isMigrated) > 0,
      quoteReserve,
      baseReserve,
      marketCapSol: price * Number(reg.totalSupply),
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { launched: true, onChain: false, error: e?.message ?? "read failed", ...reg },
      { status: 200 }
    );
  }
}

/**
 * POST /api/flagship — build an unsigned buy/sell transaction on the DBC pool.
 * Body: { action: "buy" | "sell", wallet, amount, slippageBps? }
 * The connected wallet signs and submits the returned base64 transaction.
 */
export async function POST(req: Request) {
  try {
    const { action, wallet, amount, slippageBps } = await req.json();
    const reg = readFlagship();
    if (!reg) {
      return NextResponse.json({ error: "flagship not launched" }, { status: 400 });
    }
    if (!wallet || !action || !amount) {
      return NextResponse.json(
        { error: "wallet, action and amount are required" },
        { status: 400 }
      );
    }
    const sell = action === "sell";
    const owner = new PublicKey(wallet);
    const connection = new Connection(RPC_URL, "confirmed");
    const client = dbcClient(connection);

    const poolAddress = new PublicKey(reg.pool);
    const virtualPool = await client.state.getPool(poolAddress);
    if (!virtualPool) {
      return NextResponse.json({ error: "pool not found" }, { status: 404 });
    }
    const config = await client.state.getPoolConfig(virtualPool.poolState.config);
    if (!config) {
      return NextResponse.json({ error: "pool config not found" }, { status: 404 });
    }

    const decimals = sell ? reg.decimals : 9;
    const amountIn = new BN(Math.max(0, Math.round(Number(amount) * 10 ** decimals)));
    if (amountIn.isZero()) {
      return NextResponse.json({ error: "amount too small" }, { status: 400 });
    }

    const currentPoint = await getCurrentPoint(connection, config.activationType);
    const bps = Math.min(Math.max(Number(slippageBps ?? 100), 1), 5000);

    // Best-effort exact quote for slippage protection; fall back to amount-only.
    let minimumAmountOut = new BN(0);
    try {
      const quote = client.pool.swapQuote2({
        virtualPool,
        config,
        swapBaseForQuote: sell,
        amountIn,
        slippageBps: bps,
        hasReferral: false,
        eligibleForFirstSwapWithMinFee: false,
        currentPoint,
        swapMode: SwapMode.PartialFill,
      });
      if (quote.minimumAmountOut) minimumAmountOut = quote.minimumAmountOut;
    } catch {
      /* ignore — submit with zero slippage floor */
    }

    const tx = await client.pool.swap2({
      owner,
      pool: poolAddress,
      swapBaseForQuote: sell,
      amountIn,
      minimumAmountOut,
      swapMode: SwapMode.PartialFill,
      referralTokenAccount: null,
      payer: owner,
    });

    const { blockhash } = await connection.getLatestBlockhash();
    tx.feePayer = owner;
    tx.recentBlockhash = blockhash;

    const transaction = tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64");

    return NextResponse.json({
      transaction,
      blockhash,
      side: sell ? "sell" : "buy",
      amountIn: amountIn.toString(),
      minimumAmountOut: minimumAmountOut.toString(),
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "swap build failed" },
      { status: 500 }
    );
  }
}
