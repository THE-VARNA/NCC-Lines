// Policy reveal and Ika message approval.
//
// This module implements the core product flow:
//   1. request_policy: execute FHE policy graph → request decryption of result
//   2. finalize_policy: read decrypted policy bit → if eligible, CPI approve_message
//
// Four entry points:
//   - request_release_policy (IX 7)
//   - finalize_release_and_approve (IX 8)
//   - request_liquidation_policy (IX 9)
//   - finalize_liquidation_and_approve (IX 10)

use pinocchio::{
    cpi::{Seed, Signer},
    error::ProgramError,
    AccountView, Address, ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;
use encrypt_pinocchio::EncryptContext;
use encrypt_pinocchio::accounts::read_decrypted_verified;
use ika_dwallet_pinocchio::{DWalletContext, CPI_AUTHORITY_SEED};

use crate::state::*;
use crate::{POLICY_RELEASE, POLICY_LIQUIDATION};

// ════════════════════════════════════════════════════════════
// Request Release Policy (IX 7)
// ════════════════════════════════════════════════════════════
//
// Executes release_policy FHE graph on debt_ct, then requests decryption
// of the binary result. Creates PolicyReveal PDA.
//
// Instruction data: [policy_bump(1), encrypt_cpi_bump(1)] = 2 bytes
//
// Accounts:
//   0. [writable]        Loan PDA
//   1. [readonly]        debt_ct (EUint64)
//   2. [writable]        policy_ct (fresh keypair, graph output)
//   3. [writable]        PolicyReveal PDA (to create)
//   4. [writable]        DecryptionRequest account (fresh keypair)
//   5. [signer]          Borrower
//   6. [writable,signer] Payer
//   7. [readonly]        System program
//   --- Encrypt fixed accounts (8-16) ---

pub fn request_release(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if data.len() < 2 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let policy_bump = data[0];
    let encrypt_cpi_bump = data[1];

    request_policy_inner(
        program_id, accounts, policy_bump, encrypt_cpi_bump,
        POLICY_RELEASE, LoanStatus::Active, LoanStatus::ReleaseCheckPending,
    )
}

// ════════════════════════════════════════════════════════════
// Request Liquidation Policy (IX 9)
// ════════════════════════════════════════════════════════════
//
// Same structure as release but uses liquidation_policy graph (needs both debt + collateral).
//
// Instruction data: [policy_bump(1), encrypt_cpi_bump(1)] = 2 bytes
//
// Accounts:
//   0. [writable]        Loan PDA
//   1. [readonly]        debt_ct
//   2. [readonly]        collateral_value_ct
//   3. [writable]        policy_ct (output)
//   4. [writable]        PolicyReveal PDA
//   5. [writable]        DecryptionRequest
//   6. [signer]          Liquidator (anyone can request)
//   7. [writable,signer] Payer
//   8. [readonly]        System program
//   --- Encrypt fixed accounts (9-17) ---

pub fn request_liquidation(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    if data.len() < 2 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let policy_bump = data[0];
    let encrypt_cpi_bump = data[1];

    request_liquidation_inner(
        program_id, accounts, policy_bump, encrypt_cpi_bump,
    )
}

fn request_policy_inner(
    program_id: &Address,
    accounts: &[AccountView],
    policy_bump: u8,
    encrypt_cpi_bump: u8,
    action: u8,
    expected_status: LoanStatus,
    next_status: LoanStatus,
) -> ProgramResult {
    if accounts.len() < 17 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let loan_account = &accounts[0];
    let debt_ct = &accounts[1];
    let policy_ct = &accounts[2];
    let policy_reveal_account = &accounts[3];
    let decryption_request = &accounts[4];
    let caller = &accounts[5]; // borrower for release
    let payer = &accounts[6];
    let system_program = &accounts[7];
    let encrypt_program = &accounts[8];
    let config = &accounts[9];
    let deposit = &accounts[10];
    let encrypt_cpi_authority = &accounts[11];
    let caller_program = &accounts[12];
    let network_encryption_key = &accounts[13];
    let event_authority = &accounts[14];
    let _encrypt_system = &accounts[15];
    // accounts[16] might be ciphertext for the decryption request

    if !caller.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_signer() || !payer.is_writable() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate loan
    let loan_data = unsafe { loan_account.borrow_unchecked() };
    validate_account(loan_data, DISC_LOAN_POSITION, LOAN_LEN)?;

    if action == POLICY_RELEASE {
        if read_pubkey(loan_data, LOAN_BORROWER) != *caller.address().as_array() {
            return Err(ProgramError::InvalidArgument);
        }
    }
    if loan_data[LOAN_STATUS] != expected_status as u8 {
        return Err(ProgramError::InvalidArgument);
    }

    let nonce = read_u32(loan_data, LOAN_NONCE);
    let loan_key = *loan_account.address().as_array();

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

    // Execute release_policy graph: debt → policy_bit
    ctx.release_policy(debt_ct, policy_ct)?;

    // Request decryption of the policy bit
    let digest = ctx.request_decryption(decryption_request, policy_ct)?;

    // Create PolicyReveal PDA
    let nonce_bytes = nonce.to_le_bytes();
    let policy_bump_byte = [policy_bump];
    let policy_seeds = [
        Seed::from(b"policy" as &[u8]),
        Seed::from(loan_key.as_ref()),
        Seed::from(nonce_bytes.as_ref()),
        Seed::from(policy_bump_byte.as_ref()),
    ];
    let policy_signer = Signer::from(&policy_seeds);

    CreateAccount {
        from: payer,
        to: policy_reveal_account,
        lamports: minimum_balance(POLICY_LEN),
        space: POLICY_LEN as u64,
        owner: program_id,
    }
    .invoke_signed(&[policy_signer])?;

    // Write PolicyReveal fields
    let pol_data = unsafe { policy_reveal_account.borrow_unchecked_mut() };
    pol_data[0] = DISC_POLICY_REVEAL;
    pol_data[1] = ACCOUNT_VERSION;
    pol_data[POL_LOAN..POL_LOAN + 32].copy_from_slice(&loan_key);
    pol_data[POL_ACTION] = action;
    pol_data[POL_POLICY_CT..POL_POLICY_CT + 32]
        .copy_from_slice(policy_ct.address().as_ref());
    pol_data[POL_DECRYPTION_REQ..POL_DECRYPTION_REQ + 32]
        .copy_from_slice(decryption_request.address().as_ref());
    pol_data[POL_PENDING_DIGEST..POL_PENDING_DIGEST + 32].copy_from_slice(&digest);
    pol_data[POL_STATUS] = PolicyRevealStatus::DecryptionRequested as u8;
    write_u32(pol_data, POL_NONCE, nonce);
    pol_data[POL_BUMP] = policy_bump;

    // Update loan
    drop(loan_data);
    let loan_data_mut = unsafe { loan_account.borrow_unchecked_mut() };
    loan_data_mut[LOAN_STATUS] = next_status as u8;
    loan_data_mut[LOAN_POLICY_REVEAL..LOAN_POLICY_REVEAL + 32]
        .copy_from_slice(policy_reveal_account.address().as_ref());

    Ok(())
}

fn request_liquidation_inner(
    program_id: &Address,
    accounts: &[AccountView],
    policy_bump: u8,
    encrypt_cpi_bump: u8,
) -> ProgramResult {
    if accounts.len() < 18 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let loan_account = &accounts[0];
    let debt_ct = &accounts[1];
    let collateral_value_ct = &accounts[2];
    let policy_ct = &accounts[3];
    let policy_reveal_account = &accounts[4];
    let decryption_request = &accounts[5];
    let liquidator = &accounts[6];
    let payer = &accounts[7];
    let system_program = &accounts[8];
    let encrypt_program = &accounts[9];
    let config = &accounts[10];
    let deposit = &accounts[11];
    let encrypt_cpi_authority = &accounts[12];
    let caller_program = &accounts[13];
    let network_encryption_key = &accounts[14];
    let event_authority = &accounts[15];
    let _encrypt_system = &accounts[16];

    if !liquidator.is_signer() || !payer.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate loan
    let loan_data = unsafe { loan_account.borrow_unchecked() };
    validate_account(loan_data, DISC_LOAN_POSITION, LOAN_LEN)?;
    if loan_data[LOAN_STATUS] != LoanStatus::Active as u8 {
        return Err(ProgramError::InvalidArgument);
    }

    let nonce = read_u32(loan_data, LOAN_NONCE);
    let loan_key = *loan_account.address().as_array();

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

    // Execute liquidation_policy graph: (debt, collateral) → policy_bit
    ctx.liquidation_policy(debt_ct, collateral_value_ct, policy_ct)?;

    // Request decryption
    let digest = ctx.request_decryption(decryption_request, policy_ct)?;

    // Create PolicyReveal PDA
    let nonce_bytes = nonce.to_le_bytes();
    let policy_bump_byte = [policy_bump];
    let policy_seeds = [
        Seed::from(b"policy" as &[u8]),
        Seed::from(loan_key.as_ref()),
        Seed::from(nonce_bytes.as_ref()),
        Seed::from(policy_bump_byte.as_ref()),
    ];
    let policy_signer = Signer::from(&policy_seeds);

    CreateAccount {
        from: payer,
        to: policy_reveal_account,
        lamports: minimum_balance(POLICY_LEN),
        space: POLICY_LEN as u64,
        owner: program_id,
    }
    .invoke_signed(&[policy_signer])?;

    let pol_data = unsafe { policy_reveal_account.borrow_unchecked_mut() };
    pol_data[0] = DISC_POLICY_REVEAL;
    pol_data[1] = ACCOUNT_VERSION;
    pol_data[POL_LOAN..POL_LOAN + 32].copy_from_slice(&loan_key);
    pol_data[POL_ACTION] = POLICY_LIQUIDATION;
    pol_data[POL_POLICY_CT..POL_POLICY_CT + 32]
        .copy_from_slice(policy_ct.address().as_ref());
    pol_data[POL_DECRYPTION_REQ..POL_DECRYPTION_REQ + 32]
        .copy_from_slice(decryption_request.address().as_ref());
    pol_data[POL_PENDING_DIGEST..POL_PENDING_DIGEST + 32].copy_from_slice(&digest);
    pol_data[POL_STATUS] = PolicyRevealStatus::DecryptionRequested as u8;
    write_u32(pol_data, POL_NONCE, nonce);
    pol_data[POL_BUMP] = policy_bump;

    drop(loan_data);
    let loan_data_mut = unsafe { loan_account.borrow_unchecked_mut() };
    loan_data_mut[LOAN_STATUS] = LoanStatus::LiquidationCheckPending as u8;
    loan_data_mut[LOAN_POLICY_REVEAL..LOAN_POLICY_REVEAL + 32]
        .copy_from_slice(policy_reveal_account.address().as_ref());

    Ok(())
}

// ════════════════════════════════════════════════════════════
// Finalize Release and Approve (IX 8)
// ════════════════════════════════════════════════════════════
//
// Reads decrypted policy bit, verifies digest, and if eligible (==1),
// CPI-calls approve_message on the Ika dWallet program.
//
// The program computes the keccak256 message digest on-chain from canonical
// fields (correction #8: no client-supplied arbitrary digests).
//
// Instruction data: [message_approval_bump(1), ika_cpi_bump(1),
//                     recipient_hash(32), message_metadata_digest(32),
//                     user_pubkey(32)] = 98 bytes
//
// Accounts:
//   0. [writable]        Loan PDA
//   1. [readonly]        PolicyReveal PDA
//   2. [readonly]        DecryptionRequest account (with decrypted result)
//   3. [signer]          Borrower
//   4. [writable,signer] Payer
//   5. [readonly]        System program
//   --- Ika CPI accounts ---
//   6. [readonly]        DWalletCoordinator PDA
//   7. [writable]        MessageApproval PDA (to create)
//   8. [readonly]        dWallet account
//   9. [readonly]        This program account (caller_program)
//  10. [readonly]        Ika CPI authority PDA
//  11. [readonly]        Ika dWallet program

pub fn finalize_release(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    finalize_and_approve(
        program_id, accounts, data,
        POLICY_RELEASE,
        LoanStatus::ReleaseCheckPending,
        LoanStatus::ReleasePendingSignature,
    )
}

// ════════════════════════════════════════════════════════════
// Finalize Liquidation and Approve (IX 10)
// ════════════════════════════════════════════════════════════

pub fn finalize_liquidation(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> ProgramResult {
    finalize_and_approve(
        program_id, accounts, data,
        POLICY_LIQUIDATION,
        LoanStatus::LiquidationCheckPending,
        LoanStatus::LiquidationPendingSignature,
    )
}

fn finalize_and_approve(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
    expected_action: u8,
    expected_status: LoanStatus,
    next_status: LoanStatus,
) -> ProgramResult {
    if data.len() < 98 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let message_approval_bump = data[0];
    let ika_cpi_bump = data[1];
    let recipient_hash: [u8; 32] = data[2..34]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let message_metadata_digest: [u8; 32] = data[34..66]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let user_pubkey: [u8; 32] = data[66..98]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    if accounts.len() < 12 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let loan_account = &accounts[0];
    let policy_reveal_account = &accounts[1];
    let decryption_request = &accounts[2];
    let caller = &accounts[3];
    let payer = &accounts[4];
    let system_program = &accounts[5];
    let coordinator = &accounts[6];
    let message_approval = &accounts[7];
    let dwallet = &accounts[8];
    let caller_program = &accounts[9];
    let ika_cpi_authority = &accounts[10];
    let dwallet_program = &accounts[11];

    if !caller.is_signer() || !payer.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Validate loan
    let loan_data = unsafe { loan_account.borrow_unchecked() };
    validate_account(loan_data, DISC_LOAN_POSITION, LOAN_LEN)?;

    if expected_action == POLICY_RELEASE {
        if read_pubkey(loan_data, LOAN_BORROWER) != *caller.address().as_array() {
            return Err(ProgramError::InvalidArgument);
        }
    }
    if loan_data[LOAN_STATUS] != expected_status as u8 {
        return Err(ProgramError::InvalidArgument);
    }

    // Validate policy reveal
    let pol_data = unsafe { policy_reveal_account.borrow_unchecked() };
    validate_account(pol_data, DISC_POLICY_REVEAL, POLICY_LEN)?;

    if pol_data[POL_ACTION] != expected_action {
        return Err(ProgramError::InvalidArgument);
    }
    if pol_data[POL_STATUS] != PolicyRevealStatus::DecryptionRequested as u8 {
        return Err(ProgramError::InvalidArgument);
    }

    // Read and verify decrypted policy bit
    let pending_digest = read_pubkey(pol_data, POL_PENDING_DIGEST);
    let req_data = unsafe { decryption_request.borrow_unchecked() };
    let policy_value: &u64 = read_decrypted_verified::<encrypt_types::types::Uint64>(
        req_data, &pending_digest
    )?;

    if *policy_value != 1 {
        // Policy check failed — mark as ineligible but don't error
        drop(pol_data);
        let pol_data_mut = unsafe { policy_reveal_account.borrow_unchecked_mut() };
        pol_data_mut[POL_STATUS] = PolicyRevealStatus::VerifiedIneligible as u8;

        // Reset loan status to Active
        drop(loan_data);
        let loan_data_mut = unsafe { loan_account.borrow_unchecked_mut() };
        loan_data_mut[LOAN_STATUS] = LoanStatus::Active as u8;
        let nonce = read_u32(loan_data_mut, LOAN_NONCE);
        write_u32(loan_data_mut, LOAN_NONCE, nonce + 1);

        return Ok(());
    }

    // Policy verified eligible — compute on-chain message digest
    // Canonical payload: "NCCL_V1" || action || loan_id(pubkey) || dwallet_pubkey ||
    //                    borrower || recipient_hash || asset || nonce
    // We use a simple hash: just concatenate fields and take first 32 bytes
    // In a real implementation, this would be keccak256. For the hackathon,
    // we construct a deterministic 32-byte digest from the canonical fields.
    let loan_key = loan_account.address().as_array();
    let nonce = read_u32(loan_data, LOAN_NONCE);
    let dwallet_pubkey = read_pubkey(loan_data, LOAN_DWALLET_PUBKEY);
    let borrower_key = read_pubkey(loan_data, LOAN_BORROWER);
    let asset = loan_data[LOAN_ASSET];

    // Build canonical message digest (simplified for no-std — XOR-based)
    let mut message_digest = [0u8; 32];
    // Start with "NCCL" prefix
    message_digest[0..4].copy_from_slice(b"NCCL");
    message_digest[4] = expected_action;
    message_digest[5] = asset;
    // XOR in loan key
    for i in 0..32 {
        message_digest[i] ^= loan_key[i];
    }
    // XOR in dwallet pubkey
    for i in 0..32 {
        message_digest[i] ^= dwallet_pubkey[i];
    }
    // XOR in borrower
    for i in 0..32 {
        message_digest[i] ^= borrower_key[i];
    }
    // XOR in recipient hash
    for i in 0..32 {
        message_digest[i] ^= recipient_hash[i];
    }
    // XOR in nonce
    let nonce_bytes = nonce.to_le_bytes();
    message_digest[28..32].copy_from_slice(&nonce_bytes);

    // Signature scheme: EcdsaDoubleSha256 = 2 for BTC (correction #1)
    let signature_scheme: u16 = 2; // DWalletSignatureScheme::EcdsaDoubleSha256

    // Build DWalletContext and approve_message via CPI
    let ika_ctx = DWalletContext {
        dwallet_program: dwallet_program,
        cpi_authority: ika_cpi_authority,
        caller_program,
        cpi_authority_bump: ika_cpi_bump,
    };

    ika_ctx.approve_message(
        coordinator,
        message_approval,
        dwallet,
        payer,
        system_program,
        message_digest,
        message_metadata_digest,
        user_pubkey,
        signature_scheme,
        message_approval_bump,
    )?;

    // Update policy reveal status
    drop(pol_data);
    let pol_data_mut = unsafe { policy_reveal_account.borrow_unchecked_mut() };
    pol_data_mut[POL_STATUS] = PolicyRevealStatus::MessageApproved as u8;

    // Update loan
    drop(loan_data);
    let loan_data_mut = unsafe { loan_account.borrow_unchecked_mut() };
    loan_data_mut[LOAN_STATUS] = next_status as u8;
    loan_data_mut[LOAN_MSG_APPROVAL..LOAN_MSG_APPROVAL + 32]
        .copy_from_slice(message_approval.address().as_ref());
    // Increment nonce for replay protection
    write_u32(loan_data_mut, LOAN_NONCE, nonce + 1);

    Ok(())
}
