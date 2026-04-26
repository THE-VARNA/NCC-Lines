// Native Collateral Credit Lines
//
// A confidential lending protocol on Solana using:
//   - Encrypt FHE for private computation (debt, LTV, policy checks)
//   - Ika dWallet for native BTC-chain signing authorization
//   - Pinocchio framework for the on-chain program
//
// Core flow:
//   Ika DKG → authority transfer → Encrypt FHE policy → decrypt binary bit
//   → digest verified on-chain → program calls Ika approve_message
//   → MessageApproval signed → signature visible

#![no_std]
#![allow(unexpected_cfgs)]

extern crate alloc;

use pinocchio::{entrypoint, AccountView, Address, ProgramResult};
use pinocchio::error::ProgramError;

// Verify both sponsor SDKs compile together
#[allow(unused_imports)]
use encrypt_pinocchio::EncryptContext;
#[allow(unused_imports)]
use ika_dwallet_pinocchio::{DWalletContext, CPI_AUTHORITY_SEED};

entrypoint!(process_instruction);
pinocchio::nostd_panic_handler!();

/// Program ID — will be replaced with actual deployed address
pub const ID: Address = Address::new_from_array([0u8; 32]);

// ── Risk Parameters (basis points) ──
pub const MAX_BORROW_LTV_BPS: u16 = 6000;   // 60%
pub const LIQUIDATION_LTV_BPS: u16 = 7500;  // 75%
pub const BPS_DENOMINATOR: u16 = 10000;
pub const USD_SCALE: u64 = 100;              // USD cents

// ── Asset IDs ──
pub const ASSET_BTC: u8 = 1;

// ── Policy Actions ──
pub const POLICY_RELEASE: u8 = 1;
pub const POLICY_LIQUIDATION: u8 = 2;

// ── Instruction Discriminators ──
pub const IX_INITIALIZE_POOL: u8 = 0;
pub const IX_CREATE_LOAN: u8 = 1;
pub const IX_MARK_VAULT_READY: u8 = 2;
pub const IX_ATTACH_ATTESTATION: u8 = 3;
pub const IX_ACTIVATE_LOAN: u8 = 4;
pub const IX_BORROW: u8 = 5;
pub const IX_REPAY: u8 = 6;
pub const IX_REQUEST_RELEASE_POLICY: u8 = 7;
pub const IX_FINALIZE_RELEASE: u8 = 8;
pub const IX_REQUEST_LIQUIDATION_POLICY: u8 = 9;
pub const IX_FINALIZE_LIQUIDATION: u8 = 10;

pub mod state;
pub mod errors;
pub mod fhe_graphs;
pub mod instructions;

fn process_instruction(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    let (discriminator, rest) = data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    match *discriminator {
        IX_INITIALIZE_POOL => instructions::initialize_pool::process(program_id, accounts, rest),
        IX_CREATE_LOAN => instructions::create_loan::process(program_id, accounts, rest),
        IX_MARK_VAULT_READY => instructions::vault::process(program_id, accounts, rest),
        IX_ATTACH_ATTESTATION => instructions::attestation::process(program_id, accounts, rest),
        IX_ACTIVATE_LOAN => {
            // Activate is handled implicitly by attach_attestation (VaultReady → Active)
            // This is a no-op placeholder for potential future explicit activation
            Ok(())
        }
        IX_BORROW => instructions::borrow::process(program_id, accounts, rest),
        IX_REPAY => instructions::repay::process(program_id, accounts, rest),
        IX_REQUEST_RELEASE_POLICY => instructions::policy::request_release(program_id, accounts, rest),
        IX_FINALIZE_RELEASE => instructions::policy::finalize_release(program_id, accounts, rest),
        IX_REQUEST_LIQUIDATION_POLICY => instructions::policy::request_liquidation(program_id, accounts, rest),
        IX_FINALIZE_LIQUIDATION => instructions::policy::finalize_liquidation(program_id, accounts, rest),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
