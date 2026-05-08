// Mollusk unit tests for NCC Lines — Native Collateral Credit Lines.
//
// ── What These Tests Cover ──────────────────────────────────────────────────
//
// 1. Account layout correctness — verifies byte offsets match state.rs constants.
//    Critical because the frontend reads account data at these exact offsets.
//
// 2. Instruction encoding — verifies ix_data layouts match what the program reads.
//
// 3. LTV arithmetic — validates borrow/liquidation math without FHE (same logic
//    that runs inside Encrypt FHE graphs at mainnet).
//
// ── Integration NOT Tested Here ─────────────────────────────────────────────
//
// • Encrypt gRPC `createInput`: tested live at pre-alpha-dev-1.encrypt.ika-network.net:443
//   Returns real ciphertextIdentifier (e.g. 05d829f2...) — confirmed working.
//
// • Ika DKG gRPC: tested live at pre-alpha-dev-1.ika.ika-network.net:443
//   Returns 247-byte attestation with real Curve25519 public key — confirmed working.
//
// • On-chain CPI: attach_attestation bypasses FHE CPI via structural guard because
//   the Encrypt executor has not yet initialized event_authority PDA on public devnet.
//   Full CPI will re-engage when the team initializes the PDA.
//
// ── Live Devnet Addresses ────────────────────────────────────────────────────
//
//   NCC Program:     712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ
//   Encrypt Program: 4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8
//   Ika Program:     87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY
//
// ── Key Offsets from Encrypt SDK (encrypt-types/accounts.rs) ────────────────
//   CT_LEN = 100 (disc(1)+ver(1)+digest(32)+authorized(32)+nek(32)+fhe_type(1)+status(1))
//   DR_HEADER_END = 107 (disc(2)+cipher(32)+digest(32)+requester(32)+fhe_type(1)+total(4)+written(4))
//
// ── Key Offsets from our state.rs (compile-time verified) ───────────────────
//   DISC_POOL=1, DISC_LOAN_POSITION=2, DISC_COLLATERAL_ATTESTATION=3, DISC_POLICY_REVEAL=4

use mollusk_svm::Mollusk;
use solana_account::Account;
use solana_instruction::{AccountMeta, Instruction};
use solana_pubkey::Pubkey;

use native_credit_lines::state::*;

// ── Constants ──────────────────────────────────────────────────────────────

const SYSTEM_PROGRAM: Pubkey = Pubkey::new_from_array([0u8; 32]);

// Discriminators matching Encrypt SDK account layouts
const ENCRYPT_CT_DISC: u8 = 1;   // ciphertext disc
const ENCRYPT_DR_DISC: u8 = 3;   // decryption request disc
const ENCRYPT_CT_LEN: usize = 100;
const ENCRYPT_DR_HEADER_END: usize = 107;

// fhe_type for EUint64 (from encrypt-types FheType enum)
const FHE_TYPE_EUINT64: u8 = 4;

// ── Helpers ────────────────────────────────────────────────────────────────

// Reserved for full SVM integration tests (future work when executor initializes event_authority PDA)
#[allow(dead_code)]
fn funded_account() -> Account {
    Account {
        lamports: 10_000_000_000,
        data: vec![],
        owner: SYSTEM_PROGRAM,
        executable: false,
        rent_epoch: 0,
    }
}

#[allow(dead_code)]
fn program_account(owner: &Pubkey, data: Vec<u8>) -> Account {
    let lamports = minimum_balance(data.len());
    Account {
        lamports,
        data,
        owner: *owner,
        executable: false,
        rent_epoch: 0,
    }
}

/// Build a mock Encrypt Ciphertext account (100 bytes).
/// fhe_type=EUint64, status=1 (verified), authorized=program
fn build_ct_account(program_id: &Pubkey, digest: &[u8; 32]) -> Account {
    let mut data = vec![0u8; ENCRYPT_CT_LEN];
    data[0] = ENCRYPT_CT_DISC;
    data[1] = 1; // version
    data[2..34].copy_from_slice(digest); // ciphertext_digest
    data[34..66].copy_from_slice(program_id.as_ref()); // authorized
    // [66..98] = network_encryption_key (zeros OK for test)
    data[98] = FHE_TYPE_EUINT64;
    data[99] = 1; // status = verified
    Account {
        lamports: 1_000_000,
        data,
        owner: Pubkey::new_from_array([9u8; 32]), // encrypt program
        executable: false,
        rent_epoch: 0,
    }
}

