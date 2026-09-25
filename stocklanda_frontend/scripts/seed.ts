import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  AnchorProvider,
  BN,
  Program,
  Wallet,
  web3,
} from "@anchor-lang/core";
import {
  createMint,
  getOrCreateAssociatedTokenAccount as _getOrCreateAta,
  getAssociatedTokenAddressSync,
  mintTo as _mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const { Connection, Keypair, PublicKey, SystemProgram, Transaction } = web3;

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const KEYPAIR_PATH =
  process.env.KEYPAIR ??
  path.join(os.homedir(), ".config", "solana", "id.json");
const IDL_PATH = path.resolve(__dirname, "../src/idl/stockforge.json");
const PROGRAM_ID = new PublicKey(
  "5qNeAcUKD45g3T5osCLVk13Q8CZLtT7BWhivG5og9CMf"
);

const SEED = {
  config: Buffer.from("config"),
  option: Buffer.from("option"),
  basket: Buffer.from("basket"),
  basketMint: Buffer.from("basket_mint"),
};

function log(msg: string) {
  console.log(`\n=== ${msg} ===`);
}

/**
 * Fund a wallet with `lamports`. Tries an airdrop first (localnet), then falls
 * back to a transfer from the payer — devnet airdrops are rate-limited.
 */
async function fundWallet(
  connection: web3.Connection,
  payer: Keypair,
  to: PublicKey,
  lamports: number
) {
  if (RPC.includes("127.0.0.1") || RPC.includes("localhost")) {
    try {
      const sig = await connection.requestAirdrop(to, lamports);
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      console.log(`airdropped ${lamports / 1e9} SOL -> ${to.toBase58()}`);
      return;
    } catch {
      console.log("airdrop failed; falling back to a payer transfer");
    }
  } else {
    console.log(`transferring ${lamports / 1e9} SOL from payer -> ${to.toBase58()}`);
  }
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: to, lamports })
  );
  const bh = await connection.getLatestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = bh.blockhash;
  tx.sign(payer);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry a flaky devnet RPC call (transient 429s / not-yet-visible accounts). */
async function retry<T>(label: string, fn: () => Promise<T>, tries = 8): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      console.log(`retry ${i + 1}/${tries} (${label}): ${(e as Error).message}`);
      await sleep(1000 * (i + 1));
    }
  }
  throw last;
}

// Wrap the ATA + mint helpers so transient devnet races self-heal.
const getOrCreateAssociatedTokenAccount = ((...args: unknown[]) =>
  retry("getOrCreateATA", () => (_getOrCreateAta as any)(...args))) as unknown as typeof _getOrCreateAta;

