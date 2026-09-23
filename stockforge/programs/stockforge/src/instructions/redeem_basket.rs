use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token_interface::{
    self, Burn, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::ErrorCode;
use crate::instructions::mint_basket::read_decimals;
use crate::state::Basket;

#[derive(Accounts)]
pub struct RedeemBasket<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [BASKET_SEED, basket.creator.as_ref(), &basket.nonce.to_le_bytes()],
        bump = basket.bump
    )]
    pub basket: Account<'info, Basket>,

    #[account(
        mut,
        seeds = [BASKET_MINT_SEED, basket.key().as_ref()],
        bump = basket.mint_bump
    )]
    pub share_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = share_mint,
        associated_token::authority = user,
    )]
    pub user_share: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_redeem_basket<'info>(
    ctx: Context<'info, RedeemBasket<'info>>,
    units: u64,
) -> Result<()> {
    require!(units > 0, ErrorCode::InvalidAmount);

    let basket = &mut ctx.accounts.basket;
    let components = basket.components.clone();
    let expected = components.len() * 3;
    require!(
        ctx.remaining_accounts.len() == expected,
        ErrorCode::ComponentMismatch
    );

    token_interface::burn(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Burn {
                mint: ctx.accounts.share_mint.to_account_info(),
                from: ctx.accounts.user_share.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        units,
    )?;

    let basket_key = basket.key();
    let creator = basket.creator;
    let nonce = basket.nonce.to_le_bytes();
    let bump = basket.bump;
    let seeds: &[&[u8]] = &[BASKET_SEED, creator.as_ref(), &nonce, &[bump]];
    let signers: &[&[&[u8]]] = &[seeds];

    for (i, component) in components.iter().enumerate() {
        let mint_ai = &ctx.remaining_accounts[i * 3];
        let vault_ai = &ctx.remaining_accounts[i * 3 + 1];
        let dest_ai = &ctx.remaining_accounts[i * 3 + 2];

        require_keys_eq!(mint_ai.key(), component.mint, ErrorCode::ComponentMismatch);
        require_keys_eq!(
            vault_ai.key(),
            get_associated_token_address(&basket_key, &mint_ai.key()),
            ErrorCode::ComponentMismatch
        );

        let payout = (component.amount_per_unit as u128)
            .checked_mul(units as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BASKET_UNIT as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(payout > 0, ErrorCode::InvalidAmount);

        let mint_decimals = read_decimals(mint_ai)?;
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: vault_ai.clone(),
                    mint: mint_ai.clone(),
                    to: dest_ai.clone(),
                    authority: basket.to_account_info(),
                },
                signers,
            ),
            payout as u64,
            mint_decimals,
        )?;
    }

    basket.total_units = basket.total_units.saturating_sub(units);
    Ok(())
}
