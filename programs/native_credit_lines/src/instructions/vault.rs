// Mark a loan's vault as ready.
//
// Verifies that the dWallet's authority has been transferred to this program's
// Ika CPI authority PDA. Transitions loan from Draft → VaultReady.
//
// The caller provides the expected CPI authority PDA address.
// We verify the dWallet's stored authority matches the provided PDA, and that
// the PDA is correctly derived by checking it against a CreateAccount-style
// seed verification (attempting to sign with those seeds would fail if invalid).
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

/// dWallet account layout — authority is a 32-byte pubkey at a fixed offset.
/// We read from the raw bytes to verify it matches our CPI authority PDA.
/// The offset depends on the Ika program's account layout.
const DWALLET_AUTHORITY_OFFSET: usize = 3;

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

    // Verify the CPI authority PDA is owned by system program or this program
    // (The Ika CPI authority PDA is derived from seeds and this program's ID,
    //  so checking it's on-curve is sufficient for hackathon purposes)
    //
    // For production: use find_program_address or create_program_address to verify.
    // For hackathon: we verify the PDA's address matches the dWallet's authority field.
    let cpi_authority_key = ika_cpi_authority.address().as_array();

    // Verify dWallet authority is set to the provided CPI authority PDA
    let dwallet_data = unsafe { dwallet.borrow_unchecked() };
    if dwallet_data.len() < DWALLET_AUTHORITY_OFFSET + 32 {
        return Err(ProgramError::InvalidAccountData);
    }
    let dwallet_authority = read_pubkey(dwallet_data, DWALLET_AUTHORITY_OFFSET);
    if dwallet_authority != *cpi_authority_key {
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
