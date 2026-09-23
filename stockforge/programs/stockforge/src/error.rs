use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Caller is not authorized to perform this action")]
    Unauthorized,

    #[msg("Option has already been purchased")]
    OptionAlreadyActive,

    #[msg("Option is not open for purchase")]
    OptionNotOpen,

    #[msg("Option cannot be settled before its expiry timestamp")]
    OptionNotExpired,

    #[msg("Option has already been settled")]
    OptionAlreadySettled,

    #[msg("Expiry timestamp must be in the future")]
    InvalidExpiry,

    #[msg("Option size must be greater than zero")]
    InvalidSize,

    #[msg("Collateral amount is insufficient for this option")]
    InsufficientCollateral,

    #[msg("Premium must be greater than zero")]
    InvalidPremium,

    #[msg("Strike price must be greater than zero")]
    InvalidStrike,

    #[msg("Basket nonce does not match")]
    InvalidNonce,

    #[msg("Collateral mint must match the underlying mint for covered calls")]
    InvalidCollateralMint,

    #[msg("Underlying and collateral mints must differ for cash-secured puts")]
    InvalidPutCollateral,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Math underflow")]
    MathUnderflow,

    #[msg("Settlement price is stale or from an untrusted source")]
    StalePrice,

    #[msg("Pyth price account is invalid or owned by the wrong program")]
    InvalidPythAccount,

    #[msg("Pyth price is not currently valid")]
    InvalidPythPrice,

    #[msg("Basket must contain between 1 and 8 components")]
    InvalidComponents,

    #[msg("Basket weights must sum to 10000 basis points")]
    InvalidWeights,

    #[msg("Basket component mints must be unique")]
    DuplicateComponent,

    #[msg("Component account does not match the basket definition")]
    ComponentMismatch,

    #[msg("Basket share amount must be greater than zero")]
    InvalidAmount,

    #[msg("Basket name is too long")]
    NameTooLong,

    #[msg("Not enough basket shares supplied")]
    InsufficientShares,
}
