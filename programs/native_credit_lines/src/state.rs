// Copyright (c) 2026 Native Collateral Credit Lines
// State account layouts for the lending protocol.
//
// All accounts use a 2-byte prefix: discriminator(1) | version(1),
// matching the Encrypt/Ika convention.

use pinocchio::error::ProgramError;

// ── Discriminators ──

pub const DISC_POOL: u8 = 1;
pub const DISC_LOAN_POSITION: u8 = 2;
pub const DISC_COLLATERAL_ATTESTATION: u8 = 3;
pub const DISC_POLICY_REVEAL: u8 = 4;

pub const ACCOUNT_VERSION: u8 = 1;

// ── Loan Status ──

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LoanStatus {
    Draft = 0,
    VaultReady = 1,
    Active = 2,
    ReleaseCheckPending = 3,
    ReleasePendingSignature = 4,
    Released = 5,
    LiquidationCheckPending = 6,
    LiquidationPendingSignature = 7,
    Liquidated = 8,
    Frozen = 9,
}

impl LoanStatus {
    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(Self::Draft),
            1 => Some(Self::VaultReady),
            2 => Some(Self::Active),
            3 => Some(Self::ReleaseCheckPending),
            4 => Some(Self::ReleasePendingSignature),
            5 => Some(Self::Released),
            6 => Some(Self::LiquidationCheckPending),
            7 => Some(Self::LiquidationPendingSignature),
            8 => Some(Self::Liquidated),
            9 => Some(Self::Frozen),
            _ => None,
        }
    }
}

// ── Policy Reveal Status ──

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum PolicyRevealStatus {
    None = 0,
    DecryptionRequested = 1,
    VerifiedEligible = 2,
    VerifiedIneligible = 3,
    MessageApproved = 4,
    Expired = 5,
}

impl PolicyRevealStatus {
    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(Self::None),
            1 => Some(Self::DecryptionRequested),
            2 => Some(Self::VerifiedEligible),
            3 => Some(Self::VerifiedIneligible),
            4 => Some(Self::MessageApproved),
            5 => Some(Self::Expired),
            _ => None,
        }
    }
}

// ════════════════════════════════════════════════════════════
// Pool Account — program-wide liquidity pool
// PDA seeds: ["pool", pool_id]
// ════════════════════════════════════════════════════════════
//
// Layout (after 2-byte prefix):
//   pool_id:              [u8; 32]  @ 2
//   admin:                [u8; 32]  @ 34
//   total_debt_ct:        [u8; 32]  @ 66   -- Encrypt ciphertext pubkey (EUint64)
//   pool_liquidity_ct:    [u8; 32]  @ 98   -- Encrypt ciphertext pubkey (EUint64)
//   asset:                u8        @ 130  -- ASSET_BTC = 1
//   paused:               u8        @ 131  -- 0 = active, 1 = paused
//   loan_count:           u32 LE    @ 132
//   bump:                 u8        @ 136
//   _reserved:            [u8; 16]  @ 137
//   Total: 2 + 151 = 153 bytes

pub const POOL_LEN: usize = 153;
pub const POOL_POOL_ID: usize = 2;
pub const POOL_ADMIN: usize = 34;
pub const POOL_TOTAL_DEBT_CT: usize = 66;
pub const POOL_LIQUIDITY_CT: usize = 98;
pub const POOL_ASSET: usize = 130;
pub const POOL_PAUSED: usize = 131;
pub const POOL_LOAN_COUNT: usize = 132;
pub const POOL_BUMP: usize = 136;

// ════════════════════════════════════════════════════════════
// Loan Position Account
// PDA seeds: ["loan", pool_id, loan_index_le_bytes]
// ════════════════════════════════════════════════════════════
//
// Layout (after 2-byte prefix):
//   pool:                 [u8; 32]  @ 2    -- Pool PDA pubkey
//   borrower:             [u8; 32]  @ 34   -- Borrower wallet
//   dwallet:              [u8; 32]  @ 66   -- dWallet account pubkey
//   dwallet_pubkey:       [u8; 32]  @ 98   -- dWallet's compressed secp256k1 public key
//   debt_ct:              [u8; 32]  @ 130  -- Encrypt ciphertext (EUint64, USD cents)
//   collateral_value_ct:  [u8; 32]  @ 162  -- Encrypt ciphertext (EUint64, USD cents)
//   attestation:          [u8; 32]  @ 194  -- CollateralAttestation PDA pubkey
//   policy_reveal:        [u8; 32]  @ 226  -- latest PolicyReveal PDA pubkey (or zero)
//   message_approval:     [u8; 32]  @ 258  -- latest MessageApproval PDA pubkey (or zero)
//   loan_index:           u32 LE    @ 290
//   asset:                u8        @ 294
//   status:               u8        @ 295
//   nonce:                u32 LE    @ 296  -- replay protection counter
//   bump:                 u8        @ 300
//   _reserved:            [u8; 16]  @ 301
//   Total: 2 + 315 = 317 bytes

pub const LOAN_LEN: usize = 317;
pub const LOAN_POOL: usize = 2;
pub const LOAN_BORROWER: usize = 34;
pub const LOAN_DWALLET: usize = 66;
pub const LOAN_DWALLET_PUBKEY: usize = 98;
pub const LOAN_DEBT_CT: usize = 130;
pub const LOAN_COLLATERAL_VALUE_CT: usize = 162;
pub const LOAN_ATTESTATION: usize = 194;
pub const LOAN_POLICY_REVEAL: usize = 226;
pub const LOAN_MSG_APPROVAL: usize = 258;
pub const LOAN_INDEX: usize = 290;
pub const LOAN_ASSET: usize = 294;
pub const LOAN_STATUS: usize = 295;
pub const LOAN_NONCE: usize = 296;
pub const LOAN_BUMP: usize = 300;

