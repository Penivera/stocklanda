use anchor_lang::prelude::*;

use crate::error::ErrorCode;

/// Magic number written at the start of a classic Pyth `PriceAccount`.
pub const PYTH_MAGIC: u32 = 0xa1b2_c3d4;

/// `PriceStatus::Trading`.
pub const PYTH_STATUS_TRADING: u32 = 1;

/// Pyth account type for a price feed.
pub const PYTH_ACCOUNT_TYPE_PRICE: u32 = 2;

/// Byte offsets into a classic Pyth `PriceAccount`.
const OFF_MAGIC: usize = 0;
const OFF_TYPE: usize = 8;
const OFF_EXPONENT: usize = 20;
const OFF_PUBLISH_TIME: usize = 96;
const OFF_AGG_PRICE: usize = 208;
const OFF_AGG_STATUS: usize = 224;
const MIN_LEN: usize = 240;

pub struct PythPrice {
    /// Raw integer price as published by Pyth.
    pub price: u64,
    /// Base-10 exponent to apply to `price`.
    pub exponent: i32,
    /// UNIX timestamp of the last aggregate update.
    pub publish_time: i64,
}

fn read_u32(data: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(data[offset..offset + 4].try_into().unwrap())
}

fn read_i32(data: &[u8], offset: usize) -> i32 {
    i32::from_le_bytes(data[offset..offset + 4].try_into().unwrap())
}

fn read_i64(data: &[u8], offset: usize) -> i64 {
    i64::from_le_bytes(data[offset..offset + 8].try_into().unwrap())
}

/// Parse a classic Pyth price account into a normalised price.
pub fn load_price(account: &AccountInfo) -> Result<PythPrice> {
    let data = account.try_borrow_data()?;
    require!(data.len() >= MIN_LEN, ErrorCode::InvalidPythAccount);
    require!(
        read_u32(&data, OFF_MAGIC) == PYTH_MAGIC,
        ErrorCode::InvalidPythAccount
    );
    require!(
        read_u32(&data, OFF_TYPE) == PYTH_ACCOUNT_TYPE_PRICE,
        ErrorCode::InvalidPythAccount
    );

    let exponent = read_i32(&data, OFF_EXPONENT);
    let publish_time = read_i64(&data, OFF_PUBLISH_TIME);
    let price = read_i64(&data, OFF_AGG_PRICE);
    let status = read_u32(&data, OFF_AGG_STATUS);

    require!(
        price > 0 && status == PYTH_STATUS_TRADING,
        ErrorCode::InvalidPythPrice
    );

    Ok(PythPrice {
        price: price as u64,
        exponent,
        publish_time,
    })
}

/// Scale a Pyth price with its exponent to 6 fixed decimals.
pub fn scale_to_6dp(price: u64, exponent: i32) -> Result<u64> {
    if exponent >= 0 {
        let factor = 10u64
            .checked_pow(exponent as u32)
            .ok_or(ErrorCode::MathOverflow)?;
        price.checked_mul(factor).ok_or(ErrorCode::MathOverflow.into())
    } else {
        let diff = (-exponent) as u32;
        if diff >= 6 {
            let div = 10u64
                .checked_pow(diff - 6)
                .ok_or(ErrorCode::MathOverflow)?;
            Ok(price / div)
        } else {
            let mul = 10u64
                .checked_pow(6 - diff)
                .ok_or(ErrorCode::MathOverflow)?;
            price.checked_mul(mul).ok_or(ErrorCode::MathOverflow.into())
        }
    }
}
