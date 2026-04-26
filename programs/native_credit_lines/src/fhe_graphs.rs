// Copyright (c) 2026 Native Collateral Credit Lines
// FHE computation graphs using the Encrypt DSL.
//
// Each #[encrypt_fn] generates:
//   1. A function returning graph bytes (for offline testing)
//   2. A CPI extension method on EncryptContext: ctx.graph_name(inputs..., outputs...)
//
// All values are EUint64 representing USD cents (1 USD = 100 cents).
// LTV is computed in basis points: 6000 bps = 60%.

use encrypt_dsl::prelude::encrypt_fn;
use alloc::vec::Vec;

// ── Compute Credit Limit ──
// Given encrypted collateral value, compute max borrowable = collateral * 60%
#[encrypt_fn]
fn compute_limit(collateral_value: EUint64) -> EUint64 {
    collateral_value * 6000 / 10000
}

// ── Borrow Check ──
// Validates borrow amount against LTV limit and pool liquidity.
// Uses if/else (FHE Select) to avoid unsafe subtraction on invalid amounts.
// Returns: (final_debt, final_pool_liquidity, actual_borrow_amount)
//
// If valid: debt increases, pool decreases, actual = amount.
// If invalid: everything unchanged, actual = 0.
#[encrypt_fn]
fn borrow_check(
    debt: EUint64,
    pool_liquidity: EUint64,
    collateral_value: EUint64,
    amount: EUint64,
) -> (EUint64, EUint64, EUint64) {
    let new_debt = debt + amount;
    let limit = collateral_value * 6000 / 10000;
    let has_liquidity = pool_liquidity >= amount;
    let within_ltv = limit >= new_debt;
    // AND via multiplication: both conditions must be 1
    let valid = has_liquidity * within_ltv;
    // Safe conditional using FHE Select (if/else compiles to select op)
    let actual_borrow = if valid { amount } else { EUint64::from(0u64) };
    let final_debt = debt + actual_borrow;
    let final_pool = pool_liquidity - actual_borrow;
    (final_debt, final_pool, actual_borrow)
}

// ── Repay Check ──
// Clamps repayment to actual outstanding debt.
// Returns: (final_debt, final_pool_liquidity, actual_repay_amount)
#[encrypt_fn]
fn repay_check(
    debt: EUint64,
    pool_liquidity: EUint64,
    repay_amount: EUint64,
) -> (EUint64, EUint64, EUint64) {
    let actual = debt.min(&repay_amount);
    let final_debt = debt - actual;
    let final_pool = pool_liquidity + actual;
    (final_debt, final_pool, actual)
}

// ── Release Policy ──
// Returns 1 (eligible) if debt == 0, otherwise 0.
// This is the binary policy bit that gets decrypted and verified.
#[encrypt_fn]
fn release_policy(debt: EUint64) -> EUint64 {
    let zero = EUint64::from(0u64);
    // Comparison returns same type: 1 if equal, 0 if not
    debt.is_equal(&zero)
}

// ── Liquidation Policy ──
// Returns 1 (liquidatable) if debt/collateral ratio >= 75% (7500 bps).
// Rewritten to avoid division: debt * 10000 >= collateral_value * 7500
#[encrypt_fn]
fn liquidation_policy(debt: EUint64, collateral_value: EUint64) -> EUint64 {
    let lhs = debt * 10000;
    let rhs = collateral_value * 7500;
    lhs.is_greater_or_equal(&rhs)
}
