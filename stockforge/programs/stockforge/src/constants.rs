use anchor_lang::prelude::*;

/// Seed for the global config account.
#[constant]
pub const CONFIG_SEED: &[u8] = b"config";

/// Seed prefix for option contract PDAs.
#[constant]
pub const OPTION_SEED: &[u8] = b"option";

/// Seed prefix for basket PDAs.
#[constant]
pub const BASKET_SEED: &[u8] = b"basket";

/// Seed prefix for basket share mint PDAs.
#[constant]
pub const BASKET_MINT_SEED: &[u8] = b"basket_mint";

/// Seed prefix for per-component basket vaults.
#[constant]
pub const BASKET_VAULT_SEED: &[u8] = b"basket_vault";

/// All prices, strikes and USDC amounts are stored with 6 decimals.
/// `PRICE_DECIMALS` is the scaling factor (1 whole unit).
#[constant]
pub const PRICE_DECIMALS: u64 = 1_000_000;

/// One "basket unit" equals this many base units of the share mint.
#[constant]
pub const BASKET_UNIT: u64 = 1_000_000;

/// Maximum length of a basket name.
pub const MAX_NAME_LEN: usize = 32;

/// Maximum number of underlying components in a basket.
pub const MAX_COMPONENTS: usize = 8;

/// An admin-supplied settlement price is valid for this many seconds.
#[constant]
pub const MAX_ADMIN_PRICE_AGE: i64 = 3_600;

/// A Pyth price is considered fresh within this many seconds.
#[constant]
pub const MAX_PYTH_PRICE_AGE: i64 = 300;

/// Basis-point denominator.
#[constant]
pub const BPS_DENOMINATOR: u64 = 10_000;
