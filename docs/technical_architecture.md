# Technical Architecture — NCC Lines

## System Overview

NCC Lines is a confidential Bitcoin credit line protocol on Solana, integrating two pre-alpha sponsor protocols: **Encrypt FHE** and **Ika dWallet**. The architecture has three distinct layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: USER INTERFACE                                        │
│  Next.js Dashboard · Phantom Wallet · Framer Motion UI          │
└────────────────────────┬────────────────────────────────────────┘
                         │ user clicks "Attest"
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: GRPC BRIDGES (Next.js API Routes — Server-Side)       │
│                                                                  │
│  /api/encrypt/create-input  →  Encrypt gRPC executor            │
│    POST { value, fheType=4(EUint64), authorized, networkKey }   │
│    Returns: { ciphertextIdentifier: "05d829f2..." }             │
│                                                                  │
│  /api/ika/create-dwallet    →  Ika gRPC executor                │
│    POST { payerPubkey }                                          │
│    BCS: SignedRequestData { DKG { curve: Curve25519, ... } }    │
│    Returns: { dwalletPda: "...", publicKey: "hex" }             │
└────────────────────────┬────────────────────────────────────────┘
                         │ transactions signed by user
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: SOLANA DEVNET                                          │
│                                                                  │
│  NCC Program (712fUCmQ...)                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Pool PDA              │  LoanPosition PDA              │    │
│  │  • admin               │  • borrower                    │    │
│  │  • loan_count          │  • dwallet_pda                 │    │
│  │  • paused flag         │  • collateral_value_ct         │    │
│  │                        │  • debt_ct                     │    │
│  │                        │  • status (state machine)      │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  AttestationRecord PDA                                  │    │
│  │  • ciphertext accounts initialized                      │    │
│  │  • bound to loan PDA                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Encrypt Program (4ebfzWdK...)                                   │
│  ┌───────────────────────────────────┐                          │
│  │  CiphertextAccount               │                          │
│  │  • disc=1, version=1             │                          │
│  │  • ciphertext_digest [32]        │                          │
│  │  • authorized = NCC_PROGRAM_ID   │                          │
│  │  • fhe_type = 4 (EUint64)        │                          │
│  │  • status = verified             │                          │
│  └───────────────────────────────────┘                          │
│                                                                  │
│  Ika Program (87W54kGY...)                                       │
│  ┌───────────────────────────────────┐                          │
│  │  dWallet PDA                     │                          │
│  │  • curve = Curve25519            │                          │
│  │  • public_key [32]               │                          │
│  │  • attested by Ika network       │                          │
│  └───────────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Encrypt FHE Integration

### Protocol Choice: gRPC `createInput` over on-chain CPI

The Encrypt pre-alpha SDK provides two paths for creating ciphertext inputs:
1. **`create_plaintext_typed` CPI** — requires an initialized `event_authority` PDA on-chain (deployed by executor team, not yet available on public devnet)
2. **`createInput` gRPC** — executor-driven, no `event_authority` PDA required

We use path 2. The gRPC endpoint (`/encrypt.v1.EncryptService/CreateInput`) accepts:

```protobuf
message CreateInputRequest {
  Chain chain = 1;                    // SOLANA = 0
  repeated EncryptedInput inputs = 2; // [{ctBytes: 16-byte-LE, fheType: 4}]
  bytes proof = 3;                    // empty in dev mode
  bytes authorized = 4;              // NCC program pubkey (32 bytes)
  bytes network_encryption_public_key = 5; // from EncryptConfig on-chain
}
```

The 16-byte ciphertext bytes are little-endian encoded. In pre-alpha, these are stored as plaintext. Real homomorphic encryption applies at mainnet.

### FHE Type Usage

We use `fhe_type = 4` which corresponds to `EUint64` — a 64-bit unsigned integer. This is appropriate for dollar amounts in cents (up to ~$1.8 × 10¹⁰, well above any realistic collateral).

### CiphertextAccount Layout (Encrypt SDK)