// ════════════════════════════════════════════════════════════
// Collateral Attestation Account
// PDA seeds: ["attestation", loan_pda]
// ════════════════════════════════════════════════════════════
//
// Layout (after 2-byte prefix):
//   loan:                 [u8; 32]  @ 2    -- Loan PDA pubkey
//   issuer:               [u8; 32]  @ 34   -- Attestation issuer pubkey (must be signer)
//   attestation_hash:     [u8; 32]  @ 66   -- SHA256 hash of attestation data
//   collateral_value_usd_cents: u64 LE @ 98 -- plaintext value (for demo)
//   timestamp:            i64 LE    @ 106  -- unix timestamp
//   expiry:               i64 LE    @ 114  -- expiry timestamp
//   bump:                 u8        @ 122
//   _reserved:            [u8; 8]   @ 123
//   Total: 2 + 129 = 131 bytes

pub const ATTESTATION_LEN: usize = 131;
pub const ATT_LOAN: usize = 2;
pub const ATT_ISSUER: usize = 34;
pub const ATT_HASH: usize = 66;
pub const ATT_COLLATERAL_VALUE: usize = 98;
pub const ATT_TIMESTAMP: usize = 106;
pub const ATT_EXPIRY: usize = 114;
pub const ATT_BUMP: usize = 122;

// ════════════════════════════════════════════════════════════
// Policy Reveal Account
// PDA seeds: ["policy", loan_pda, &nonce_le_bytes]
// ════════════════════════════════════════════════════════════
//
// Layout (after 2-byte prefix):
//   loan:                 [u8; 32]  @ 2    -- Loan PDA pubkey
//   action:               u8        @ 34   -- POLICY_RELEASE=1, POLICY_LIQUIDATION=2
//   policy_ct:            [u8; 32]  @ 35   -- Encrypt ciphertext of the policy bit (EUint64)
//   decryption_request:   [u8; 32]  @ 67   -- DecryptionRequest account pubkey
//   pending_digest:       [u8; 32]  @ 99   -- digest snapshot for verified read
//   status:               u8        @ 131  -- PolicyRevealStatus
//   nonce:                u32 LE    @ 132  -- replay nonce
//   bump:                 u8        @ 136
//   _reserved:            [u8; 8]   @ 137
//   Total: 2 + 143 = 145 bytes

pub const POLICY_LEN: usize = 145;
pub const POL_LOAN: usize = 2;
pub const POL_ACTION: usize = 34;
pub const POL_POLICY_CT: usize = 35;
pub const POL_DECRYPTION_REQ: usize = 67;
pub const POL_PENDING_DIGEST: usize = 99;
pub const POL_STATUS: usize = 131;
pub const POL_NONCE: usize = 132;
pub const POL_BUMP: usize = 136;

// ── Byte helpers ──

#[inline(always)]
pub fn read_u32(data: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(
        data[offset..offset + 4]
            .try_into()
            .unwrap_or([0u8; 4]),
    )
}

#[inline(always)]
pub fn read_u64(data: &[u8], offset: usize) -> u64 {
    u64::from_le_bytes(
        data[offset..offset + 8]
            .try_into()
            .unwrap_or([0u8; 8]),
    )
}

#[inline(always)]
pub fn read_i64(data: &[u8], offset: usize) -> i64 {
    i64::from_le_bytes(
        data[offset..offset + 8]
            .try_into()
            .unwrap_or([0u8; 8]),
    )
}

#[inline(always)]
pub fn read_u16(data: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes(
        data[offset..offset + 2]
            .try_into()
            .unwrap_or([0u8; 2]),
    )
}

#[inline(always)]
pub fn write_u32(data: &mut [u8], offset: usize, value: u32) {
    data[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
}

#[inline(always)]
pub fn write_u64(data: &mut [u8], offset: usize, value: u64) {
    data[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
}

#[inline(always)]
pub fn write_i64(data: &mut [u8], offset: usize, value: i64) {
    data[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
}

/// Minimum rent-exempt balance (same formula as Ika/Encrypt programs).
#[inline(always)]
pub fn minimum_balance(data_len: usize) -> u64 {
    (data_len as u64 + 128) * 6960
}

/// Read a 32-byte slice from data at offset.
#[inline(always)]
pub fn read_pubkey(data: &[u8], offset: usize) -> [u8; 32] {
    let mut buf = [0u8; 32];
    buf.copy_from_slice(&data[offset..offset + 32]);
    buf
}

/// Check if a 32-byte slice is all zeros.
#[inline(always)]
pub fn is_zero_pubkey(data: &[u8; 32]) -> bool {
    data.iter().all(|&b| b == 0)
}

/// Validate account discriminator and minimum length.
pub fn validate_account(data: &[u8], expected_disc: u8, min_len: usize) -> Result<(), ProgramError> {
    if data.len() < min_len {
        return Err(ProgramError::InvalidAccountData);
    }
    if data[0] != expected_disc {
        return Err(ProgramError::InvalidAccountData);
    }
    Ok(())
}
