// Repay outstanding debt.
//
// Executes the repay_check FHE graph to clamp repayment to actual debt.
//
// Instruction data: [repay_amount_usd_cents(8), encrypt_cpi_bump(1)] = 9 bytes
//
// Accounts:
//   0. [writable]        Loan PDA
//   1. [readonly]        Pool PDA
//   2. [readonly]        debt_ct (EUint64)
//   3. [readonly]        pool_liquidity_ct (EUint64)
//   4. [writable]        repay_amount_ct (fresh keypair, plaintext input)
//   5. [writable]        new_debt_ct (output)
//   6. [writable]        new_pool_ct (output)
//   7. [writable]        actual_repay_ct (output)
//   8. [signer]          Borrower
//   9. [writable,signer] Payer
//  10. [readonly]        System program
//   --- Encrypt fixed accounts (11-18) ---

use pinocchio::{
    error::ProgramError,
    AccountView, Address, ProgramResult,
};
use encrypt_pinocchio::EncryptContext;

use crate::state::*;
use crate::fhe_graphs;

pub fn process(
    _program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if data.len() < 9 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let repay_amount = u64::from_le_bytes(
        data[0..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let encrypt_cpi_bump = data[8];

    if accounts.len() < 19 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let loan_account = &accounts[0];
    let pool_account = &accounts[1];
    let debt_ct = &accounts[2];
    let pool_liquidity_ct = &accounts[3];
    let repay_ct = &accounts[4];
    let new_debt_ct = &accounts[5];
    let new_pool_ct = &accounts[6];
    let actual_repay_ct = &accounts[7];
    let borrower = &accounts[8];
    let payer = &accounts[9];
    let system_program = &accounts[10];
    let encrypt_program = &accounts[11];
    let config = &accounts[12];
    let deposit = &accounts[13];
    let encrypt_cpi_authority = &accounts[14];
    let caller_program = &accounts[15];
    let network_encryption_key = &accounts[16];
    let event_authority = &accounts[17];
    let _encrypt_system = &accounts[18];

    if !borrower.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer() || !payer.is_writable() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate loan
    let loan_data = unsafe { loan_account.borrow_unchecked() };
    validate_account(loan_data, DISC_LOAN_POSITION, LOAN_LEN)?;
    if read_pubkey(loan_data, LOAN_BORROWER) != *borrower.address().as_array() {
        return Err(ProgramError::InvalidArgument);
    }
    if loan_data[LOAN_STATUS] != LoanStatus::Active as u8 {
        return Err(ProgramError::InvalidArgument);
    }

    // Validate pool
    let pool_data = unsafe { pool_account.borrow_unchecked() };
    validate_account(pool_data, DISC_POOL, POOL_LEN)?;

    let ctx = EncryptContext {
        encrypt_program,
        config,
        deposit,
        cpi_authority: encrypt_cpi_authority,
        caller_program,
        network_encryption_key,
        payer,
        event_authority,
        system_program,
        cpi_authority_bump: encrypt_cpi_bump,
    };

    // Create plaintext repay amount
    ctx.create_plaintext_typed::<encrypt_types::encrypted::Uint64>(&repay_amount, repay_ct)?;

    // Execute repay_check FHE graph
    fhe_graphs::exec_repay_check(
        &ctx,
        debt_ct,
        pool_liquidity_ct,
        repay_ct,
        new_debt_ct,
        new_pool_ct,
        actual_repay_ct,
    )?;

    // Update pointers
    drop(loan_data);
    let loan_data_mut = unsafe { loan_account.borrow_unchecked_mut() };
    loan_data_mut[LOAN_DEBT_CT..LOAN_DEBT_CT + 32]
        .copy_from_slice(new_debt_ct.address().as_ref());

    drop(pool_data);
    let pool_data_mut = unsafe { pool_account.borrow_unchecked_mut() };
    pool_data_mut[POOL_LIQUIDITY_CT..POOL_LIQUIDITY_CT + 32]
        .copy_from_slice(new_pool_ct.address().as_ref());

    Ok(())
}
