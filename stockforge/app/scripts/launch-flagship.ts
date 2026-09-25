/**
 * Launch the flagship StockForge Governance ($FORGE) token on Meteora's
 * Dynamic Bonding Curve, with a linear fee-scheduler curve and a custom
 * graduated (DAMM v2) fee tier.
 *
 * The DBC program lives on devnet/mainnet only, so this targets devnet by
 * default. Run:
 *
 *   RPC_URL=https://api.devnet.solana.com npm run launch:flagship
 *
 * Optional:
 *   FIRST_BUY_SOL=1   buy 1 SOL of $FORGE right after the pool is live.
 */
import * as fs from "fs";
import * as path from "path";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  Transaction,
  type ConfirmOptions,
} from "@solana/web3.js";
import {
  DynamicBondingCurveClient,
  SwapMode,
  deriveDbcPoolAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { buildFlagshipCurve, FLAGSHIP, SOL_MINT_PK } from "../src/lib/flagship";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const KEYPAIR_PATH =
  process.env.KEYPAIR ??
  "\\\\wsl.localhost\\Ubuntu\\home\\edmund\\.config\\solana\\id.json";

function log(msg: string) {
  console.log(`\n=== ${msg} ===`);
}

async function sendTx(
  connection: Connection,
  tx: Transaction,
  payer: Keypair,
  signers: Keypair[],
  opts: ConfirmOptions = { commitment: "confirmed" }
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(payer, ...signers);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    opts.commitment
  );
  return sig;
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const raw = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(raw));
  const client = new DynamicBondingCurveClient(connection, "confirmed");

  console.log("RPC:", RPC);
  console.log("Payer:", payer.publicKey.toBase58());
  const balance = await connection.getBalance(payer.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");
  if (balance < 0.1 * 1e9) {
    throw new Error("payer needs SOL — fund the wallet on the target cluster first");
  }

  const network = RPC.includes("devnet")
    ? "devnet"
    : RPC.includes("mainnet")
      ? "mainnet-beta"
      : "localnet";

  log("buildCurve — linear base fee + custom DAMM v2 graduated fee");
  const curve = buildFlagshipCurve();

  const configKeypair = Keypair.generate();
  const baseMintKeypair = Keypair.generate();
  console.log("config:", configKeypair.publicKey.toBase58());
  console.log("baseMint:", baseMintKeypair.publicKey.toBase58());

  log("createConfig");
  const configTx = await client.partner.createConfig({
    payer: payer.publicKey,
    config: configKeypair.publicKey,
    feeClaimer: payer.publicKey,
    leftoverReceiver: payer.publicKey,
    quoteMint: SOL_MINT_PK,
    ...curve,
  });
  const configSig = await sendTx(connection, configTx, payer, [configKeypair]);
  console.log("config sig:", configSig);

  log("createPool");
  const poolTx = await client.creator.createPool({
    baseMint: baseMintKeypair.publicKey,
    config: configKeypair.publicKey,
    name: FLAGSHIP.name,
    symbol: FLAGSHIP.symbol,
    uri: FLAGSHIP.uri,
    payer: payer.publicKey,
    poolCreator: payer.publicKey,
  });
  const poolSig = await sendTx(connection, poolTx, payer, [baseMintKeypair]);
  console.log("pool sig:", poolSig);

  const pool = deriveDbcPoolAddress(
    SOL_MINT_PK,
    baseMintKeypair.publicKey,
    configKeypair.publicKey
  );
  console.log("pool:", pool.toBase58());

  const txs: Record<string, string> = { config: configSig, pool: poolSig };

  const firstBuySol = Number(process.env.FIRST_BUY_SOL ?? 0);
  if (firstBuySol > 0) {
    log(`first buy (${firstBuySol} SOL)`);
    const swapTx = await client.pool.swap2({
      owner: payer.publicKey,
      pool,
      swapBaseForQuote: false,
      amountIn: new BN(Math.round(firstBuySol * 1e9)),
      minimumAmountOut: new BN(0),
      swapMode: SwapMode.PartialFill,
      referralTokenAccount: null,
      payer: payer.publicKey,
    });
    txs.firstBuy = await sendTx(connection, swapTx, payer, []);
    console.log("first buy sig:", txs.firstBuy);
  }

  const registry = {
    network,
    name: FLAGSHIP.name,
    symbol: FLAGSHIP.symbol,
    config: configKeypair.publicKey.toBase58(),
    baseMint: baseMintKeypair.publicKey.toBase58(),
    pool: pool.toBase58(),
    quoteMint: SOL_MINT_PK.toBase58(),
    quoteSymbol: "SOL",
    decimals: FLAGSHIP.decimals,
    totalSupply: String(FLAGSHIP.totalSupply),
    createdAt: new Date().toISOString(),
    txs,
  };

  const publicDir = path.resolve(__dirname, "../public");
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(
    path.join(publicDir, "flagship.json"),
    JSON.stringify(registry, null, 2)
  );
  console.log("\nflagship written to public/flagship.json");
  console.log(JSON.stringify(registry, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