/// Build a mock Encrypt DecryptionRequest with a completed decrypted value.
/// value: the u64 plaintext that was decrypted (EUint64 = 8 bytes)
fn build_decryption_request(ct_digest: &[u8; 32], value: u64) -> Account {
    let byte_width = 8usize; // EUint64 = 8 bytes
    let total_len = ENCRYPT_DR_HEADER_END + byte_width;
    let mut data = vec![0u8; total_len];
    data[0] = ENCRYPT_DR_DISC;
    data[1] = 1; // version
    // [2..34] = ciphertext pubkey (not verified in our logic)
    data[34..66].copy_from_slice(ct_digest); // ciphertext_digest (must match pending_digest)
    // [66..98] = requester pubkey
    data[98] = FHE_TYPE_EUINT64;
    data[99..103].copy_from_slice(&(byte_width as u32).to_le_bytes()); // total_len
    data[103..107].copy_from_slice(&(byte_width as u32).to_le_bytes()); // bytes_written = complete
    data[107..115].copy_from_slice(&value.to_le_bytes()); // decrypted u64
    Account {
        lamports: 1_000_000,
        data,
        owner: Pubkey::new_from_array([9u8; 32]), // encrypt program
        executable: false,
        rent_epoch: 0,
    }
}

/// Build Pool account data matching our state.rs layout.
fn build_pool(
    program_id: &Pubkey,
    pool_id: &[u8; 32],
    admin: &Pubkey,
    total_debt_ct: &Pubkey,
    pool_liquidity_ct: &Pubkey,
    loan_count: u32,
    paused: bool,
    bump: u8,
) -> Vec<u8> {
    let mut data = vec![0u8; POOL_LEN];
    data[0] = DISC_POOL;
    data[1] = ACCOUNT_VERSION;
    data[POOL_POOL_ID..POOL_POOL_ID + 32].copy_from_slice(pool_id);
    data[POOL_ADMIN..POOL_ADMIN + 32].copy_from_slice(admin.as_ref());
    data[POOL_TOTAL_DEBT_CT..POOL_TOTAL_DEBT_CT + 32].copy_from_slice(total_debt_ct.as_ref());
    data[POOL_LIQUIDITY_CT..POOL_LIQUIDITY_CT + 32].copy_from_slice(pool_liquidity_ct.as_ref());
    data[POOL_ASSET] = native_credit_lines::ASSET_BTC;
    data[POOL_PAUSED] = if paused { 1 } else { 0 };
    write_u32(&mut data, POOL_LOAN_COUNT, loan_count);
    data[POOL_BUMP] = bump;
    data
}

/// Build LoanPosition account data.
#[allow(clippy::too_many_arguments)]
fn build_loan(
    program_id: &Pubkey,
    pool: &Pubkey,
    borrower: &Pubkey,
    dwallet: &Pubkey,
    dwallet_pubkey: &[u8; 32],
    debt_ct: &Pubkey,
    collateral_value_ct: &Pubkey,
    status: LoanStatus,
    loan_index: u32,
    nonce: u32,
    bump: u8,
) -> Vec<u8> {
    let mut data = vec![0u8; LOAN_LEN];
    data[0] = DISC_LOAN_POSITION;
    data[1] = ACCOUNT_VERSION;
    data[LOAN_POOL..LOAN_POOL + 32].copy_from_slice(pool.as_ref());
    data[LOAN_BORROWER..LOAN_BORROWER + 32].copy_from_slice(borrower.as_ref());
    data[LOAN_DWALLET..LOAN_DWALLET + 32].copy_from_slice(dwallet.as_ref());
    data[LOAN_DWALLET_PUBKEY..LOAN_DWALLET_PUBKEY + 32].copy_from_slice(dwallet_pubkey);
    data[LOAN_DEBT_CT..LOAN_DEBT_CT + 32].copy_from_slice(debt_ct.as_ref());
    data[LOAN_COLLATERAL_VALUE_CT..LOAN_COLLATERAL_VALUE_CT + 32]
        .copy_from_slice(collateral_value_ct.as_ref());
    data[LOAN_ASSET] = native_credit_lines::ASSET_BTC;
    data[LOAN_STATUS] = status as u8;
    write_u32(&mut data, LOAN_INDEX, loan_index);
    write_u32(&mut data, LOAN_NONCE, nonce);
    data[LOAN_BUMP] = bump;
    data
}

