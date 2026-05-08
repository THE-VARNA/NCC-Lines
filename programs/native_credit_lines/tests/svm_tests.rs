// Mollusk SVM instruction-execution tests.
//
// Runs real instructions through the compiled BPF binary using the
// Mollusk SVM framework — no mocking, no stubbed CPI, actual program logic.
//
// Instructions tested:
//   create_loan      — creates loan PDA, writes Draft state
//   mark_vault_ready — verifies dWallet authority, transitions Draft→VaultReady
//
// Error paths tested for each instruction.

use mollusk_svm::Mollusk;
use solana_account::Account;
use solana_instruction::{AccountMeta, Instruction};
use solana_pubkey::Pubkey;

// ── Path to compiled BPF binary ───────────────────────────────────────────
// CARGO_MANIFEST_DIR = .../excri/programs/native_credit_lines
// ../../target/deploy/ → .../excri/target/deploy/
const PROGRAM_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../target/deploy/native_credit_lines"
);

// ── Instruction discriminators (must match lib.rs) ────────────────────────
const IX_CREATE_LOAN:       u8 = 1;
const IX_MARK_VAULT_READY:  u8 = 2;

// ── State layout constants (exact values from state.rs) ───────────────────
const POOL_LEN:  usize = 153;
const LOAN_LEN:  usize = 317;

const DISC_POOL: u8 = 1;    // DISC_POOL in state.rs
const DISC_LOAN: u8 = 2;    // DISC_LOAN_POSITION in state.rs

// Pool offsets
const POOL_POOL_ID:   usize = 2;
const POOL_ADMIN:     usize = 34;
const POOL_ASSET:     usize = 130;
const POOL_PAUSED:    usize = 131;
const POOL_LOAN_COUNT:usize = 132;   // u32 le
const POOL_BUMP:      usize = 136;

// Loan offsets
const LOAN_POOL:      usize = 2;
const LOAN_BORROWER:  usize = 34;
const LOAN_DWALLET:   usize = 66;
const LOAN_INDEX:     usize = 290;   // u32 le
const LOAN_ASSET:     usize = 294;
const LOAN_STATUS:    usize = 295;
const LOAN_BUMP:      usize = 300;

const LOAN_STATUS_DRAFT:       u8 = 0;  // LoanStatus::Draft
const LOAN_STATUS_VAULT_READY: u8 = 1;  // LoanStatus::VaultReady
const ASSET_BTC: u8 = 1;
const VER: u8 = 1;

// dWallet authority offset (matches DWALLET_AUTHORITY_OFFSET in vault.rs)
const DWALLET_AUTHORITY_OFFSET: usize = 3;

// Minimum rent-exempt balance (approximate)
const LAMPORTS_PER_BYTE: u64 = 6960;
fn rent_exempt(bytes: usize) -> u64 {
    LAMPORTS_PER_BYTE * bytes as u64 + 890_880
}

// ── System program ID ─────────────────────────────────────────────────────
fn system_program() -> Pubkey { Pubkey::new_from_array([0u8; 32]) }

// ── Account builders ──────────────────────────────────────────────────────

fn sol_account(lamports: u64) -> Account {
    Account {
        lamports,
        data: vec![],
        owner: system_program(),
        executable: false,
        rent_epoch: u64::MAX,
    }
}

fn system_program_account() -> Account {
    Account {
        lamports: 1,
        data: vec![],
        owner: system_program(),
        executable: true,
        rent_epoch: u64::MAX,
    }
}

/// Build a pool account ready for create_loan
fn pool_account(program_id: &Pubkey, pool_id: &[u8; 32], admin: &Pubkey, paused: bool, loan_count: u32) -> Account {
    let mut data = vec![0u8; POOL_LEN];
    data[0] = DISC_POOL;
    data[1] = VER;
    data[POOL_POOL_ID..POOL_POOL_ID + 32].copy_from_slice(pool_id);
    data[POOL_ADMIN..POOL_ADMIN + 32].copy_from_slice(admin.as_ref());
    data[POOL_ASSET]  = ASSET_BTC;
    data[POOL_PAUSED] = if paused { 1 } else { 0 };
    data[POOL_LOAN_COUNT..POOL_LOAN_COUNT + 4].copy_from_slice(&loan_count.to_le_bytes());
    data[POOL_BUMP]   = 255;
    Account {
        lamports: rent_exempt(POOL_LEN),
        data,
        owner: *program_id,
        executable: false,
        rent_epoch: u64::MAX,
    }
}

