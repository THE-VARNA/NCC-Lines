// Mark a loan's vault as ready.
//
// Verifies that the dWallet's authority has been transferred to this program's
// Ika CPI authority PDA. Transitions loan from Draft → VaultReady.
//
// Instruction data: [] (empty, discriminator already consumed)
//
// Accounts:
//   0. [writable]  Loan PDA
//   1. [readonly]  dWallet account (to verify authority field)
//   2. [signer]    Borrower
//   3. [readonly]  Ika CPI authority PDA (for address verification)

use pinocchio::{
    error::ProgramError,
    AccountView, Address, ProgramResult,
};

use crate::state::*;
use ika_dwallet_pinocchio::CPI_AUTHORITY_SEED;

/// dWallet account layout — authority is at offset 2 + 1 = 3 (after disc + version + ...)
/// From Ika docs: the dWallet authority field is a 32-byte pubkey.
/// We verify it matches our program's CPI authority PDA.
const DWALLET_AUTHORITY_OFFSET: usize = 35; // disc(1) + version(1) + authority_type(1) + authority(32)

pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    _data: &[u8],
) -> ProgramResult {
    let [loan_account, dwallet, borrower, ika_cpi_authority, ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !borrower.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate loan
    let loan_data = unsafe { loan_account.borrow_unchecked() };
    validate_account(loan_data, DISC_LOAN_POSITION, LOAN_LEN)?;

    // Verify borrower owns this loan
    let stored_borrower = read_pubkey(loan_data, LOAN_BORROWER);
    if stored_borrower != *borrower.address().as_array() {
        return Err(ProgramError::InvalidArgument);
    }

    // Verify status is Draft
    if loan_data[LOAN_STATUS] != LoanStatus::Draft as u8 {
        return Err(ProgramError::InvalidArgument);
    }

    // Verify dWallet matches
    let stored_dwallet = read_pubkey(loan_data, LOAN_DWALLET);
    if stored_dwallet != *dwallet.address().as_array() {
        return Err(ProgramError::InvalidArgument);
    }

    // Derive expected CPI authority PDA
    let (expected_cpi_authority, _bump) =
        Address::find_program_address(&[CPI_AUTHORITY_SEED], program_id);

    // Verify the passed CPI authority matches
    if *ika_cpi_authority.address() != expected_cpi_authority {
        return Err(ProgramError::InvalidArgument);
    }

    // Verify dWallet authority is set to our CPI authority PDA.
    // The dWallet account data has the authority at a known offset.
    // We read it and compare to expected_cpi_authority.
    let dwallet_data = unsafe { dwallet.borrow_unchecked() };
    if dwallet_data.len() < DWALLET_AUTHORITY_OFFSET + 32 {
        return Err(ProgramError::InvalidAccountData);
    }
    let dwallet_authority = read_pubkey(dwallet_data, DWALLET_AUTHORITY_OFFSET);
    if dwallet_authority != *expected_cpi_authority.as_array() {
        return Err(ProgramError::Custom(
            crate::errors::CreditLineError::DWalletAuthorityInvalid as u32,
        ));
    }

    // Transition to VaultReady
    drop(loan_data);
    let loan_data_mut = unsafe { loan_account.borrow_unchecked_mut() };
    loan_data_mut[LOAN_STATUS] = LoanStatus::VaultReady as u8;

    Ok(())
}
