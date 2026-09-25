pub mod constants;
pub mod error;
pub mod instructions;
pub mod pyth;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("5qNeAcUKD45g3T5osCLVk13Q8CZLtT7BWhivG5og9CMf");

#[program]
pub mod stockforge {
    use super::*;

    /// Create the global protocol configuration.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
        admin: Pubkey,
    ) -> Result<()> {
        crate::instructions::initialize_config::handle_initialize_config(ctx, fee_bps, admin)
    }

    /// Writer locks collateral and lists a fully-backed option.
    #[allow(clippy::too_many_arguments)]
    pub fn list_option(
        ctx: Context<ListOption>,
        id: u64,
        option_type: OptionType,
        strike: u64,
        size: u64,
        premium: u64,
        collateral_amount: u64,
        expiry: i64,
    ) -> Result<()> {
        crate::instructions::list_option::handle_list_option(
            ctx,
            id,
            option_type,
            strike,
            size,
            premium,
            collateral_amount,
            expiry,
        )
    }

    /// Buyer pays the premium and activates the contract.
    pub fn buy_option(ctx: Context<BuyOption>) -> Result<()> {
        crate::instructions::buy_option::handle_buy_option(ctx)
    }

    /// Permissionless settlement using an admin-attested price (pre-IPO assets).
    pub fn settle_option(
        ctx: Context<SettleOption>,
        price: u64,
        price_timestamp: i64,
    ) -> Result<()> {
        crate::instructions::settle::handle_settle_option(ctx, price, price_timestamp)
    }

    /// Permissionless settlement using an on-chain Pyth price (public equities).
    pub fn settle_option_pyth(ctx: Context<SettleOptionPyth>) -> Result<()> {
        crate::instructions::settle::handle_settle_option_pyth(ctx)
    }

    /// Writer reclaims collateral from an unsold listing.
    pub fn cancel_option(ctx: Context<CancelOption>) -> Result<()> {
        crate::instructions::cancel_option::handle_cancel_option(ctx)
    }

    /// Create a custom, fully collateralised basket (ETF) and its share mint.
    pub fn create_basket(
        ctx: Context<CreateBasket>,
        nonce: u64,
        name: String,
        components: Vec<BasketComponent>,
    ) -> Result<()> {
        crate::instructions::create_basket::handle_create_basket(ctx, nonce, name, components)
    }

    /// Deposit the underlying recipe and mint basket shares 1:1.
    pub fn mint_basket<'info>(
        ctx: Context<'info, MintBasket<'info>>,
        units: u64,
    ) -> Result<()> {
        crate::instructions::mint_basket::handle_mint_basket(ctx, units)
    }

    /// Burn basket shares and withdraw the proportional underlying assets.
    pub fn redeem_basket<'info>(
        ctx: Context<'info, RedeemBasket<'info>>,
        units: u64,
    ) -> Result<()> {
        crate::instructions::redeem_basket::handle_redeem_basket(ctx, units)
    }
}
