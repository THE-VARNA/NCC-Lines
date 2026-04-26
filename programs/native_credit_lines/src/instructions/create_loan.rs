// Create a new loan position in Draft status.
//
// Instruction data: [pool_id(32), dwallet_pubkey(32), loan_bump(1)] = 65 bytes
//
// Accounts:
//   0. [writable]        Loan PDA (to create)
//   1. [readonly]        Pool PDA
//   2. [readonly]        dWallet account
//   3. [signer]          Borrower
//   4. [writable,signer] Payer
//   5. [readonly]        System program

use pinocchio::{
    cpi::{Seed, Signer},
    error::ProgramError,
    AccountView, Address, ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;

use crate::state::*;

pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if data.len() < 65 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let pool_id: [u8; 32] = data[0..32]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let dwallet_pubkey: [u8; 32] = data[32..64]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let loan_bump = data[64];

    let [loan_account, pool_account, dwallet, borrower, payer, _system_program, ..] = accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !borrower.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer() || !payer.is_writable() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate pool
    let pool_data = unsafe { pool_account.borrow_unchecked() };
    validate_account(pool_data, DISC_POOL, POOL_LEN)?;
    if pool_data[POOL_PAUSED] != 0 {
        return Err(ProgramError::InvalidArgument); // Pool is paused
    }

    // Verify pool_id matches
    let stored_pool_id = read_pubkey(pool_data, POOL_POOL_ID);
    if stored_pool_id != pool_id {
        return Err(ProgramError::InvalidArgument);
    }

    let asset = pool_data[POOL_ASSET];
    let loan_index = read_u32(pool_data, POOL_LOAN_COUNT);

    // Create Loan PDA
    let loan_index_bytes = loan_index.to_le_bytes();
    let loan_bump_byte = [loan_bump];
    let loan_seeds = [
        Seed::from(b"loan" as &[u8]),
        Seed::from(pool_id.as_ref()),
        Seed::from(loan_index_bytes.as_ref()),
        Seed::from(loan_bump_byte.as_ref()),
    ];
    let loan_signer = Signer::from(&loan_seeds);

    CreateAccount {
        from: payer,
        to: loan_account,
        lamports: minimum_balance(LOAN_LEN),
        space: LOAN_LEN as u64,
        owner: program_id,
    }
    .invoke_signed(&[loan_signer])?;

    // Write Loan fields
    let loan_data = unsafe { loan_account.borrow_unchecked_mut() };
    loan_data[0] = DISC_LOAN_POSITION;
    loan_data[1] = ACCOUNT_VERSION;
    loan_data[LOAN_POOL..LOAN_POOL + 32].copy_from_slice(pool_account.address().as_ref());
    loan_data[LOAN_BORROWER..LOAN_BORROWER + 32].copy_from_slice(borrower.address().as_ref());
    loan_data[LOAN_DWALLET..LOAN_DWALLET + 32].copy_from_slice(dwallet.address().as_ref());
    loan_data[LOAN_DWALLET_PUBKEY..LOAN_DWALLET_PUBKEY + 32].copy_from_slice(&dwallet_pubkey);
    // debt_ct, collateral_value_ct, attestation, policy_reveal, msg_approval — all zeros initially
    write_u32(loan_data, LOAN_INDEX, loan_index);
    loan_data[LOAN_ASSET] = asset;
    loan_data[LOAN_STATUS] = LoanStatus::Draft as u8;
    write_u32(loan_data, LOAN_NONCE, 0);
    loan_data[LOAN_BUMP] = loan_bump;

    // Increment pool loan count
    // Need to drop the borrow before re-borrowing pool
    drop(loan_data);
    let pool_data_mut = unsafe { pool_account.borrow_unchecked_mut() };
    let new_count = loan_index.checked_add(1).ok_or(ProgramError::ArithmeticOverflow)?;
    write_u32(pool_data_mut, POOL_LOAN_COUNT, new_count);

    Ok(())
}