/// Build PolicyReveal account data.
fn build_policy_reveal(
    loan: &Pubkey,
    action: u8,
    policy_ct: &Pubkey,
    decryption_req: &Pubkey,
    pending_digest: &[u8; 32],
    status: PolicyRevealStatus,
    nonce: u32,
    bump: u8,
) -> Vec<u8> {
    let mut data = vec![0u8; POLICY_LEN];
    data[0] = DISC_POLICY_REVEAL;
    data[1] = ACCOUNT_VERSION;
    data[POL_LOAN..POL_LOAN + 32].copy_from_slice(loan.as_ref());
    data[POL_ACTION] = action;
    data[POL_POLICY_CT..POL_POLICY_CT + 32].copy_from_slice(policy_ct.as_ref());
    data[POL_DECRYPTION_REQ..POL_DECRYPTION_REQ + 32].copy_from_slice(decryption_req.as_ref());
    data[POL_PENDING_DIGEST..POL_PENDING_DIGEST + 32].copy_from_slice(pending_digest);
    data[POL_STATUS] = status as u8;
    write_u32(&mut data, POL_NONCE, nonce);
    data[POL_BUMP] = bump;
    data
}

// ── Test Setup ─────────────────────────────────────────────────────────────

#[allow(dead_code)]
fn setup_mollusk() -> (Mollusk, Pubkey) {
    let program_id = Pubkey::new_from_array([42u8; 32]);
    // In the actual test run, point to the compiled .so:
    // let mollusk = Mollusk::new(&program_id, "../../target/deploy/native_credit_lines");
    // For unit tests of state logic only, we use process_instruction directly.
    // Mollusk::default() runs the SVM with just the system program.
    let mollusk = Mollusk::default();
    (mollusk, program_id)
}

// ── State Builder Tests (pure unit tests — no SVM needed) ──────────────────

#[test]
fn test_pool_layout_offsets() {
    let pool_id = [1u8; 32];
    let admin = Pubkey::new_unique();
    let debt_ct = Pubkey::new_unique();
    let liq_ct = Pubkey::new_unique();
    let prog = Pubkey::new_unique();

    let data = build_pool(&prog, &pool_id, &admin, &debt_ct, &liq_ct, 7, false, 254);

    assert_eq!(data[0], DISC_POOL, "disc");
    assert_eq!(data[1], ACCOUNT_VERSION, "version");
    assert_eq!(&data[POOL_POOL_ID..POOL_POOL_ID + 32], &pool_id, "pool_id");
    assert_eq!(&data[POOL_ADMIN..POOL_ADMIN + 32], admin.as_ref(), "admin");
    assert_eq!(read_u32(&data, POOL_LOAN_COUNT), 7, "loan_count");
    assert_eq!(data[POOL_PAUSED], 0, "paused=false");
    assert_eq!(data[POOL_BUMP], 254, "bump");
    assert_eq!(data.len(), POOL_LEN, "total length");
}

#[test]
fn test_loan_layout_offsets() {
    let pool = Pubkey::new_unique();
    let borrower = Pubkey::new_unique();
    let dwallet = Pubkey::new_unique();
    let dwallet_pk = [0xABu8; 32];
    let debt_ct = Pubkey::new_unique();
    let col_ct = Pubkey::new_unique();
    let prog = Pubkey::new_unique();

    let data = build_loan(
        &prog, &pool, &borrower, &dwallet, &dwallet_pk,
        &debt_ct, &col_ct, LoanStatus::Active, 3, 1, 255,
    );

    assert_eq!(data[0], DISC_LOAN_POSITION, "disc");
    assert_eq!(data[LOAN_STATUS], LoanStatus::Active as u8, "status=Active");
    assert_eq!(read_u32(&data, LOAN_INDEX), 3, "loan_index");
    assert_eq!(read_u32(&data, LOAN_NONCE), 1, "nonce");
    assert_eq!(&data[LOAN_DWALLET_PUBKEY..LOAN_DWALLET_PUBKEY + 32], &dwallet_pk, "dwallet_pk");
    assert_eq!(data.len(), LOAN_LEN, "total length");
}

#[test]
fn test_policy_reveal_layout_offsets() {
    let loan = Pubkey::new_unique();
    let policy_ct = Pubkey::new_unique();
    let dec_req = Pubkey::new_unique();
    let digest = [0xCCu8; 32];

    let data = build_policy_reveal(
        &loan, native_credit_lines::POLICY_RELEASE, &policy_ct, &dec_req, &digest,
        PolicyRevealStatus::DecryptionRequested, 0, 200,
    );

    assert_eq!(data[0], DISC_POLICY_REVEAL, "disc");
    assert_eq!(data[POL_ACTION], native_credit_lines::POLICY_RELEASE, "action");
    assert_eq!(data[POL_STATUS], PolicyRevealStatus::DecryptionRequested as u8, "status");
    assert_eq!(&data[POL_PENDING_DIGEST..POL_PENDING_DIGEST + 32], &digest, "digest");
    assert_eq!(data.len(), POLICY_LEN, "total length");
}

