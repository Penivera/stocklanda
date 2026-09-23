use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::Config;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    /// CHECK: treasury wallet, stored as-is.
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: quote mint (e.g. USDC), stored as-is.
    pub quote_mint: UncheckedAccount<'info>,

    /// CHECK: Pyth receiver program id, stored as-is.
    pub pyth_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_config(
    ctx: Context<InitializeConfig>,
    fee_bps: u16,
    admin: Pubkey,
) -> Result<()> {
    require!(fee_bps <= 1_000, ErrorCode::Unauthorized);

    let config = &mut ctx.accounts.config;
    config.admin = admin;
    config.treasury = ctx.accounts.treasury.key();
    config.quote_mint = ctx.accounts.quote_mint.key();
    config.pyth_program = ctx.accounts.pyth_program.key();
    config.fee_bps = fee_bps;
    config.bump = ctx.bumps.config;
    Ok(())
}
