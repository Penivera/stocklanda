use anchor_lang::prelude::*;
use anchor_spl::token_interface;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::error::ErrorCode;
use crate::pyth;
use crate::state::{Config, OptionContract, OptionStatus, OptionType, PriceSource};

#[derive(Accounts)]
pub struct SettleOption<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    /// Protocol admin that attests to the off-chain price.
    pub admin: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [OPTION_SEED, option.writer.as_ref(), &option.id.to_le_bytes()],
        bump = option.bump
    )]
    pub option: Account<'info, OptionContract>,

    #[account(mut, address = option.vault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = option.collateral_mint)]
    pub writer_dest: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = option.collateral_mint)]
    pub buyer_dest: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = option.collateral_mint)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = option.collateral_mint)]
    pub caller_dest: InterfaceAccount<'info, TokenAccount>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct SettleOptionPyth<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [OPTION_SEED, option.writer.as_ref(), &option.id.to_le_bytes()],
        bump = option.bump
    )]
    pub option: Account<'info, OptionContract>,

    #[account(mut, address = option.vault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = option.collateral_mint)]
    pub writer_dest: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = option.collateral_mint)]
    pub buyer_dest: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = option.collateral_mint)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, token::mint = option.collateral_mint)]
    pub caller_dest: InterfaceAccount<'info, TokenAccount>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: classic Pyth price account, validated against `config.pyth_program`.
    pub price_update: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_settle_option(
    ctx: Context<SettleOption>,
    price: u64,
    price_timestamp: i64,
) -> Result<()> {
    let clock = Clock::get()?;
    require_keys_eq!(
        ctx.accounts.admin.key(),
        ctx.accounts.config.admin,
        ErrorCode::Unauthorized
    );
    let age = (clock.unix_timestamp - price_timestamp).abs();
    require!(age <= MAX_ADMIN_PRICE_AGE, ErrorCode::StalePrice);
    require!(price > 0, ErrorCode::StalePrice);

    let option_ai = ctx.accounts.option.to_account_info();
    let writer = ctx.accounts.option.writer;
    let id_bytes = ctx.accounts.option.id.to_le_bytes();
    let bump = ctx.accounts.option.bump;

    settle(
        &mut ctx.accounts.option,
        &ctx.accounts.config,
        &option_ai,
        &ctx.accounts.vault.to_account_info(),
        &ctx.accounts.collateral_mint.to_account_info(),
        ctx.accounts.collateral_mint.decimals,
        &ctx.accounts.writer_dest.to_account_info(),
        &ctx.accounts.buyer_dest.to_account_info(),
        &ctx.accounts.treasury.to_account_info(),
        &ctx.accounts.caller_dest.to_account_info(),
        &ctx.accounts.token_program.to_account_info(),
        &writer,
        &id_bytes,
        bump,
        price,
        clock.unix_timestamp,
        PriceSource::Admin,
    )
}

pub fn handle_settle_option_pyth(ctx: Context<SettleOptionPyth>) -> Result<()> {
    let clock = Clock::get()?;
    let config = &ctx.accounts.config;

    require_keys_eq!(
        *ctx.accounts.price_update.owner,
        config.pyth_program,
        ErrorCode::InvalidPythAccount
    );

    let pyth_price = pyth::load_price(&ctx.accounts.price_update.to_account_info())?;
    let age = clock.unix_timestamp - pyth_price.publish_time;
    require!(age >= 0 && age <= MAX_PYTH_PRICE_AGE, ErrorCode::StalePrice);
    let price = pyth::scale_to_6dp(pyth_price.price, pyth_price.exponent)?;

    let option_ai = ctx.accounts.option.to_account_info();
    let writer = ctx.accounts.option.writer;
    let id_bytes = ctx.accounts.option.id.to_le_bytes();
    let bump = ctx.accounts.option.bump;

    settle(
        &mut ctx.accounts.option,
        config,
        &option_ai,
        &ctx.accounts.vault.to_account_info(),
        &ctx.accounts.collateral_mint.to_account_info(),
        ctx.accounts.collateral_mint.decimals,
        &ctx.accounts.writer_dest.to_account_info(),
        &ctx.accounts.buyer_dest.to_account_info(),
        &ctx.accounts.treasury.to_account_info(),
        &ctx.accounts.caller_dest.to_account_info(),
        &ctx.accounts.token_program.to_account_info(),
        &writer,
        &id_bytes,
        bump,
        price,
        clock.unix_timestamp,
        PriceSource::Pyth,
    )
}