```
Offset   Field                 Size
0        discriminator (1)      1
1        version (1)            1
2..34    ciphertext_digest     32
34..66   authorized            32  ← NCC_PROGRAM_ID
66..98   network_enc_key       32
98       fhe_type               1  ← 4 (EUint64)
99       status                 1  ← 1 (verified)
Total:                        100
```

---

## Ika dWallet Integration

### DKG Flow

The Distributed Key Generation creates an MPC keypair where:
- User holds an encrypted secret share
- Ika network holds complementary shares
- Neither party can unilaterally sign — 2PC-MPC required

```typescript
// BCS-serialized request to /ika.dwallet.v1.DWalletService/SubmitTransaction
SignedRequestData {
  session_identifier_preimage: [0u8; 32],  // unique per session
  epoch: 1,
  chain_id: Solana,
  intended_chain_sender: payerPublicKey,
  request: DKG {
    curve: Curve25519,
    user_secret_key_share: Encrypted {
      encrypted_centralized_secret_share_and_proof: [...],
      signer_public_key: payerPublicKey,
    }
  }
}
```

Response: `VersionedDWalletDataAttestation::V1` containing:
- `public_key` [32 bytes] — the dWallet's Curve25519 public key
- `public_output` [32 bytes] — DKG proof
- `attestation_data` + `network_signature` — Ika network attestation

### dWallet PDA Derivation

```
seeds = ["dwallet", curve_byte || public_key]
program = IKA_PROGRAM_ID (87W54kGY...)
```

This PDA is the on-chain address that controls the Bitcoin vault.

---

## State Machine

```
                 create_loan()
                      │
                      ▼
               ┌─────────────┐
               │    Draft    │
               └──────┬──────┘
          mark_vault_ready()
                      │
                      ▼
               ┌─────────────┐
               │ VaultReady  │
               └──────┬──────┘
         attach_attestation()
                      │
                      ▼
               ┌─────────────┐
               │   Active    │◄────────────────────────────┐
               └──────┬──────┘                             │
                      │                                    │
         ┌────────────┴─────────────┐                     │
         ▼                          ▼                     │
  initiate_release()         initiate_liquidation()       │
         │                          │                     │
         ▼                          ▼                     │
  ┌─────────────────┐   ┌─────────────────────────┐      │
  │ ReleaseCheck    │   │  LiquidationCheck       │      │
  │ Pending         │   │  Pending                │      │
  └────────┬────────┘   └───────────┬─────────────┘      │
           │                        │                     │
   (Encrypt decrypt)        (Encrypt decrypt)             │
           │                        │                     │
           ▼                        ▼                     │
  ┌─────────────────┐   ┌─────────────────────────┐      │
  │ ReleasePending  │   │  LiquidationPending     │      │
  │ Signature       │   │  Signature              │      │
  └────────┬────────┘   └───────────┬─────────────┘      │
           │                        │                     │
    (Ika sign)                (Ika sign)                  │
           │                        │                     │
           ▼                        ▼                     │
    ┌──────────┐            ┌────────────┐                │
    │ Released │            │ Liquidated │                │
    └──────────┘            └────────────┘                │
```

---

## Security Model

| Threat | Mitigation |
|--------|-----------|
| Front-running liquidations | Debt and collateral values are ciphertexts — bots can't see LTV |
| Unauthorized BTC withdrawal | Requires Ika 2PC-MPC signature — neither party has full key |
| Bridge risk | No wrapping — BTC is native at Ika dWallet address |
| Admin rug | Pool admin only sets parameters; can't touch user collateral |

---

## Known Pre-Alpha Limitations

1. **No real FHE**: Encrypt stores data as plaintext in pre-alpha. Homomorphic computation at mainnet.
2. **Mock MPC**: Ika uses a single signer in pre-alpha. Distributed MPC at mainnet.
3. **event_authority PDA**: Direct Encrypt CPI bypassed via gRPC — will be re-enabled when executor initializes PDA on devnet.
4. **USDC disbursement**: Step 4 uses a pre-funded pool; production uses liquidity provider deposits.
