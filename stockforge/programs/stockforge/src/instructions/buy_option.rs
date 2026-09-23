use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Config, OptionContract, OptionStatus};

#[derive(Accounts)]
pub struct BuyOption<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [OPTION_SEED, option.writer.as_ref(), &option.id.to_le_bytes()],
        bump = option.bump
    )]
    pub option: Account<'info, OptionContract>,

    pub premium_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = premium_mint,
        token::authority = buyer,
    )]
    pub buyer_premium: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = premium_mint,
    )]
    pub writer_premium: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_buy_option(ctx: Context<BuyOption>) -> Result<()> {
    let clock = Clock::get()?;
    let option = &mut ctx.accounts.option;

    require!(
        option.status == OptionStatus::Open,
        ErrorCode::OptionNotOpen
    );
    require!(clock.unix_timestamp < option.expiry, ErrorCode::OptionNotExpired);
    require_keys_eq!(
        ctx.accounts.premium_mint.key(),
        option.premium_mint,
        ErrorCode::InvalidCollateralMint
    );
    require_keys_eq!(
        (*ctx.accounts.writer_premium).owner,
        option.writer,
        ErrorCode::Unauthorized
    );

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.buyer_premium.to_account_info(),
                mint: ctx.accounts.premium_mint.to_account_info(),
                to: ctx.accounts.writer_premium.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        option.premium,
        ctx.accounts.premium_mint.decimals,
    )?;

    option.buyer = ctx.accounts.buyer.key();
    option.status = OptionStatus::Active;

    emit!(OptionPurchased {
        option: option.key(),
        buyer: option.buyer,
        premium: option.premium,
    });
    Ok(())
}

#[event]
pub struct OptionPurchased {
    pub option: Pubkey,
    pub buyer: Pubkey,
    pub premium: u64,
}