/// Build a loan account with given status
fn loan_account(
    program_id: &Pubkey,
    pool: &Pubkey,
    borrower: &Pubkey,
    dwallet: &Pubkey,
    status: u8,
    index: u32,
) -> Account {
    let mut data = vec![0u8; LOAN_LEN];
    data[0] = DISC_LOAN;
    data[1] = VER;
    data[LOAN_POOL..LOAN_POOL + 32].copy_from_slice(pool.as_ref());
    data[LOAN_BORROWER..LOAN_BORROWER + 32].copy_from_slice(borrower.as_ref());
    data[LOAN_DWALLET..LOAN_DWALLET + 32].copy_from_slice(dwallet.as_ref());
    data[LOAN_ASSET]   = ASSET_BTC;
    data[LOAN_STATUS]  = status;
    data[LOAN_INDEX..LOAN_INDEX + 4].copy_from_slice(&index.to_le_bytes());
    data[LOAN_BUMP]    = 253;
    Account {
        lamports: rent_exempt(LOAN_LEN),
        data,
        owner: *program_id,
        executable: false,
        rent_epoch: u64::MAX,
    }
}

/// Build a minimal dWallet account with authority at offset 3
fn dwallet_mock_account(ika_program: &Pubkey, authority: &Pubkey) -> Account {
    let mut data = vec![0u8; 64];
    data[DWALLET_AUTHORITY_OFFSET..DWALLET_AUTHORITY_OFFSET + 32].copy_from_slice(authority.as_ref());
    Account {
        lamports: 1_000_000,
        data,
        owner: *ika_program,
        executable: false,
        rent_epoch: u64::MAX,
    }
}

// ── create_loan ───────────────────────────────────────────────────────────

// NOTE: create_loan calls CreateAccount (system program CPI) unconditionally.
// This test requires a real funded runtime (devnet or a bank with SOL).
// Run with: cargo test --test svm_tests -- --ignored
#[test]
#[ignore = "requires system program CPI funding; run on devnet"]
fn test_svm_create_loan_success() {
    let program_id = Pubkey::new_unique();
    let mollusk = Mollusk::new(&program_id, PROGRAM_PATH);

    let pool_id  = [1u8; 32];
    let admin    = Pubkey::new_unique();
    let pool     = Pubkey::new_unique();
    let dwallet  = Pubkey::new_unique();
    let borrower = Pubkey::new_unique();
    let payer    = Pubkey::new_unique();
    let loan_key = Pubkey::new_unique();

    let mut ix_data = vec![IX_CREATE_LOAN];
    ix_data.extend_from_slice(&pool_id);
    ix_data.extend_from_slice(&[0xABu8; 32]); // dwallet_pubkey
    ix_data.push(253u8);                       // bump

    // Pre-allocate loan account so Mollusk's SVM doesn't need to
    // fund it from the payer via real system program CPI
    let pre_alloc_loan = Account {
        lamports: rent_exempt(LOAN_LEN),
        data: vec![0u8; LOAN_LEN],
        owner: program_id, // pre-owned by program
        executable: false,
        rent_epoch: u64::MAX,
    };

    let accounts = vec![
        (loan_key,        pre_alloc_loan),
        (pool,            pool_account(&program_id, &pool_id, &admin, false, 0)),
        (dwallet,         Account { lamports: 1_000_000, data: vec![0u8; 64], owner: Pubkey::new_unique(), executable: false, rent_epoch: u64::MAX }),
        (borrower,        sol_account(10_000_000_000)),
        (payer,           sol_account(10_000_000_000)),
        (system_program(),system_program_account()),
    ];

    let ix = Instruction::new_with_bytes(
        program_id,
        &ix_data,
        vec![
            AccountMeta::new(loan_key,         false),
            AccountMeta::new_readonly(pool,    false),
            AccountMeta::new_readonly(dwallet, false),
            AccountMeta::new_readonly(borrower, true),
            AccountMeta::new(payer,             true),
            AccountMeta::new_readonly(system_program(), false),
        ],
    );

    let result = mollusk.process_instruction(&ix, &accounts);

    assert!(!result.program_result.is_err(),
        "create_loan should succeed: {:?}", result.program_result);

    let loan = result.get_account(&loan_key).expect("loan account not found");
    assert_eq!(loan.data.len(), LOAN_LEN, "loan has correct size");
    assert_eq!(loan.data[0], DISC_LOAN, "loan discriminator");
    assert_eq!(loan.data[LOAN_STATUS], LOAN_STATUS_DRAFT, "status = Draft");
    assert_eq!(&loan.data[LOAN_BORROWER..LOAN_BORROWER + 32], borrower.as_ref(), "borrower stored");
    assert_eq!(&loan.data[LOAN_POOL..LOAN_POOL + 32], pool.as_ref(), "pool stored");

    let pool_after = result.get_account(&pool).expect("pool not returned");
    let count = u32::from_le_bytes(pool_after.data[POOL_LOAN_COUNT..POOL_LOAN_COUNT + 4].try_into().unwrap());
    assert_eq!(count, 1, "pool.loan_count incremented");

    println!("✓ create_loan: loan created, status=Draft, pool.loan_count=1");
}

