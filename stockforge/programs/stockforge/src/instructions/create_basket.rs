use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Basket, BasketComponent, Config};

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct CreateBasket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = creator,
        space = 8 + Basket::INIT_SPACE,
        seeds = [BASKET_SEED, creator.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub basket: Account<'info, Basket>,

    #[account(
        init,
        payer = creator,
        seeds = [BASKET_MINT_SEED, basket.key().as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = basket,
    )]
    pub share_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_basket(
    ctx: Context<CreateBasket>,
    nonce: u64,
    name: String,
    components: Vec<BasketComponent>,
) -> Result<()> {
    require!(!components.is_empty(), ErrorCode::InvalidComponents);
    require!(
        components.len() <= MAX_COMPONENTS,
        ErrorCode::InvalidComponents
    );
    require!(name.as_bytes().len() <= MAX_NAME_LEN, ErrorCode::NameTooLong);

    let mut weight_sum: u32 = 0;
    for (i, component) in components.iter().enumerate() {
        require!(component.amount_per_unit > 0, ErrorCode::InvalidAmount);
        weight_sum = weight_sum
            .checked_add(component.weight_bps as u32)
            .ok_or(ErrorCode::MathOverflow)?;
        for other in components.iter().skip(i + 1) {
            require!(
                other.mint != component.mint,
                ErrorCode::DuplicateComponent
            );
        }
    }
    require!(weight_sum == 10_000, ErrorCode::InvalidWeights);

    let basket = &mut ctx.accounts.basket;
    basket.creator = ctx.accounts.creator.key();
    basket.nonce = nonce;
    basket.share_mint = ctx.accounts.share_mint.key();
    basket.name = name.clone();
    basket.components = components.clone();
    basket.total_units = 0;
    basket.bump = ctx.bumps.basket;
    basket.mint_bump = ctx.bumps.share_mint;

    emit!(BasketCreated {
        basket: basket.key(),
        creator: basket.creator,
        share_mint: basket.share_mint,
        name,
        components,
    });
    Ok(())
}

#[event]
pub struct BasketCreated {
    pub basket: Pubkey,
    pub creator: Pubkey,
    pub share_mint: Pubkey,
    pub name: String,
    pub components: Vec<BasketComponent>,
}
