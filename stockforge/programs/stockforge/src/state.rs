use anchor_lang::prelude::*;

use crate::constants::{MAX_COMPONENTS, MAX_NAME_LEN};

/// Global protocol configuration.
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Protocol admin, allowed to sign off-chain settlement prices.
    pub admin: Pubkey,
    /// Treasury that collects protocol fees and the settlement crank tip.
    pub treasury: Pubkey,
    /// Mint used to pay option premiums (e.g. USDC). 6 decimals assumed.
    pub quote_mint: Pubkey,
    /// Pyth receiver program that owns price accounts.
    pub pyth_program: Pubkey,
    /// Protocol fee in basis points, taken from settled collateral.
    pub fee_bps: u16,
    /// Bump for the config PDA.
    pub bump: u8,
}

/// Whether a contract pays out on the downside (put) or upside (call).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum OptionType {
    Put,
    Call,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum OptionStatus {
    /// Listed by the writer, waiting for a buyer.
    Open,
    /// Funded by a buyer, awaiting expiry.
    Active,
    /// Settled, collateral distributed.
    Settled,
    /// Unsold listing cancelled by the writer, collateral refunded.
    Cancelled,
}

/// Where a settlement price came from.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum PriceSource {
    /// On-chain Pyth price account (public equities).
    Pyth,
    /// Admin-signed off-chain price (pre-IPO assets via PreStocks API).
    Admin,
}

/// A fully-collateralised, single-leg option listed by a writer.
#[account]
#[derive(InitSpace)]
pub struct OptionContract {
    pub id: u64,
    pub writer: Pubkey,
    /// Set to the buyer's key once purchased; `Pubkey::default()` while open.
    pub buyer: Pubkey,
    /// Tokenised stock (or basket share mint) the option is written on.
    pub underlying_mint: Pubkey,
    /// Asset locked as collateral (quote mint for puts, underlying for calls).
    pub collateral_mint: Pubkey,
    /// Mint used to pay the premium (the protocol quote mint).
    pub premium_mint: Pubkey,
    pub option_type: OptionType,
    pub status: OptionStatus,
    /// Strike price in USD per whole underlying, 6 decimals.
    pub strike: u64,
    /// Contract size in underlying base units (6 decimals).
    pub size: u64,
    /// Premium paid by the buyer, in `premium_mint` base units.
    pub premium: u64,
    /// Collateral locked in the vault, in `collateral_mint` base units.
    pub collateral_amount: u64,
    /// UNIX timestamp at which the option can be settled.
    pub expiry: i64,
    /// Price used at settlement, 6 decimals.
    pub settled_price: u64,
    /// Vault holding the collateral.
    pub vault: Pubkey,
    pub bump: u8,
}

/// One holding in a custom basket.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub struct BasketComponent {
    /// Mint of the underlying tokenised stock.
    pub mint: Pubkey,
    /// Base units of this mint required per one basket unit.
    pub amount_per_unit: u64,
    /// Display weight in basis points (informational, sums to 10000).
    pub weight_bps: u16,
}

/// A user-defined, fully asset-backed index fund (custom ETF).
#[account]
#[derive(InitSpace)]
pub struct Basket {
    pub creator: Pubkey,
    /// Monotonic per-creator id used in the PDA seeds.
    pub nonce: u64,
    /// SPL mint representing proportional ownership of the vault.
    pub share_mint: Pubkey,
    #[max_len(MAX_NAME_LEN)]
    pub name: String,
    #[max_len(MAX_COMPONENTS)]
    pub components: Vec<BasketComponent>,
    /// Total basket units ever minted (informational).
    pub total_units: u64,
    pub bump: u8,
    /// Bump for the share mint PDA.
    pub mint_bump: u8,
}
