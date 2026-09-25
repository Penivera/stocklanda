/**
 * Meteora Dynamic Bonding Curve flagship launch.
 *
 * Server/Node-only: this module pulls in the Meteora DBC SDK and must never be
 * imported from a client component. Client code talks to it through
 * `/api/flagship`.
 */
import BN from "bn.js";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DammV2BaseFeeMode,
  DammV2DynamicFeeMode,
  DynamicBondingCurveClient,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurve,
  deriveDbcPoolAddress,
  getPriceFromSqrtPrice,
  type ConfigParameters,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { SOL_MINT } from "./constants";

export const SOL_MINT_PK = new PublicKey(SOL_MINT);

/**
 * Flagship "StockForge Governance" ($FORGE) token. It is intentionally
 * decoupled from the asset-backed ETF vaults (see review.md §3): the DBC pool
 * is a separate launch with equity-like curve mechanics.
 */
export const FLAGSHIP = {
  name: "StockForge Governance",
  symbol: "FORGE",
  uri: "https://stockforge.xyz/flagship.json",
  totalSupply: 1_000_000_000,
  decimals: TokenDecimal.SIX,
  /** Share of supply that is migrated into the graduated DAMM v2 pool. */
  percentageSupplyOnMigration: 25,
  /** Quote (SOL) raised before the pool graduates. */
  migrationQuoteThresholdSol: 5,
} as const;

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

/**
 * Build the flagship curve: a linear fee scheduler that decays from 3% to
 * 0.5%, dynamic fees capped at ~20% of the minimum base fee, and a custom
 * graduated-pool fee tier (1%) enforced through DAMM v2.
 */
export function buildFlagshipCurve(): ConfigParameters {
  return buildCurve({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: 9,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: FLAGSHIP.totalSupply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: 300,
          endingFeeBps: 50,
          numberOfPeriod: 12,
          totalDuration: 86_400,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 20,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.Customizable,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
      migratedPoolFee: {
        collectFeeMode: MigratedCollectFeeMode.QuoteToken,
        dynamicFee: DammV2DynamicFeeMode.Enabled,
        poolFeeBps: 100,
        baseFeeMode: DammV2BaseFeeMode.FeeTimeSchedulerLinear,
      },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: 0,
      partnerPermanentLockedLiquidityPercentage: 100,
      creatorLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    percentageSupplyOnMigration: FLAGSHIP.percentageSupplyOnMigration,
    migrationQuoteThreshold: FLAGSHIP.migrationQuoteThresholdSol,
  });
}

export function dbcClient(connection: Connection): DynamicBondingCurveClient {
  return new DynamicBondingCurveClient(connection, "confirmed");
}

/** Deterministic DBC pool address for the flagship base mint + config. */
export function deriveFlagshipPool(
  config: string | PublicKey,
  baseMint: string | PublicKey
): PublicKey {
  return deriveDbcPoolAddress(SOL_MINT_PK, new PublicKey(baseMint), new PublicKey(config));
}

/** Pool spot price expressed in quote tokens (SOL) per base token (FORGE). */
export function priceInSol(
  sqrtPrice: BN | string | bigint,
  baseDecimals = FLAGSHIP.decimals
): number {
  const sp = BN.isBN(sqrtPrice) ? sqrtPrice : new BN(sqrtPrice.toString());
  return getPriceFromSqrtPrice(
    sp,
    baseDecimals as TokenDecimal,
    9
  ).toNumber();
}
