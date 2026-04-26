// Copyright (c) 2026 Native Collateral Credit Lines
// FHE computation graphs using the Encrypt DSL.
//
// Each #[encrypt_fn] generates a private CPI trait implemented for EncryptContext.
// Since the traits are private (macro limitation), we expose public wrapper
// functions that other modules can call.
//
// All values are EUint64 representing USD cents (1 USD = 100 cents).
// LTV is computed in basis points: 6000 bps = 60%.

use encrypt_dsl::prelude::encrypt_fn;
use std::vec::Vec;
use encrypt_pinocchio::EncryptContext;
use pinocchio::{AccountView, ProgramResult};

// ── Graph Definitions ──
// These generate private traits automatically implemented for EncryptContext

#[encrypt_fn]
fn compute_limit_graph(collateral_value: EUint64) -> EUint64 {
    collateral_value * 6000 / 10000
}

#[encrypt_fn]
fn borrow_check_graph(
    debt: EUint64,
    pool_liquidity: EUint64,
    collateral_value: EUint64,
    amount: EUint64,
) -> (EUint64, EUint64, EUint64) {
    let new_debt = debt + amount;
    let limit = collateral_value * 6000 / 10000;
    let has_liquidity = pool_liquidity >= amount;
    let within_ltv = limit >= new_debt;
    let valid = has_liquidity * within_ltv;
    let actual_borrow = if valid { amount } else { EUint64::from(0u64) };
    let final_debt = debt + actual_borrow;
    let final_pool = pool_liquidity - actual_borrow;
    (final_debt, final_pool, actual_borrow)
}

#[encrypt_fn]
fn repay_check_graph(
    debt: EUint64,
    pool_liquidity: EUint64,
    repay_amount: EUint64,
) -> (EUint64, EUint64, EUint64) {
    let actual = debt.min(&repay_amount);
    let final_debt = debt - actual;
    let final_pool = pool_liquidity + actual;
    (final_debt, final_pool, actual)
}

#[encrypt_fn]
fn release_policy_graph(debt: EUint64) -> EUint64 {
    let zero = EUint64::from(0u64);
    debt.is_equal(&zero)
}

#[encrypt_fn]
fn liquidation_policy_graph(debt: EUint64, collateral_value: EUint64) -> EUint64 {
    let lhs = debt * 10000;
    let rhs = collateral_value * 7500;
    lhs.is_greater_or_equal(&rhs)
}

// ── Public Wrapper Functions ──
// These are callable from other modules since they delegate to the private trait methods.

pub fn exec_borrow_check<'a>(
    ctx: &EncryptContext<'a>,
    debt: &'a AccountView,
    pool: &'a AccountView,
    collateral: &'a AccountView,
    amount: &'a AccountView,
    out_debt: &'a AccountView,
    out_pool: &'a AccountView,
    out_actual: &'a AccountView,
) -> ProgramResult {
    ctx.borrow_check_graph(debt, pool, collateral, amount, out_debt, out_pool, out_actual)
}

pub fn exec_repay_check<'a>(
    ctx: &EncryptContext<'a>,
    debt: &'a AccountView,
    pool: &'a AccountView,
    repay: &'a AccountView,
    out_debt: &'a AccountView,
    out_pool: &'a AccountView,
    out_actual: &'a AccountView,
) -> ProgramResult {
    ctx.repay_check_graph(debt, pool, repay, out_debt, out_pool, out_actual)
}

pub fn exec_release_policy<'a>(
    ctx: &EncryptContext<'a>,
    debt: &'a AccountView,
    out_policy: &'a AccountView,
) -> ProgramResult {
    ctx.release_policy_graph(debt, out_policy)
}

pub fn exec_liquidation_policy<'a>(
    ctx: &EncryptContext<'a>,
    debt: &'a AccountView,
    collateral: &'a AccountView,
    out_policy: &'a AccountView,
) -> ProgramResult {
    ctx.liquidation_policy_graph(debt, collateral, out_policy)
}