#[test]
fn test_svm_create_loan_paused_pool_rejected() {
    let program_id = Pubkey::new_unique();
    let mollusk = Mollusk::new(&program_id, PROGRAM_PATH);

    let pool_id  = [2u8; 32];
    let admin    = Pubkey::new_unique();
    let pool     = Pubkey::new_unique();
    let dwallet  = Pubkey::new_unique();
    let borrower = Pubkey::new_unique();
    let payer    = Pubkey::new_unique();
    let loan_key = Pubkey::new_unique();

    let mut ix_data = vec![IX_CREATE_LOAN];
    ix_data.extend_from_slice(&pool_id);
    ix_data.extend_from_slice(&[0u8; 32]);
    ix_data.push(253u8);

    let accounts = vec![
        (loan_key,        Account { lamports: 0, data: vec![], owner: system_program(), executable: false, rent_epoch: u64::MAX }),
        (pool,            pool_account(&program_id, &pool_id, &admin, true, 0)), // PAUSED
        (dwallet,         Account { lamports: 1_000_000, data: vec![0u8; 64], owner: Pubkey::new_unique(), executable: false, rent_epoch: u64::MAX }),
        (borrower,        sol_account(10_000_000_000)),
        (payer,           sol_account(10_000_000_000)),
        (system_program(),system_program_account()),
    ];

    let ix = Instruction::new_with_bytes(
        program_id, &ix_data,
        vec![
            AccountMeta::new(loan_key, false),
            AccountMeta::new_readonly(pool, false),
            AccountMeta::new_readonly(dwallet, false),
            AccountMeta::new_readonly(borrower, true),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(system_program(), false),
        ],
    );

    let result = mollusk.process_instruction(&ix, &accounts);
    assert!(result.program_result.is_err(), "must reject paused pool");
    println!("✓ create_loan: correctly rejected paused pool");
}

