// Attach a collateral attestation to a loan.
//
// The issuer must be a signer (correction #6: no in-program signature verification).
// Creates CollateralAttestation PDA and an encrypted collateral_value ciphertext.
// Transitions loan from VaultReady → Active.
//
// Instruction data: [attestation_hash(32), collateral_value_usd_cents(8),
//                     timestamp(8), expiry(8), att_bump(1), encrypt_cpi_bump(1)] = 58 bytes
//
// Accounts:
//   0. [writable]        Loan PDA
//   1. [writable]        Attestation PDA (to create)
//   2. [writable]        collateral_value ciphertext account (fresh keypair)
//   3. [writable]        debt ciphertext account (fresh keypair, init to 0)
//   4. [signer]          Issuer (attestation authority)
//   5. [signer]          Borrower
//   6. [writable,signer] Payer
//   7. [readonly]        System program
//   --- Encrypt fixed accounts ---
//   8. [readonly]        Encrypt program
//   9. [readonly]        EncryptConfig PDA
//  10. [writable]        EncryptDeposit PDA
//  11. [readonly]        Encrypt CPI authority PDA
//  12. [readonly]        Caller program (this program)
//  13. [readonly]        NetworkEncryptionKey PDA
//  14. [readonly]        Event authority PDA
//  15. [readonly]        System program (for Encrypt CPI)

use pinocchio::{
    cpi::{Seed, Signer},
    error::ProgramError,
    AccountView, Address, ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;
use encrypt_pinocchio::EncryptContext;

use crate::state::*;

pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if data.len() < 58 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let attestation_hash: [u8; 32] = data[0..32]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let collateral_value = u64::from_le_bytes(
        data[32..40].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let timestamp = i64::from_le_bytes(
        data[40..48].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let expiry = i64::from_le_bytes(
        data[48..56].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let att_bump = data[56];
    let encrypt_cpi_bump = data[57];

    if accounts.len() < 16 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let loan_account = &accounts[0];
    let attestation_account = &accounts[1];
    let collateral_value_ct = &accounts[2];
    let debt_ct = &accounts[3];
    let issuer = &accounts[4];
    let borrower = &accounts[5];
    let payer = &accounts[6];
    let system_program = &accounts[7];

    // Encrypt fixed accounts
    let encrypt_program = &accounts[8];
    let config = &accounts[9];
    let deposit = &accounts[10];
    let encrypt_cpi_authority = &accounts[11];
    let caller_program = &accounts[12];
    let network_encryption_key = &accounts[13];
    let event_authority = &accounts[14];
    let _encrypt_system = &accounts[15];

    // Validate signers
    if !issuer.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
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
    if loan_data[LOAN_STATUS] != LoanStatus::VaultReady as u8 {
        return Err(ProgramError::InvalidArgument);
    }

    // Create Attestation PDA
    let loan_key = loan_account.address().as_array();
    let att_bump_byte = [att_bump];
    let att_seeds = [
        Seed::from(b"attestation" as &[u8]),
        Seed::from(loan_key.as_ref()),
        Seed::from(att_bump_byte.as_ref()),
    ];
    let att_signer = Signer::from(&att_seeds);

    CreateAccount {
        from: payer,
        to: attestation_account,
        lamports: minimum_balance(ATTESTATION_LEN),
        space: ATTESTATION_LEN as u64,
        owner: program_id,
    }
    .invoke_signed(&[att_signer])?;

    // Write attestation fields
    let att_data = unsafe { attestation_account.borrow_unchecked_mut() };
    att_data[0] = DISC_COLLATERAL_ATTESTATION;
    att_data[1] = ACCOUNT_VERSION;
    att_data[ATT_LOAN..ATT_LOAN + 32].copy_from_slice(loan_key);
    att_data[ATT_ISSUER..ATT_ISSUER + 32].copy_from_slice(issuer.address().as_ref());
    att_data[ATT_HASH..ATT_HASH + 32].copy_from_slice(&attestation_hash);
    write_u64(att_data, ATT_COLLATERAL_VALUE, collateral_value);
    write_i64(att_data, ATT_TIMESTAMP, timestamp);
    write_i64(att_data, ATT_EXPIRY, expiry);
    att_data[ATT_BUMP] = att_bump;

    // Create encrypted ciphertexts via Encrypt CPI
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

    // Create encrypted collateral value
    ctx.create_plaintext_typed::<encrypt_types::encrypted::Uint64>(&collateral_value, collateral_value_ct)?;

    // Create encrypted zero for initial debt
    ctx.create_plaintext_typed::<encrypt_types::encrypted::Uint64>(&0u64, debt_ct)?;

    // Update loan — transition to Active
    drop(loan_data);
    let loan_data_mut = unsafe { loan_account.borrow_unchecked_mut() };
    loan_data_mut[LOAN_ATTESTATION..LOAN_ATTESTATION + 32]
        .copy_from_slice(attestation_account.address().as_ref());
    loan_data_mut[LOAN_COLLATERAL_VALUE_CT..LOAN_COLLATERAL_VALUE_CT + 32]
        .copy_from_slice(collateral_value_ct.address().as_ref());
    loan_data_mut[LOAN_DEBT_CT..LOAN_DEBT_CT + 32]
        .copy_from_slice(debt_ct.address().as_ref());
    loan_data_mut[LOAN_STATUS] = LoanStatus::Active as u8;

    Ok(())
}
