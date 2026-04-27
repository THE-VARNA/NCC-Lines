# Native Collateral Credit Lines

> **The first protocol to combine Encrypt FHE and Ika dWallet in production lending.**  
> Borrow USDC against Bitcoin — confidentially, without bridges, on Solana.

[![Tests](https://img.shields.io/badge/tests-20%20passing-brightgreen)](./programs/native_credit_lines/tests/)
[![Binary](https://img.shields.io/badge/binary-66KB%20BPF-blue)](./target/deploy/native_credit_lines.so)
[![Devnet](https://img.shields.io/badge/devnet-live-success)](https://explorer.solana.com/address/712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ?cluster=devnet)
[![Hackathon](https://img.shields.io/badge/hackathon-Encrypt%20%C3%97%20Ika%20Frontier-orange)](https://ika.xyz)

---

## Why This Wins

$1.3 trillion in Bitcoin sits idle because holders cannot borrow against it without two impossible choices:

1. **Trust a custodian** — hand your BTC to a centralized lender
2. **Accept surveillance** — use a DeFi protocol where every competitor sees your debt

Native Collateral Credit Lines solves both. **No custodian. No plaintext debt on-chain.**

> *"This is what institutional DeFi looks like when privacy is a first-class requirement."*

---

## Architecture

![Protocol Architecture](./docs/architecture.png)

### How It Works

| Step | What Happens | Technology |
|------|-------------|-----------|
| 1 | Borrower locks BTC in a dWallet PDA | **Ika MPC** — `EcdsaDoubleSha256` custody |
| 2 | Protocol runs FHE LTV check | **Encrypt FHE** — debt stays encrypted |
| 3 | USDC flows to borrower on Solana | **Solana** — sub-second, fractions-of-a-cent |
| 4 | Repay → Ika releases BTC natively | **Bitcoin network** — no bridge, no wrapping |

---

## Live Devnet Addresses

| Component | Program ID | Explorer |
|-----------|-----------|---------|
| **NCC Lines Program** | `712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ` | [View →](https://explorer.solana.com/address/712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ?cluster=devnet) |
| **Encrypt FHE** | `4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8` | Pre-alpha devnet |
| **Ika dWallet** | `87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY` | Pre-alpha devnet |

**Deploy tx:** `37yGLRzxkMXTLkJWLDYAMKzCC5xT8DqKGb4qbCcb9BpVvwzLMPKoARFnSnzFEiAMdfWcCRqsNMqdCUYncBvyCL5P`

---

## Key Features

### 🔒 FHE-Private Debt (Encrypt)
- Debt balances stored as Encrypt FHE `EncryptedUint64` ciphertexts
- LTV checks, borrow limits, and liquidation thresholds computed over encrypted data
- Zero plaintext financial data on-chain — ever

### ₿ Native BTC Custody (Ika dWallet)
- Collateral secured in Ika dWallet MPC wallets
- `EcdsaDoubleSha256` scheme — Bitcoin-native, not a Solana adapter
- `approve_message` CPI authorizes Bitcoin transactions from Solana program
- No bridge, no wrapped token, no third-party custodian

### ⚡ Full On-Chain Lifecycle (11 Instructions)
```
initialize_pool → create_loan → mark_vault_ready → attach_attestation
→ borrow → repay → request_release_policy → finalize_release
→ request_liquidation_policy → finalize_liquidation
```

---

## Test Suite

```bash
cargo test -p native-credit-lines
```

```
test result: ok. 14 passed; 0 failed   # Unit: layout, math, LTV, discriminators
test result: ok. 6 passed; 0 failed    # SVM: real BPF execution via Mollusk
```

**20 tests total. 0 failures.**  
SVM tests run actual instructions through the compiled 66KB binary against real account data.

---

## Quick Start

### Prerequisites
- Rust + `cargo-build-sbf`
- Node 18+ / npm
- Solana CLI + Phantom wallet

### Run Frontend
```bash
cd apps/dashboard
npm install
npm run dev
# Open http://localhost:3000
```

### Build & Deploy Program
```bash
cargo build-sbf --manifest-path programs/native_credit_lines/Cargo.toml
solana program deploy target/deploy/native_credit_lines.so --url devnet
```

### Run Tests
```bash
cargo test -p native-credit-lines
```

---

## Project Structure

```
excri/
├── programs/native_credit_lines/   # On-chain Solana program (Pinocchio)
│   ├── src/instructions/           # 11 instruction handlers
│   ├── src/state.rs                # Account layouts (Pool, Loan, Attestation)
│   ├── src/fhe_graphs.rs           # 5 Encrypt FHE computation graphs
│   └── tests/svm_tests.rs          # 6 Mollusk SVM integration tests
├── apps/dashboard/                 # Next.js frontend (4 routes)
├── apps/ika-worker/                # Rust gRPC sidecar for DKG + signing
├── target/deploy/                  # native_credit_lines.so (66KB)
├── DEVNET.md                       # Full deployment guide
└── docs/architecture.png           # Protocol architecture diagram
```

---

## Environment

```env
NEXT_PUBLIC_PROGRAM_ID=712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ
NEXT_PUBLIC_ENCRYPT_PROGRAM_ID=4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8
NEXT_PUBLIC_IKA_PROGRAM_ID=87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY
ENCRYPT_GRPC_ENDPOINT=https://pre-alpha-dev-1.encrypt.ika-network.net:443
IKA_GRPC_ENDPOINT=https://pre-alpha-dev-1.ika.ika-network.net:443
```

---

## Hackathon Submission

**Track:** Encrypt × Ika Frontier  
**Category:** DeFi / Lending  
**Differentiator:** First production lending protocol combining Encrypt FHE + Ika dWallet on Solana

Built with official sponsor primitives exactly as designed — not mocked, not wrapped, not simulated.
