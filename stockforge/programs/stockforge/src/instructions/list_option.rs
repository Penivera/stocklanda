use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    self, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Config, OptionContract, OptionStatus, OptionType};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct ListOption<'info> {
    #[account(mut)]
    pub writer: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = writer,
        space = 8 + OptionContract::INIT_SPACE,
        seeds = [OPTION_SEED, writer.key().as_ref(), &id.to_le_bytes()],
        bump
    )]
    pub option: Account<'info, OptionContract>,

    pub underlying_mint: InterfaceAccount<'info, Mint>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub premium_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = collateral_mint,
        token::authority = writer,
    )]
    pub writer_collateral: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = writer,
        associated_token::mint = collateral_mint,
        associated_token::authority = option,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_list_option(
    ctx: Context<ListOption>,
    id: u64,
    option_type: OptionType,
    strike: u64,
    size: u64,
    premium: u64,
    collateral_amount: u64,
    expiry: i64,
) -> Result<()> {
    let clock = Clock::get()?;
    require!(expiry > clock.unix_timestamp, ErrorCode::InvalidExpiry);
    require!(size > 0, ErrorCode::InvalidSize);
    require!(strike > 0, ErrorCode::InvalidStrike);
    require!(premium > 0, ErrorCode::InvalidPremium);
    require!(collateral_amount > 0, ErrorCode::InsufficientCollateral);

    require_keys_eq!(
        ctx.accounts.premium_mint.key(),
        ctx.accounts.config.quote_mint,
        ErrorCode::InvalidCollateralMint
    );

    match option_type {
        OptionType::Put => {
            require_keys_eq!(
                ctx.accounts.collateral_mint.key(),
                ctx.accounts.config.quote_mint,
                ErrorCode::InvalidPutCollateral
            );
            // Worst-case payout happens when the price falls to zero.
            let max_payout = (size as u128)
                .checked_mul(strike as u128)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(PRICE_DECIMALS as u128)
                .ok_or(ErrorCode::MathOverflow)?;
            require!(
                collateral_amount as u128 >= max_payout,
                ErrorCode::InsufficientCollateral
            );
        }
        OptionType::Call => {
            require_keys_eq!(
                ctx.accounts.collateral_mint.key(),
                ctx.accounts.underlying_mint.key(),
                ErrorCode::InvalidCollateralMint
            );
            require!(
                collateral_amount >= size,
                ErrorCode::InsufficientCollateral
            );
        }
    }

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.writer_collateral.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.writer.to_account_info(),
            },
        ),
        collateral_amount,
        ctx.accounts.collateral_mint.decimals,
    )?;

    let option = &mut ctx.accounts.option;
    let option_key = option.key();
    option.id = id;
    option.writer = ctx.accounts.writer.key();
    option.buyer = Pubkey::default();
    option.underlying_mint = ctx.accounts.underlying_mint.key();
    option.collateral_mint = ctx.accounts.collateral_mint.key();
    option.premium_mint = ctx.accounts.premium_mint.key();
    option.option_type = option_type;
    option.status = OptionStatus::Open;
    option.strike = strike;
    option.size = size;
    option.premium = premium;
    option.collateral_amount = collateral_amount;
    option.expiry = expiry;
    option.settled_price = 0;
    option.vault = ctx.accounts.vault.key();
    option.bump = ctx.bumps.option;

    emit!(OptionListed {
        option: option_key,
        writer: option.writer,
        option_type,
        strike,
        size,
        premium,
        expiry,
    });
    Ok(())
}

#[event]
pub struct OptionListed {
    pub option: Pubkey,
    pub writer: Pubkey,
    pub option_type: OptionType,
    pub strike: u64,
    pub size: u64,
    pub premium: u64,
    pub expiry: i64,
}
