use pinocchio::error::ProgramError;

/// Custom error codes for the native credit lines program
#[repr(u32)]
pub enum CreditLineError {
    WalletNotConnected = 0,
    WrongNetwork = 1,
    EncryptDepositMissing = 2,
    IkaGasDepositMissing = 3,
    CiphertextPendingTimeout = 4,
    CiphertextTypeMismatch = 5,
    DecryptionPendingTimeout = 6,
    DecryptionDigestMismatch = 7,
    PolicyIneligible = 8,
    DWalletNotActive = 9,
    DWalletAuthorityInvalid = 10,
    InvalidAttestation = 11,
    LoanNotActive = 12,
    PoolPaused = 13,
    ReplayNonce = 14,
    MessageApprovalPendingTimeout = 15,
    InvalidAsset = 16,
    InvalidLoanStatus = 17,
    AttestationExpired = 18,
    InvalidIssuer = 19,
}

impl From<CreditLineError> for ProgramError {
    fn from(e: CreditLineError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
