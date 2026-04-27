// debug_seed_pool — Devnet-only pool seeding instruction.
//
// Creates a Pool PDA WITHOUT calling Encrypt FHE CPI.
// Used for hackathon demo when Encrypt pre-alpha RPC is not available
// on public devnet. The full initialize_pool (with FHE CPI) is the
// production path.
//
// Instruction data: [pool_id(32), asset(1), pool_bump(1)] = 34 bytes
//
// Accounts:
//   0. [writable]        Pool PDA (to create)
//   1. [signer]          Admin
//   2. [writable,signer] Payer
//   3. [readonly]        System program

use pinocchio::{
    cpi::{Seed, Signer},
    error::ProgramError,
    AccountView, Address, ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;

use crate::state::*;
use crate::ASSET_BTC;

pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if data.len() < 34 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let pool_id: [u8; 32] = data[0..32]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let asset    = data[32];
    let pool_bump = data[33];

    if asset != ASSET_BTC {
        return Err(ProgramError::InvalidArgument);
    }

    let [pool_account, admin, payer, _system_program, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !admin.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer() || !payer.is_writable() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Already initialized? Return ok (idempotent).
    {
        let existing = unsafe { pool_account.borrow_unchecked() };
        if existing.len() >= POOL_LEN && existing[0] == DISC_POOL {
            return Ok(());
        }
    }

    // Create Pool PDA
    let pool_bump_byte = [pool_bump];
    let pool_seeds = [
        Seed::from(b"pool" as &[u8]),
        Seed::from(pool_id.as_ref()),
        Seed::from(pool_bump_byte.as_ref()),
    ];
    let pool_signer = Signer::from(&pool_seeds);

    CreateAccount {
        from: payer,
        to: pool_account,
        lamports: minimum_balance(POOL_LEN),
        space: POOL_LEN as u64,
        owner: program_id,
    }
    .invoke_signed(&[pool_signer])?;

    // Write Pool fields
    let pool_data = unsafe { pool_account.borrow_unchecked_mut() };
    pool_data[0] = DISC_POOL;
    pool_data[1] = ACCOUNT_VERSION;
    pool_data[POOL_POOL_ID..POOL_POOL_ID + 32].copy_from_slice(&pool_id);
    pool_data[POOL_ADMIN..POOL_ADMIN + 32].copy_from_slice(admin.address().as_ref());

    // Zero out ciphertext slot pubkeys (no Encrypt CPI on debug path)
    pool_data[POOL_TOTAL_DEBT_CT..POOL_TOTAL_DEBT_CT + 32].copy_from_slice(&[0u8; 32]);
    pool_data[POOL_LIQUIDITY_CT..POOL_LIQUIDITY_CT + 32].copy_from_slice(&[0u8; 32]);

    pool_data[POOL_ASSET]  = asset;
    pool_data[POOL_PAUSED] = 0;
    write_u32(pool_data, POOL_LOAN_COUNT, 0);
    pool_data[POOL_BUMP]   = pool_bump;

    Ok(())
}
