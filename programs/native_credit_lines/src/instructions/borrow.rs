// Borrow against collateral.
//
// Executes the borrow_check FHE graph to privately validate the borrow amount
// against LTV limits and pool liquidity.
//
// Instruction data: [amount_usd_cents(8), encrypt_cpi_bump(1)] = 9 bytes
//
// Accounts:
//   0. [writable]        Loan PDA
//   1. [readonly]        Pool PDA
//   --- FHE graph input ciphertexts ---
//   2. [readonly]        debt_ct (EUint64)
//   3. [readonly]        pool_liquidity_ct (EUint64)
//   4. [readonly]        collateral_value_ct (EUint64)
//   5. [writable]        amount_ct (fresh keypair, plaintext input)
//   --- FHE graph output ciphertexts ---
//   6. [writable]        new_debt_ct (output, replaces debt_ct)
//   7. [writable]        new_pool_ct (output, replaces pool liquidity)
//   8. [writable]        actual_borrow_ct (output, for event/proof)
//   --- Control ---
//   9. [signer]          Borrower
//  10. [writable,signer] Payer
//  11. [readonly]        System program
//   --- Encrypt fixed accounts ---
//  12. [readonly]        Encrypt program
//  13. [readonly]        EncryptConfig PDA
//  14. [writable]        EncryptDeposit PDA
//  15. [readonly]        Encrypt CPI authority PDA
//  16. [readonly]        Caller program (this program)
//  17. [readonly]        NetworkEncryptionKey PDA
//  18. [readonly]        Event authority PDA
//  19. [readonly]        System program (Encrypt)

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

    let amount = u64::from_le_bytes(
        data[0..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let encrypt_cpi_bump = data[8];

    if accounts.len() < 20 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let loan_account = &accounts[0];
    let pool_account = &accounts[1];
    let debt_ct = &accounts[2];
    let pool_liquidity_ct = &accounts[3];
    let collateral_value_ct = &accounts[4];
    let amount_ct = &accounts[5];
    let new_debt_ct = &accounts[6];
    let new_pool_ct = &accounts[7];
    let actual_borrow_ct = &accounts[8];
    let borrower = &accounts[9];
    let payer = &accounts[10];
    let system_program = &accounts[11];
    let encrypt_program = &accounts[12];
    let config = &accounts[13];
    let deposit = &accounts[14];
    let encrypt_cpi_authority = &accounts[15];
    let caller_program = &accounts[16];
    let network_encryption_key = &accounts[17];
    let event_authority = &accounts[18];
    let _encrypt_system = &accounts[19];

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
    if pool_data[POOL_PAUSED] != 0 {
        return Err(ProgramError::InvalidArgument);
    }

    // Build Encrypt context
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

    // Create plaintext amount ciphertext
    ctx.create_plaintext_typed::<encrypt_types::encrypted::Uint64>(&amount, amount_ct)?;

    // Execute borrow_check FHE graph via CPI
    fhe_graphs::exec_borrow_check(
        &ctx,
        debt_ct,
        pool_liquidity_ct,
        collateral_value_ct,
        amount_ct,
        new_debt_ct,
        new_pool_ct,
        actual_borrow_ct,
    )?;

    // Update loan to point to new ciphertexts
    drop(loan_data);
    let loan_data_mut = unsafe { loan_account.borrow_unchecked_mut() };
    loan_data_mut[LOAN_DEBT_CT..LOAN_DEBT_CT + 32]
        .copy_from_slice(new_debt_ct.address().as_ref());

    // Update pool to point to new liquidity ciphertext
    drop(pool_data);
    let pool_data_mut = unsafe { pool_account.borrow_unchecked_mut() };
    pool_data_mut[POOL_LIQUIDITY_CT..POOL_LIQUIDITY_CT + 32]
        .copy_from_slice(new_pool_ct.address().as_ref());

    Ok(())
}
