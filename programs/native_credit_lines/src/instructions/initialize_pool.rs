// Initialize a lending pool.
//
// Creates Pool PDA with encrypted zero total_debt and seeded pool_liquidity.
//
// Instruction data: [pool_id(32), asset(1), seed_liquidity_usd_cents(8), pool_bump(1), encrypt_cpi_bump(1)]
//
// Accounts:
//   0. [writable]        Pool PDA (to create)
//   1. [writable]        total_debt ciphertext account (fresh keypair, will become EUint64 zero)
//   2. [writable]        pool_liquidity ciphertext account (fresh keypair, will become EUint64)
//   3. [signer]          Admin
//   4. [writable,signer] Payer
//   5. [readonly]        System program
//   --- Encrypt fixed accounts for create_plaintext_typed ---
//   6. [readonly]        Encrypt program
//   7. [readonly]        EncryptConfig PDA
//   8. [writable]        EncryptDeposit PDA
//   9. [readonly]        Encrypt CPI authority PDA
//  10. [readonly]        Caller program (this program)
//  11. [readonly]        NetworkEncryptionKey PDA
//  12. [readonly]        Event authority PDA
//  13. [readonly]        System program (for Encrypt CPI)

use pinocchio::{
    cpi::{Seed, Signer},
    error::ProgramError,
    AccountView, Address, ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;
use encrypt_pinocchio::EncryptContext;

use crate::state::*;
use crate::ASSET_BTC;

pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    // Parse instruction data
    if data.len() < 43 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let pool_id: [u8; 32] = data[0..32]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let asset = data[32];
    let seed_liquidity = u64::from_le_bytes(
        data[33..41]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let pool_bump = data[41];
    let encrypt_cpi_bump = data[42];

    // Validate asset
    if asset != ASSET_BTC {
        return Err(ProgramError::InvalidArgument);
    }

    // Destructure accounts
    if accounts.len() < 14 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }
    let pool_account = &accounts[0];
    let total_debt_ct = &accounts[1];
    let pool_liquidity_ct = &accounts[2];
    let admin = &accounts[3];
    let payer = &accounts[4];
    let system_program = &accounts[5];

    // Encrypt fixed accounts
    let encrypt_program = &accounts[6];
    let config = &accounts[7];
    let deposit = &accounts[8];
    let encrypt_cpi_authority = &accounts[9];
    let caller_program = &accounts[10];
    let network_encryption_key = &accounts[11];
    let event_authority = &accounts[12];
    let _encrypt_system = &accounts[13]; // same as system_program

    // Validate signers
    if !admin.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer() || !payer.is_writable() {
        return Err(ProgramError::MissingRequiredSignature);
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
    pool_data[POOL_TOTAL_DEBT_CT..POOL_TOTAL_DEBT_CT + 32]
        .copy_from_slice(total_debt_ct.address().as_ref());
    pool_data[POOL_LIQUIDITY_CT..POOL_LIQUIDITY_CT + 32]
        .copy_from_slice(pool_liquidity_ct.address().as_ref());
    pool_data[POOL_ASSET] = asset;
    pool_data[POOL_PAUSED] = 0;
    write_u32(pool_data, POOL_LOAN_COUNT, 0);
    pool_data[POOL_BUMP] = pool_bump;

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

    // Create encrypted zero for total_debt
    ctx.create_plaintext_typed::<encrypt_types::types::Uint64>(&0u64, total_debt_ct)?;

    // Create encrypted seed liquidity
    ctx.create_plaintext_typed::<encrypt_types::types::Uint64>(&seed_liquidity, pool_liquidity_ct)?;

    Ok(())
}