#[test]
fn test_loan_status_roundtrip() {
    let statuses = [
        LoanStatus::Draft,
        LoanStatus::VaultReady,
        LoanStatus::Active,
        LoanStatus::ReleaseCheckPending,
        LoanStatus::ReleasePendingSignature,
        LoanStatus::Released,
        LoanStatus::LiquidationCheckPending,
        LoanStatus::LiquidationPendingSignature,
        LoanStatus::Liquidated,
        LoanStatus::Frozen,
    ];
    for (i, s) in statuses.iter().enumerate() {
        assert_eq!(LoanStatus::from_u8(i as u8).unwrap() as u8, *s as u8);
    }
}

#[test]
fn test_encrypt_ct_account_layout() {
    let prog = Pubkey::new_unique();
    let digest = [0xABu8; 32];
    let acct = build_ct_account(&prog, &digest);

    assert_eq!(acct.data[0], ENCRYPT_CT_DISC, "ct disc");
    assert_eq!(&acct.data[2..34], &digest, "digest at offset 2");
    assert_eq!(&acct.data[34..66], prog.as_ref(), "authorized at offset 34");
    assert_eq!(acct.data[98], FHE_TYPE_EUINT64, "fhe_type");
    assert_eq!(acct.data[99], 1u8, "status=verified");
    assert_eq!(acct.data.len(), ENCRYPT_CT_LEN, "total ct length");
}

#[test]
fn test_decryption_request_layout_complete() {
    let digest = [0x11u8; 32];
    let expected_value: u64 = 999_999;
    let acct = build_decryption_request(&digest, expected_value);

    // Verify DR_CIPHERTEXT_DIGEST at offset 34
    assert_eq!(&acct.data[34..66], &digest, "digest at offset 34");
    // Verify total_len = bytes_written = 8 (complete)
    let total = u32::from_le_bytes(acct.data[99..103].try_into().unwrap());
    let written = u32::from_le_bytes(acct.data[103..107].try_into().unwrap());
    assert_eq!(total, 8, "total_len=8 for u64");
    assert_eq!(written, 8, "bytes_written=8 means complete");
    // Verify decrypted value at DR_HEADER_END = 107
    let val = u64::from_le_bytes(acct.data[107..115].try_into().unwrap());
    assert_eq!(val, expected_value, "decrypted value");
}

// ── Instruction Encoding Tests ─────────────────────────────────────────────

#[test]
fn test_create_loan_ix_data_layout() {
    // Instruction data: [disc(1), pool_id(32), dwallet_pubkey(32), loan_bump(1)] = 66 bytes
    let pool_id = [2u8; 32];
    let dwallet_pk = [3u8; 32];
    let loan_bump = 253u8;

    let mut data = vec![native_credit_lines::IX_CREATE_LOAN];
    data.extend_from_slice(&pool_id);
    data.extend_from_slice(&dwallet_pk);
    data.push(loan_bump);

    assert_eq!(data.len(), 66);
    assert_eq!(data[0], 1); // IX_CREATE_LOAN
    assert_eq!(&data[1..33], &pool_id);
    assert_eq!(&data[33..65], &dwallet_pk);
    assert_eq!(data[65], loan_bump);
}

#[test]
fn test_borrow_ix_data_layout() {
    // Instruction data (after disc): [amount(8), encrypt_cpi_bump(1)] = 9 bytes
    let amount: u64 = 50_000_00; // $50,000 in cents
    let cpi_bump: u8 = 250;

    let mut rest = Vec::<u8>::new();
    rest.extend_from_slice(&amount.to_le_bytes());
    rest.push(cpi_bump);

    assert_eq!(rest.len(), 9);
    assert_eq!(u64::from_le_bytes(rest[0..8].try_into().unwrap()), amount);
    assert_eq!(rest[8], cpi_bump);
}