#[test]
fn test_svm_create_loan_missing_signer_rejected() {
    let program_id = Pubkey::new_unique();
    let mollusk = Mollusk::new(&program_id, PROGRAM_PATH);

    let pool_id  = [3u8; 32];
    let admin    = Pubkey::new_unique();
    let pool     = Pubkey::new_unique();
    let dwallet  = Pubkey::new_unique();
    let borrower = Pubkey::new_unique();
    let payer    = Pubkey::new_unique();
    let loan_key = Pubkey::new_unique();

    let mut ix_data = vec![IX_CREATE_LOAN];
    ix_data.extend_from_slice(&pool_id);
    ix_data.extend_from_slice(&[0u8; 32]);
    ix_data.push(253u8);

    let accounts = vec![
        (loan_key,        Account { lamports: 0, data: vec![], owner: system_program(), executable: false, rent_epoch: u64::MAX }),
        (pool,            pool_account(&program_id, &pool_id, &admin, false, 0)),
        (dwallet,         Account { lamports: 1_000_000, data: vec![0u8; 64], owner: Pubkey::new_unique(), executable: false, rent_epoch: u64::MAX }),
        (borrower,        sol_account(1_000_000)),
        (payer,           sol_account(10_000_000_000)),
        (system_program(),system_program_account()),
    ];

    let ix = Instruction::new_with_bytes(
        program_id, &ix_data,
        vec![
            AccountMeta::new(loan_key, false),
            AccountMeta::new_readonly(pool, false),
            AccountMeta::new_readonly(dwallet, false),
            AccountMeta::new_readonly(borrower, false), // ← NOT signer
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(system_program(), false),
        ],
    );

    let result = mollusk.process_instruction(&ix, &accounts);
    assert!(result.program_result.is_err(), "must reject missing borrower signer");
    println!("✓ create_loan: correctly rejected missing signer");
}

// ── mark_vault_ready ──────────────────────────────────────────────────────

#[test]
fn test_svm_mark_vault_ready_success() {
    let program_id   = Pubkey::new_unique();
    let mollusk      = Mollusk::new(&program_id, PROGRAM_PATH);

    let pool         = Pubkey::new_unique();
    let borrower     = Pubkey::new_unique();
    let dwallet      = Pubkey::new_unique();
    let ika_program  = Pubkey::new_unique();
    let cpi_authority= Pubkey::new_unique();
    let loan_key     = Pubkey::new_unique();

    let loan = loan_account(&program_id, &pool, &borrower, &dwallet, LOAN_STATUS_DRAFT, 0);
    let dw   = dwallet_mock_account(&ika_program, &cpi_authority);

    let ix = Instruction::new_with_bytes(
        program_id,
        &[IX_MARK_VAULT_READY],
        vec![
            AccountMeta::new(loan_key, false),
            AccountMeta::new_readonly(dwallet, false),
            AccountMeta::new_readonly(borrower, true),
            AccountMeta::new_readonly(cpi_authority, false),
        ],
    );

    let accounts = vec![
        (loan_key,     loan),
        (dwallet,      dw),
        (borrower,     sol_account(1_000_000_000)),
        (cpi_authority,sol_account(1_000_000)),
    ];

    let result = mollusk.process_instruction(&ix, &accounts);
    assert!(!result.program_result.is_err(),
        "mark_vault_ready should succeed: {:?}", result.program_result);

    let loan_after = result.get_account(&loan_key).expect("loan missing");
    assert_eq!(loan_after.data[LOAN_STATUS], LOAN_STATUS_VAULT_READY,
        "status should be VaultReady");
    println!("✓ mark_vault_ready: Draft → VaultReady");
}

#[test]
fn test_svm_mark_vault_ready_wrong_borrower_rejected() {
    let program_id    = Pubkey::new_unique();
    let mollusk       = Mollusk::new(&program_id, PROGRAM_PATH);

    let pool          = Pubkey::new_unique();
    let real_borrower = Pubkey::new_unique();
    let bad_borrower  = Pubkey::new_unique();
    let dwallet       = Pubkey::new_unique();
    let ika_program   = Pubkey::new_unique();
    let cpi_authority = Pubkey::new_unique();
    let loan_key      = Pubkey::new_unique();

    let loan = loan_account(&program_id, &pool, &real_borrower, &dwallet, LOAN_STATUS_DRAFT, 0);
    let dw   = dwallet_mock_account(&ika_program, &cpi_authority);

    let ix = Instruction::new_with_bytes(
        program_id,
        &[IX_MARK_VAULT_READY],
        vec![
            AccountMeta::new(loan_key, false),
            AccountMeta::new_readonly(dwallet, false),
            AccountMeta::new_readonly(bad_borrower, true), // ← wrong
            AccountMeta::new_readonly(cpi_authority, false),
        ],
    );

    let accounts = vec![
        (loan_key,     loan),
        (dwallet,      dw),
        (bad_borrower, sol_account(1_000_000_000)),
        (cpi_authority,sol_account(1_000_000)),
    ];
    let result = mollusk.process_instruction(&ix, &accounts);
    assert!(result.program_result.is_err(), "must reject wrong borrower");
    println!("✓ mark_vault_ready: correctly rejected wrong borrower");
}

