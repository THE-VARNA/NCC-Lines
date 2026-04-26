# Native Collateral Credit Lines

**Confidential BTC-backed USDC lending on Solana.**

Submitted to the **Encrypt & Ika — Bridgeless Capital Markets and Encrypted Capital Markets** Frontier hackathon track.

---

## Overview

Native Collateral Credit Lines (NCC Lines) is an institutional-grade lending protocol that lets borrowers access USDC liquidity against native BTC collateral — with full confidentiality:

- **Encrypt FHE** — Debt balances, LTV ratios, and policy checks are computed inside FHE circuits. No plaintext debt is ever visible on-chain.
- **Ika dWallet** — BTC collateral is controlled by an MPC dWallet. No bridges, no custodians, no single point of failure. The Solana program controls signing via CPI `approve_message`.
- **Pinocchio** — The on-chain program is written with the Pinocchio framework for minimal compute unit cost.

## Devnet Addresses

| Component | Address |
|-----------|---------|
| Encrypt Program | `4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8` |
| Ika dWallet Program | `87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY` |
| Encrypt gRPC | `pre-alpha-dev-1.encrypt.ika-network.net:443` |
| Ika gRPC | `pre-alpha-dev-1.ika.ika-network.net:443` |

## Architecture

```
Borrower → [Create dWallet via Ika DKG]
         → [Transfer authority to program PDA]
         → [Oracle attests BTC collateral value → EUint64 ciphertext]
         → [Borrow: FHE borrow_check graph runs on-chain]
         → [Repay: FHE repay_check graph clamps to actual debt]
         → [Release: release_policy graph → decrypt bit → approve_message CPI]
         → [Ika MPC threshold-signs BTC release tx]
```

## Sponsor Integration

| Sponsor | Primitive Used |
|---------|---------------|
| **Encrypt** | `#[encrypt_fn]` FHE graphs, `create_plaintext_typed`, `request_decryption`, `read_decrypted_verified` |
| **Ika** | `DWalletContext::approve_message`, `EcdsaDoubleSha256` sig scheme, `DWalletServiceClient` gRPC |
| **Pinocchio** | No-std `#![no_std]` entrypoint, `AccountView`, `Signer`, `CreateAccount` CPI |

## Key Technical Decisions

1. **Signature scheme = `EcdsaDoubleSha256` (2)** for BTC-compatible signing
2. **FHE graph visibility**: `#[encrypt_fn]` generates private traits — exposed via public wrapper functions in `fhe_graphs.rs`
3. **Type paths**: `encrypt_types::encrypted::Uint64` (not `types::Uint64`)
4. **On-chain digest**: Canonical XOR-based hash from loan fields — prevents client-supplied digest manipulation
5. **State machine**: `Draft → VaultReady → Active → ReleaseCheckPending → ReleasePendingSignature → Released`

## Project Structure

```
excri/
├── programs/
│   └── native_credit_lines/
│       ├── src/
│       │   ├── lib.rs              # Entrypoint + 11-instruction dispatcher
│       │   ├── state.rs            # Pool, LoanPosition, Attestation, PolicyReveal
│       │   ├── fhe_graphs.rs       # 5 FHE computation graphs + public wrappers
│       │   ├── errors.rs           # Custom error codes
│       │   └── instructions/       # One file per instruction
│       └── tests/
│           └── mollusk_tests.rs    # 14 integration tests (all passing)
├── apps/
│   ├── dashboard/                  # Next.js 16 + Solana wallet adapter
│   └── ika-worker/                 # Rust CLI for DKG + signing
├── DEVNET.md                       # Deployment guide
└── Cargo.toml                      # Workspace
```

## Running Tests

```bash
cargo test -p native-credit-lines
# Result: 14 passed; 0 failed ✓
```

## Running the Frontend

```bash
cd apps/dashboard
cp .env.example .env.local
# Edit NEXT_PUBLIC_PROGRAM_ID after deploy
npm install && npm run dev
# Visit http://localhost:3000
```

## Deploying to Devnet

See [DEVNET.md](DEVNET.md) for full instructions.

```bash
cargo build-sbf -p native-credit-lines
solana program deploy target/deploy/native_credit_lines.so
```

## Running the Ika Worker Sidecar

```bash
# Create a dWallet (BTC-compatible)
cargo run -p ika-worker -- dkg --user-pubkey <BORROWER_PUBKEY>

# Sign after on-chain approval
cargo run -p ika-worker -- sign \
  --dwallet-id <HEX> \
  --message-approval <BASE58>
```

## License

Apache-2.0