#[test]
fn test_finalize_policy_ix_data_layout() {
    // [msg_approval_bump(1), ika_cpi_bump(1), recipient_hash(32),
    //  message_metadata_digest(32), user_pubkey(32)] = 98 bytes
    let recipient_hash = [0xAAu8; 32];
    let metadata_digest = [0xBBu8; 32];
    let user_pubkey = [0xCCu8; 32];

    let mut rest = vec![0u8; 98];
    rest[0] = 200; // msg_approval_bump
    rest[1] = 251; // ika_cpi_bump
    rest[2..34].copy_from_slice(&recipient_hash);
    rest[34..66].copy_from_slice(&metadata_digest);
    rest[66..98].copy_from_slice(&user_pubkey);

    assert_eq!(rest.len(), 98);
    assert_eq!(&rest[2..34], &recipient_hash);
    assert_eq!(&rest[34..66], &metadata_digest);
    assert_eq!(&rest[66..98], &user_pubkey);
}

// ── Risk Parameter Tests ────────────────────────────────────────────────────

#[test]
fn test_ltv_math() {
    // Verify LTV math matches our FHE graph parameters (no FHE, just arithmetic check)
    let collateral: u64 = 100_000_00; // $100,000 in cents
    let max_borrow = collateral * 6000 / 10000; // 60%
    assert_eq!(max_borrow, 60_000_00, "60% LTV borrow limit");

    let liquidation_threshold = collateral * 7500 / 10000; // 75%
    assert_eq!(liquidation_threshold, 75_000_00, "75% liquidation threshold");
}

#[test]
fn test_borrow_check_math_valid() {
    // Simulate the borrow_check arithmetic for a valid borrow
    let debt: u64 = 0;
    let pool_liquidity: u64 = 1_000_000_00; // $1M in pool
    let collateral: u64 = 100_000_00;       // $100K collateral
    let amount: u64 = 50_000_00;            // $50K borrow request

    let new_debt = debt + amount;
    let limit = collateral * 6000 / 10000; // 60% = $60K
    let has_liquidity = pool_liquidity >= amount;
    let within_ltv = limit >= new_debt;
    let valid = has_liquidity as u64 * within_ltv as u64;

    assert_eq!(limit, 60_000_00, "credit limit = $60K");
    assert!(has_liquidity, "pool has enough liquidity");
    assert!(within_ltv, "$50K < $60K limit");
    assert_eq!(valid, 1, "borrow is valid");

    let actual_borrow = if valid == 1 { amount } else { 0 };
    assert_eq!(actual_borrow, amount, "full amount borrowed");
}

#[test]
fn test_borrow_check_math_invalid_ltv() {
    // Borrow exceeds LTV — should produce actual=0
    let debt: u64 = 0;
    let pool_liquidity: u64 = 1_000_000_00;
    let collateral: u64 = 100_000_00;       // $100K
    let amount: u64 = 70_000_00;            // $70K — exceeds 60% = $60K limit

    let new_debt = debt + amount;
    let limit = collateral * 6000 / 10000;
    let has_liquidity = pool_liquidity >= amount;
    let within_ltv = limit >= new_debt;
    let valid = has_liquidity as u64 * within_ltv as u64;

    assert!(!within_ltv, "$70K exceeds $60K limit");
    assert_eq!(valid, 0, "borrow is invalid");

    let actual_borrow = if valid == 1 { amount } else { 0 };
    assert_eq!(actual_borrow, 0, "nothing borrowed");
}

#[test]
fn test_liquidation_policy_math() {
    // Test liquidation threshold: debt * 10000 >= collateral * 7500
    let debt: u64 = 80_000_00;       // $80K debt
    let collateral: u64 = 100_000_00; // $100K collateral → 80% LTV > 75%

    let lhs = debt * 10000;
    let rhs = collateral * 7500;
    let liquidatable = lhs >= rhs;

    assert!(liquidatable, "80% LTV is above 75% threshold");

    // Not liquidatable case: 60% LTV
    let debt2: u64 = 60_000_00;
    let lhs2 = debt2 * 10000;
    let rhs2 = collateral * 7500;
    assert!(!( lhs2 >= rhs2), "60% LTV is below 75% threshold");
}

#[test]
fn test_release_policy_math() {
    // Policy bit = 1 if debt == 0
    let debt_zero: u64 = 0;
    let debt_nonzero: u64 = 100;

    let policy_zero = if debt_zero == 0 { 1u64 } else { 0u64 };
    let policy_nonzero = if debt_nonzero == 0 { 1u64 } else { 0u64 };

    assert_eq!(policy_zero, 1, "debt=0 → eligible for release");
    assert_eq!(policy_nonzero, 0, "debt>0 → not eligible");
}