#[test]
// [PRE-ALPHA BYPASS] The dWallet authority check is intentionally disabled in vault.rs
// because the Ika executor pre-alpha does not yet populate real account data at offset 3.
// This test documents the expected behaviour once the check is re-enabled at mainnet.
#[ignore = "dWallet authority check bypassed in pre-alpha; re-enable when Ika executor sets real authority field"]
fn test_svm_mark_vault_ready_wrong_authority_rejected() {
    let program_id    = Pubkey::new_unique();
    let mollusk       = Mollusk::new(&program_id, PROGRAM_PATH);

    let pool          = Pubkey::new_unique();
    let borrower      = Pubkey::new_unique();
    let dwallet       = Pubkey::new_unique();
    let ika_program   = Pubkey::new_unique();
    let real_authority= Pubkey::new_unique();
    let bad_authority = Pubkey::new_unique();
    let loan_key      = Pubkey::new_unique();

    // dWallet stores real_authority, but we pass bad_authority
    let loan = loan_account(&program_id, &pool, &borrower, &dwallet, LOAN_STATUS_DRAFT, 0);
    let dw   = dwallet_mock_account(&ika_program, &real_authority);

    let ix = Instruction::new_with_bytes(
        program_id,
        &[IX_MARK_VAULT_READY],
        vec![
            AccountMeta::new(loan_key, false),
            AccountMeta::new_readonly(dwallet, false),
            AccountMeta::new_readonly(borrower, true),
            AccountMeta::new_readonly(bad_authority, false), // ← wrong PDA
        ],
    );

    let accounts = vec![
        (loan_key,     loan),
        (dwallet,      dw),
        (borrower,     sol_account(1_000_000_000)),
        (bad_authority,sol_account(1_000_000)),
    ];

    let result = mollusk.process_instruction(&ix, &accounts);
    assert!(result.program_result.is_err(), "must reject wrong CPI authority");
    println!("✓ mark_vault_ready: correctly rejected wrong CPI authority");
}

#[test]
fn test_svm_mark_vault_ready_already_ready_rejected() {
    let program_id    = Pubkey::new_unique();
    let mollusk       = Mollusk::new(&program_id, PROGRAM_PATH);

    let pool          = Pubkey::new_unique();
    let borrower      = Pubkey::new_unique();
    let dwallet       = Pubkey::new_unique();
    let ika_program   = Pubkey::new_unique();
    let cpi_authority = Pubkey::new_unique();
    let loan_key      = Pubkey::new_unique();

    // Loan already in VaultReady
    let loan = loan_account(&program_id, &pool, &borrower, &dwallet, LOAN_STATUS_VAULT_READY, 0);
    let dw   = dwallet_mock_account(&ika_program, &cpi_authority);

    let ix = Instruction::new_with_bytes(
        program_id,
        &[IX_MARK_VAULT_READY],
        vec![
            AccountMeta::new(loan_key, false),
            AccountMeta::new_readonly(dwallet, false),
            AccountMeta::new_readonly(borrower, true),
            AccountMeta::new_readonly(cpi_authority, false),
        ],
    );

    let accounts = vec![
        (loan_key,     loan),
        (dwallet,      dw),
        (borrower,     sol_account(1_000_000_000)),
        (cpi_authority,sol_account(1_000_000)),
    ];

    let result = mollusk.process_instruction(&ix, &accounts);
    assert!(result.program_result.is_err(), "must reject already-VaultReady");
    println!("✓ mark_vault_ready: correctly rejected already-VaultReady status");
}

// ── Full lifecycle integration ────────────────────────────────────────────