const mintTo = ((...args: unknown[]) =>
  retry("mintTo", () => (_mintTo as any)(...args))) as unknown as typeof _mintTo;

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const raw = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(raw));
  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new Program(idl as any, provider);

  console.log("RPC:", RPC);
  console.log("Wallet:", payer.publicKey.toBase58());

  const [config] = PublicKey.findProgramAddressSync([SEED.config], PROGRAM_ID);

  // The config PDA is global, so a re-run must reuse its quote mint instead of
  // creating a new one (list_option checks the collateral against config.quote_mint).
  const existingConfig = await connection.getAccountInfo(config);
  log("Creating mints");
  let usdc: PublicKey;
  if (existingConfig) {
    const cfg: any = await program.account.config.fetch(config);
    usdc = cfg.quoteMint as PublicKey;
    console.log("reusing existing config quoteMint:", usdc.toBase58());
  } else {
    usdc = await createMint(connection, payer, payer.publicKey, null, 6);
  }
  const nvda = await createMint(connection, payer, payer.publicKey, null, 6);
  const msft = await createMint(connection, payer, payer.publicKey, null, 6);
  const aapl = await createMint(connection, payer, payer.publicKey, null, 6);
  console.log({ usdc: usdc.toBase58(), nvda: nvda.toBase58(), msft: msft.toBase58(), aapl: aapl.toBase58() });

  const payerUsdc = await getOrCreateAssociatedTokenAccount(connection, payer, usdc, payer.publicKey);
  const payerNvda = await getOrCreateAssociatedTokenAccount(connection, payer, nvda, payer.publicKey);
  const payerMsft = await getOrCreateAssociatedTokenAccount(connection, payer, msft, payer.publicKey);
  const payerAapl = await getOrCreateAssociatedTokenAccount(connection, payer, aapl, payer.publicKey);

  log("Minting seed balances");
  await mintTo(connection, payer, usdc, payerUsdc.address, payer, 5_000_000n * 1_000_000n);
  await mintTo(connection, payer, nvda, payerNvda.address, payer, 10_000n * 1_000_000n);
  await mintTo(connection, payer, msft, payerMsft.address, payer, 10_000n * 1_000_000n);
  await mintTo(connection, payer, aapl, payerAapl.address, payer, 10_000n * 1_000_000n);

  log("Creating treasury + keeper wallets");
  const treasuryWallet = Keypair.generate();
  const keeper = Keypair.generate();
  for (const kp of [treasuryWallet, keeper]) {
    await fundWallet(connection, payer, kp.publicKey, 10_000_000);
  }
  const treasuryUsdc = await getOrCreateAssociatedTokenAccount(connection, payer, usdc, treasuryWallet.publicKey);
  const keeperUsdc = await getOrCreateAssociatedTokenAccount(connection, payer, usdc, keeper.publicKey);
  const keeperNvda = await getOrCreateAssociatedTokenAccount(connection, payer, nvda, keeper.publicKey);

  log("initialize_config");
  if (!existingConfig) {
    await program.methods
      .initializeConfig(25, payer.publicKey)
      .accounts({
        admin: payer.publicKey,
        config,
        treasury: treasuryWallet.publicKey,
        quoteMint: usdc,
        pythProgram: PublicKey.default,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  const admin = payer;

  // ------------------------------------------------------------------
  log("Option 1: cash-secured PUT on NVDA (will be settled ITM)");
  const idBase = Date.now() % 1_000_000_000;
  const opt1Id = new BN(idBase);
  const [option1] = PublicKey.findProgramAddressSync(
    [SEED.option, payer.publicKey.toBuffer(), opt1Id.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  const vault1 = getAssociatedTokenAddressSync(usdc, option1, true);
  await program.methods
    .listOption(opt1Id, { put: {} }, new BN(120_000_000), new BN(1_000_000), new BN(5_000_000), new BN(120_000_000), new BN(Math.floor(Date.now() / 1000) + 40))
    .accounts({
      writer: payer.publicKey,
      config,
      option: option1,
      underlyingMint: nvda,
      collateralMint: usdc,
      premiumMint: usdc,
      writerCollateral: payerUsdc.address,
      vault: vault1,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("listed put", option1.toBase58());

  // ------------------------------------------------------------------
  log("Creating buyer wallet");
  const buyer = Keypair.generate();
  await fundWallet(connection, payer, buyer.publicKey, 10_000_000);
  const buyerUsdc = await getOrCreateAssociatedTokenAccount(connection, payer, usdc, buyer.publicKey);
  await mintTo(connection, payer, usdc, buyerUsdc.address, payer, 1_000n * 1_000_000n);
  const buyerNvda = await getOrCreateAssociatedTokenAccount(connection, payer, nvda, buyer.publicKey);
  const buyerMsft = await getOrCreateAssociatedTokenAccount(connection, payer, msft, buyer.publicKey);
  const buyerAapl = await getOrCreateAssociatedTokenAccount(connection, payer, aapl, buyer.publicKey);

  log("buy_option (put)");
  await program.methods
    .buyOption()
    .accounts({
      buyer: buyer.publicKey,
      config,
      option: option1,
      premiumMint: usdc,
      buyerPremium: buyerUsdc.address,
      writerPremium: payerUsdc.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([buyer])
    .rpc();

  log("Option 2: covered CALL on MSFT (leave Open)");
  const opt2Id = new BN(idBase + 1);
  const [option2] = PublicKey.findProgramAddressSync(
    [SEED.option, payer.publicKey.toBuffer(), opt2Id.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  const vault2 = getAssociatedTokenAddressSync(msft, option2, true);
  await program.methods
    .listOption(opt2Id, { call: {} }, new BN(400_000_000), new BN(1_000_000), new BN(10_000_000), new BN(1_000_000), new BN(Math.floor(Date.now() / 1000) + 30 * 86400))
    .accounts({
      writer: payer.publicKey,
      config,
      option: option2,
      underlyingMint: msft,
      collateralMint: msft,
      premiumMint: usdc,
      writerCollateral: payerMsft.address,
      vault: vault2,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("listed call", option2.toBase58());

  log("Option 3: PUT on AAPL (buy, leave Active)");
  const opt3Id = new BN(idBase + 2);
  const [option3] = PublicKey.findProgramAddressSync(
    [SEED.option, payer.publicKey.toBuffer(), opt3Id.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  const vault3 = getAssociatedTokenAddressSync(usdc, option3, true);
  await program.methods
    .listOption(opt3Id, { put: {} }, new BN(220_000_000), new BN(2_000_000), new BN(8_000_000), new BN(440_000_000), new BN(Math.floor(Date.now() / 1000) + 30 * 86400))
    .accounts({
      writer: payer.publicKey,
      config,
      option: option3,
      underlyingMint: aapl,
      collateralMint: usdc,
      premiumMint: usdc,
      writerCollateral: payerUsdc.address,
      vault: vault3,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  await program.methods
    .buyOption()
    .accounts({
      buyer: buyer.publicKey,
      config,
      option: option3,
      premiumMint: usdc,
      buyerPremium: buyerUsdc.address,
      writerPremium: payerUsdc.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([buyer])
    .rpc();
  console.log("active put", option3.toBase58());

  log("Waiting for option 1 expiry");
  await new Promise((r) => setTimeout(r, 42_000));

  if (!process.env.SKIP_SETTLE) {
    log("settle_option (admin price, NVDA = $100 -> ITM)");
    await program.methods
      .settleOption(new BN(100_000_000), new BN(Math.floor(Date.now() / 1000)))
      .accounts({
        caller: keeper.publicKey,
        admin: admin.publicKey,
        config,
        option: option1,
        vault: vault1,
        writerDest: payerUsdc.address,
        buyerDest: buyerUsdc.address,
        treasury: treasuryUsdc.address,
        callerDest: keeperUsdc.address,
        collateralMint: usdc,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([admin, keeper])
      .rpc();

    const buyerBal = (await connection.getTokenAccountBalance(buyerUsdc.address)).value.uiAmount;
    console.log("buyer USDC after settle:", buyerBal);
  } else {
    console.log("SKIP_SETTLE set — leaving option 1 active & expired for the API crank");
  }

  // ------------------------------------------------------------------
  log("create_basket: AI Titans");
  const nonce = new BN(idBase + 10);
  const [basket] = PublicKey.findProgramAddressSync(
    [SEED.basket, payer.publicKey.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  const [shareMint] = PublicKey.findProgramAddressSync(
    [SEED.basketMint, basket.toBuffer()],
    PROGRAM_ID
  );
  const components = [
    { mint: nvda, amountPerUnit: new BN(2_000_000), weightBps: 4000 },
    { mint: msft, amountPerUnit: new BN(1_000_000), weightBps: 3500 },
    { mint: aapl, amountPerUnit: new BN(3_000_000), weightBps: 2500 },
  ];
  await program.methods
    .createBasket(nonce, "AI Titans", components)
    .accounts({
      creator: payer.publicKey,
      config,
      basket,
      shareMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("basket", basket.toBase58(), "shares", shareMint.toBase58());

  log("mint_basket (1 unit = 2 NVDA + 1 MSFT + 3 AAPL)");
  const userShare = await getOrCreateAssociatedTokenAccount(connection, payer, shareMint, payer.publicKey);
  const rem = [];
  for (const [mint, src] of [
    [nvda, payerNvda.address],
    [msft, payerMsft.address],
    [aapl, payerAapl.address],
  ] as [web3.PublicKey, web3.PublicKey][]) {
    const vault = getAssociatedTokenAddressSync(mint, basket, true);
    rem.push({ pubkey: mint, isWritable: true, isSigner: false });
    rem.push({ pubkey: vault, isWritable: true, isSigner: false });
    rem.push({ pubkey: src, isWritable: true, isSigner: false });
  }
  await program.methods
    .mintBasket(new BN(1_000_000))
    .accounts({
      user: payer.publicKey,
      basket,
      shareMint,
      userShare: userShare.address,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(rem)
    .rpc();
  const shareBal = (await connection.getTokenAccountBalance(userShare.address)).value.uiAmount;
  console.log("basket shares:", shareBal);

  log("redeem_basket (0.25 units)");
  const redeemRem = [];
  for (const [mint, dest] of [
    [nvda, payerNvda.address],
    [msft, payerMsft.address],
    [aapl, payerAapl.address],
  ] as [web3.PublicKey, web3.PublicKey][]) {
    const vault = getAssociatedTokenAddressSync(mint, basket, true);
    redeemRem.push({ pubkey: mint, isWritable: true, isSigner: false });
    redeemRem.push({ pubkey: vault, isWritable: true, isSigner: false });
    redeemRem.push({ pubkey: dest, isWritable: true, isSigner: false });
  }
  await program.methods
    .redeemBasket(new BN(250_000))
    .accounts({
      user: payer.publicKey,
      basket,
      shareMint,
      userShare: userShare.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts(redeemRem)
    .rpc();
  const shareBal2 = (await connection.getTokenAccountBalance(userShare.address)).value.uiAmount;
  console.log("basket shares after redeem:", shareBal2);

  log("DONE");
  const registry = {
    programId: PROGRAM_ID.toBase58(),
    config: config.toBase58(),
    quoteMint: usdc.toBase58(),
    treasury: treasuryWallet.publicKey.toBase58(),
    admin: payer.publicKey.toBase58(),
    symbolByMint: {
      [usdc.toBase58()]: "USDC",
      [nvda.toBase58()]: "NVDA",
      [msft.toBase58()]: "MSFT",
      [aapl.toBase58()]: "AAPL",
      [shareMint.toBase58()]: "AITITANS",
    },
    mints: [
      { symbol: "USDC", address: usdc.toBase58(), decimals: 6 },
      { symbol: "NVDA", address: nvda.toBase58(), decimals: 6 },
      { symbol: "MSFT", address: msft.toBase58(), decimals: 6 },
      { symbol: "AAPL", address: aapl.toBase58(), decimals: 6 },
    ],
    baskets: [
      {
        name: "AI Titans",
        basket: basket.toBase58(),
        shareMint: shareMint.toBase58(),
      },
    ],
  };
  const registryOut =
    process.env.REGISTRY_PATH ?? path.resolve(__dirname, "../public/registry.json");
  fs.mkdirSync(path.dirname(registryOut), { recursive: true });
  fs.writeFileSync(registryOut, JSON.stringify(registry, null, 2));
  console.log("registry written to", registryOut);
  console.log(
    JSON.stringify(
      {
        programId: PROGRAM_ID.toBase58(),
        config: config.toBase58(),
        mints: { usdc, nvda, msft, aapl },
        options: { put: option1, call: option2, aaplPut: option3 },
        basket: { basket, shareMint },
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