#[allow(clippy::too_many_arguments)]
fn settle<'info>(
    option: &mut OptionContract,
    config: &Config,
    option_ai: &AccountInfo<'info>,
    vault: &AccountInfo<'info>,
    collateral_mint: &AccountInfo<'info>,
    collateral_decimals: u8,
    writer_dest: &AccountInfo<'info>,
    buyer_dest: &AccountInfo<'info>,
    treasury: &AccountInfo<'info>,
    caller_dest: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    writer: &Pubkey,
    id_bytes: &[u8],
    bump: u8,
    price: u64,
    now: i64,
    source: PriceSource,
) -> Result<()> {
    require!(
        option.status == OptionStatus::Active,
        ErrorCode::OptionNotOpen
    );
    require!(now >= option.expiry, ErrorCode::OptionNotExpired);
    require!(option.buyer != Pubkey::default(), ErrorCode::OptionNotOpen);

    let collateral = option.collateral_amount;
    let fee =
        ((collateral as u128) * (config.fee_bps as u128) / (BPS_DENOMINATOR as u128)) as u64;
    let caller_tip = fee / 2;
    let treasury_fee = fee - caller_tip;
    let distributable = collateral - fee;

    let (to_buyer, to_writer) = match option.option_type {
        OptionType::Put => {
            if price < option.strike {
                let diff = option.strike - price;
                let raw = (option.size as u128)
                    .checked_mul(diff as u128)
                    .ok_or(ErrorCode::MathOverflow)?
                    / (PRICE_DECIMALS as u128);
                let payout = core::cmp::min(raw, distributable as u128) as u64;
                (payout, distributable - payout)
            } else {
                (0, distributable)
            }
        }
        OptionType::Call => {
            if price > option.strike {
                let payout = core::cmp::min(option.size, distributable);
                (payout, distributable - payout)
            } else {
                (0, distributable)
            }
        }
    };

    let bump_arr = [bump];
    let seeds: &[&[u8]] = &[OPTION_SEED, writer.as_ref(), id_bytes, &bump_arr];
    let signers: &[&[&[u8]]] = &[seeds];

    transfer_from_vault(
        token_program,
        vault,
        collateral_mint,
        option_ai,
        caller_dest,
        caller_tip,
        collateral_decimals,
        signers,
    )?;
    transfer_from_vault(
        token_program,
        vault,
        collateral_mint,
        option_ai,
        treasury,
        treasury_fee,
        collateral_decimals,
        signers,
    )?;
    transfer_from_vault(
        token_program,
        vault,
        collateral_mint,
        option_ai,
        buyer_dest,
        to_buyer,
        collateral_decimals,
        signers,
    )?;
    transfer_from_vault(
        token_program,
        vault,
        collateral_mint,
        option_ai,
        writer_dest,
        to_writer,
        collateral_decimals,
        signers,
    )?;

    option.status = OptionStatus::Settled;
    option.settled_price = price;

    emit!(OptionSettled {
        option: option_ai.key(),
        price,
        source,
        buyer_payout: to_buyer,
        writer_payout: to_writer,
        fee,
    });
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn transfer_from_vault<'info>(
    token_program: &AccountInfo<'info>,
    vault: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    signers: &[&[&[u8]]],
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: vault.clone(),
                mint: mint.clone(),
                to: to.clone(),
                authority: authority.clone(),
            },
            signers,
        ),
        amount,
        decimals,
    )
}

#[event]
pub struct OptionSettled {
    pub option: Pubkey,
    pub price: u64,
    pub source: PriceSource,
    pub buyer_payout: u64,
    pub writer_payout: u64,
    pub fee: u64,
}