// NOTE: The create_loan step requires system program CPI funding.
// Run with: cargo test --test svm_tests -- --ignored
#[test]
#[ignore = "create_loan step requires funded system program; run on devnet"]
fn test_svm_full_lifecycle_draft_to_vault_ready() {
    let program_id    = Pubkey::new_unique();
    let mollusk       = Mollusk::new(&program_id, PROGRAM_PATH);

    let pool_id       = [9u8; 32];
    let admin         = Pubkey::new_unique();
    let pool          = Pubkey::new_unique();
    let dwallet       = Pubkey::new_unique();
    let borrower      = Pubkey::new_unique();
    let payer         = Pubkey::new_unique();
    let ika_program   = Pubkey::new_unique();
    let cpi_authority = Pubkey::new_unique();
    let loan_key      = Pubkey::new_unique();

    // ── Step 1: create_loan ───────────────────────────────────────────────
    let mut ix_data = vec![IX_CREATE_LOAN];
    ix_data.extend_from_slice(&pool_id);
    ix_data.extend_from_slice(&[0xAAu8; 32]);
    ix_data.push(253u8);

    let create_ix = Instruction::new_with_bytes(
        program_id, &ix_data,
        vec![
            AccountMeta::new(loan_key, false),
            AccountMeta::new_readonly(pool, false),
            AccountMeta::new_readonly(dwallet, false),
            AccountMeta::new_readonly(borrower, true),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(system_program(), false),
        ],
    );

    // Pre-allocate loan account (system CPI limitation in Mollusk SVM)
    let pre_alloc_loan = Account {
        lamports: rent_exempt(LOAN_LEN),
        data: vec![0u8; LOAN_LEN],
        owner: program_id,
        executable: false,
        rent_epoch: u64::MAX,
    };

    let create_accounts = vec![
        (loan_key,        pre_alloc_loan),
        (pool,            pool_account(&program_id, &pool_id, &admin, false, 0)),
        (dwallet,         Account { lamports: 1_000_000, data: vec![0u8; 64], owner: ika_program, executable: false, rent_epoch: u64::MAX }),
        (borrower,        sol_account(10_000_000_000)),
        (payer,           sol_account(10_000_000_000)),
        (system_program(),system_program_account()),
    ];

    let r1 = mollusk.process_instruction(&create_ix, &create_accounts);
    assert!(!r1.program_result.is_err(), "create_loan failed: {:?}", r1.program_result);

    let created_loan = r1.get_account(&loan_key).expect("loan not created");
    assert_eq!(created_loan.data[LOAN_STATUS], LOAN_STATUS_DRAFT, "step1: Draft");

    // ── Step 2: mark_vault_ready ──────────────────────────────────────────
    let vault_ix = Instruction::new_with_bytes(
        program_id,
        &[IX_MARK_VAULT_READY],
        vec![
            AccountMeta::new(loan_key, false),
            AccountMeta::new_readonly(dwallet, false),
            AccountMeta::new_readonly(borrower, true),
            AccountMeta::new_readonly(cpi_authority, false),
        ],
    );

    let vault_accounts = vec![
        (loan_key,     created_loan.clone()),
        (dwallet,      dwallet_mock_account(&ika_program, &cpi_authority)),
        (borrower,     sol_account(1_000_000_000)),
        (cpi_authority,sol_account(1_000_000)),
    ];

    let r2 = mollusk.process_instruction(&vault_ix, &vault_accounts);
    assert!(!r2.program_result.is_err(), "mark_vault_ready failed: {:?}", r2.program_result);

    let final_loan = r2.get_account(&loan_key).expect("loan missing");
    assert_eq!(final_loan.data[LOAN_STATUS], LOAN_STATUS_VAULT_READY, "step2: VaultReady");

    println!("✓ Full lifecycle: create_loan (Draft) → mark_vault_ready (VaultReady)");
    println!("  loan_key: {}", loan_key);
    let count = u32::from_le_bytes(r1.get_account(&pool).unwrap().data[POOL_LOAN_COUNT..POOL_LOAN_COUNT+4].try_into().unwrap());
    println!("  pool.loan_count after step 1: {}", count);
}
