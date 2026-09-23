use anchor_lang::prelude::*;
use anchor_lang::AccountDeserialize;
use anchor_spl::associated_token::{self, AssociatedToken, get_associated_token_address};
use anchor_spl::token_interface::{
    self, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::Basket;

#[derive(Accounts)]
pub struct MintBasket<'info> {
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
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_mint_basket<'info>(
    ctx: Context<'info, MintBasket<'info>>,
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

    let basket_key = basket.key();

    for (i, component) in components.iter().enumerate() {
        let mint_ai = &ctx.remaining_accounts[i * 3];
        let vault_ai = &ctx.remaining_accounts[i * 3 + 1];
        let source_ai = &ctx.remaining_accounts[i * 3 + 2];

        require_keys_eq!(mint_ai.key(), component.mint, ErrorCode::ComponentMismatch);
        require_keys_eq!(
            vault_ai.key(),
            get_associated_token_address(&basket_key, &mint_ai.key()),
            ErrorCode::ComponentMismatch
        );

        if vault_ai.lamports() == 0 {
            associated_token::create(CpiContext::new(
                ctx.accounts.associated_token_program.key(),
                associated_token::Create {
                    payer: ctx.accounts.user.to_account_info(),
                    associated_token: vault_ai.clone(),
                    authority: basket.to_account_info(),
                    mint: mint_ai.clone(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            ))?;
        }

        let required = (component.amount_per_unit as u128)
            .checked_mul(units as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BASKET_UNIT as u128)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(required > 0, ErrorCode::InvalidAmount);

        let mint_decimals = read_decimals(mint_ai)?;
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: source_ai.clone(),
                    mint: mint_ai.clone(),
                    to: vault_ai.clone(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            required as u64,
            mint_decimals,
        )?;
    }

    let creator = basket.creator;
    let nonce = basket.nonce.to_le_bytes();
    let bump = basket.bump;
    let seeds: &[&[u8]] = &[BASKET_SEED, creator.as_ref(), &nonce, &[bump]];
    let signers: &[&[&[u8]]] = &[seeds];

    token_interface::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            MintTo {
                mint: ctx.accounts.share_mint.to_account_info(),
                to: ctx.accounts.user_share.to_account_info(),
                authority: basket.to_account_info(),
            },
            signers,
        ),
        units,
    )?;

    basket.total_units = basket
        .total_units
        .checked_add(units)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}

pub fn read_decimals(ai: &AccountInfo) -> Result<u8> {
    let data = ai.try_borrow_data()?;
    let mint = Mint::try_deserialize(&mut &data[..])?;
    Ok(mint.decimals)
}
