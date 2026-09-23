use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Config, OptionContract, OptionStatus};

#[derive(Accounts)]
pub struct CancelOption<'info> {
    #[account(mut)]
    pub writer: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [OPTION_SEED, option.writer.as_ref(), &option.id.to_le_bytes()],
        bump = option.bump,
        has_one = writer
    )]
    pub option: Account<'info, OptionContract>,

    #[account(mut, address = option.vault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = option.collateral_mint,
        token::authority = writer,
    )]
    pub writer_dest: InterfaceAccount<'info, TokenAccount>,

    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_cancel_option(ctx: Context<CancelOption>) -> Result<()> {
    require!(
        ctx.accounts.option.status == OptionStatus::Open,
        ErrorCode::OptionAlreadyActive
    );

    let amount = ctx.accounts.option.collateral_amount;
    let id_bytes = ctx.accounts.option.id.to_le_bytes();
    let writer = ctx.accounts.option.writer;
    let bump = ctx.accounts.option.bump;
    let seeds: &[&[u8]] = &[OPTION_SEED, writer.as_ref(), &id_bytes, &[bump]];
    let signers: &[&[&[u8]]] = &[seeds];

    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.writer_dest.to_account_info(),
                authority: ctx.accounts.option.to_account_info(),
            },
            signers,
        ),
        amount,
        ctx.accounts.collateral_mint.decimals,
    )?;

    ctx.accounts.option.status = OptionStatus::Cancelled;
    Ok(())
}
