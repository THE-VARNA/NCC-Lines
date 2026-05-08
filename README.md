# NCC Lines — Confidential Bitcoin Credit Lines

> **Hackathon Submission** · Encrypt × Ika Frontier April 2026 · Superteam

Borrow USDC against native Bitcoin with **FHE-encrypted LTV checks** (Encrypt) and **MPC-secured custody** (Ika dWallet). No bridges. No custodians. No data leaks.

---

## The Problem & Our Solution

### The Problem

Traditional DeFi lending has two critical flaws:

1. **Privacy**: LTV ratios, debt positions, and collateral values are fully public on-chain. Liquidation bots front-run positions, MEV extracts value, and competitors can see your exposure.
2. **Native BTC**: Borrowing against Bitcoin requires wrapping (wBTC, cbBTC) — introducing bridge risk, custodian risk, and peg risk. Users don't actually control their BTC.

### Our Solution — NCC Lines

NCC Lines solves both with a two-layer privacy architecture:

| Layer | Technology | What It Does |
|-------|-----------|--------------|
| **Encrypted Computation** | **Encrypt FHE** (pre-alpha) | Encrypts collateral and debt values as on-chain ciphertexts. LTV checks run on encrypted data — the program never sees plaintext amounts. |
| **Native BTC Custody** | **Ika dWallet** (pre-alpha) | Creates an MPC wallet derived from the user's Solana key. BTC is held at a real Bitcoin address controlled by a distributed key — no wrapping, no bridge. |

The result: a credit line where **your debt is private**, **your BTC is native**, and **the program enforces rules without ever seeing values**.

---

## Target Users & Use Cases

| User | Use Case |
|------|----------|
| **Bitcoin HODLers** | Access liquidity without selling BTC. Borrow USDC for expenses, DeFi, or trading. |
| **Institutions** | Private lending positions. Competitors can't see collateral ratios or debt exposure. |
| **Privacy-First DeFi** | Users who want protocol-enforced privacy rather than trusting a centralized lender. |
| **BTC Maximalists** | First-class native BTC use — no wrapped tokens, no bridges. |

---

## Architecture

```
User (Phantom Wallet)
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              NCC Lines Dashboard (Next.js)           │
│  • Step 1: Ika DKG → dWallet PDA (gRPC executor)   │
│  • Step 2: Fund BTC vault (Ika-managed address)     │
│  • Step 3: Encrypt createInput (gRPC executor)      │
│            → ciphertext identifier returned         │
│  • Step 4: attach_attestation (on-chain CPI)        │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
               ▼                  ▼
   ┌──────────────────┐  ┌─────────────────────────┐
   │  Ika dWallet     │  │  Encrypt FHE Executor   │
   │  (gRPC DKG)      │  │  (gRPC createInput)     │
   │  pre-alpha-dev-1 │  │  pre-alpha-dev-1        │
   │  .ika-network    │  │  .encrypt.ika-network   │
   └────────┬─────────┘  └───────────┬─────────────┘
            │                        │
            ▼                        ▼
   ┌─────────────────────────────────────────────────┐
   │           Solana Devnet On-Chain                │
   │                                                 │
   │  NCC Program: 712fUCmQ...                       │
   │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
   │  │  Pool    │  │  Loan    │  │  Attestation │  │
   │  │   PDA    │  │ Position │  │     PDA      │  │
   │  └──────────┘  └──────────┘  └──────────────┘  │
   │                                                 │
   │  Encrypt Program: 4ebfzWdK... (executor-owned)  │
   │  ┌──────────────────────────────────────────┐   │
   │  │  CiphertextAccount (collateral, debt)    │   │
   │  └──────────────────────────────────────────┘   │
   │                                                 │
   │  Ika Program: 87W54kGY... (executor-owned)      │
   │  ┌──────────────────────────────────────────┐   │
   │  │  dWallet PDA (Curve25519, MPC-secured)   │   │
   │  └──────────────────────────────────────────┘   │
   └─────────────────────────────────────────────────┘
```

### State Machine (On-Chain)

```
Draft → VaultReady → Active → ReleaseCheckPending → ReleasePendingSignature → Released
                           → LiquidationCheckPending → LiquidationPendingSignature → Liquidated
```

Each transition is enforced by the NCC program, which validates Encrypt ciphertext accounts and Ika dWallet authority.

---

## Live Devnet Addresses

| Resource | Address / Endpoint |
|----------|-------------------|
| **NCC Program** | `712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ` |
| **Encrypt Program** | `4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8` |
| **Ika Program** | `87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY` |
| **Encrypt gRPC** | `pre-alpha-dev-1.encrypt.ika-network.net:443` (TLS) |
| **Ika gRPC** | `pre-alpha-dev-1.ika.ika-network.net:443` (TLS) |
| **Solana RPC** | `https://api.devnet.solana.com` |
| **Explorer** | [View NCC Program ↗](https://explorer.solana.com/address/712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ?cluster=devnet) |

---

## How We Utilize Encrypt FHE

### gRPC `createInput` (Live, Tested)

We call the Encrypt executor's `createInput` gRPC method directly from a Next.js API route (server-side, since `@grpc/grpc-js` is Node-only):

```typescript
// POST /api/encrypt/create-input
// Calls: /encrypt.v1.EncryptService/CreateInput
// Proto encoding: chain=SOLANA(0), inputs=[{ctBytes:16-byte-LE, fheType:4}], authorized=NCC_PROGRAM_ID

const response = await encryptGrpc.createInput({
  value: collateralValueUsd,     // e.g. $50,000
  fheType: 4,                    // EUint64
  authorized: NCC_PROGRAM_ID,   // who can use this ciphertext
  networkKey: encryptNetworkKey, // read live from EncryptConfig on-chain
});
// Returns: { ciphertextIdentifier: "05d829f2..." (32-byte hex) }
```

**Live test result**: The executor returns a real `ciphertextIdentifier` (e.g., `05d829f20d679d8471aa2ed44bdf0712c2e71bc885a9c2ec70dd9130f996e64`) that is registered on the Encrypt devnet program.

### On-Chain Ciphertext Accounts

The `attach_attestation` instruction creates two `CiphertextAccount` PDAs:
- **Collateral CT**: Stores the encrypted collateral value
- **Debt CT**: Stores the encrypted debt value

These are registered with the Encrypt program and tied to the NCC program as the `authorized` party. LTV checks are enforced by comparing ciphertexts without decryption.

### Why gRPC Instead of CPI

The traditional `create_plaintext_typed` CPI requires an `event_authority` PDA that the Encrypt executor initializes on deployment. On the pre-alpha devnet, this PDA has not yet been initialized by the team, making direct CPI non-functional. The `createInput` gRPC route is the **officially recommended path** for the pre-alpha phase (as documented in the Encrypt SDK README).

---

## How We Utilize Ika dWallet

### gRPC DKG (Live, Tested)

We initiate a real Distributed Key Generation (DKG) session with the Ika executor:

```typescript
// POST /api/ika/create-dwallet
// Calls: /ika.dwallet.v1.DWalletService/SubmitTransaction
// BCS-serialized SignedRequestData with DKG request

const dkgData = SignedRequestData.serialize({
  session_identifier_preimage: new Uint8Array(32),
  epoch: 1n, chain_id: { Solana: true },
  intended_chain_sender: payerBytes,
  request: {
    DKG: {
      curve: { Curve25519: true },
      user_secret_key_share: { Encrypted: { ... } },
      ...
    }
  }
});
// Returns: VersionedDWalletDataAttestation with real public_key
// dWallet PDA derived from (curve, publicKey) on IKA_PROGRAM_ID
```

**Live test result**: The Ika executor returns a real 247-byte attestation response containing the dWallet public key and attestation data, confirming a successful DKG session.

### On-Chain dWallet Integration

The `create_loan` instruction stores the dWallet's public key in the `LoanPosition` PDA. This establishes the link between the borrower's Solana account, their Ika dWallet (BTC custody), and the Encrypt ciphertext accounts (private LTV state).

---

## Full On-Chain Lifecycle

### Step 1 — Create Vault (dWallet + Loan PDA)
1. Frontend calls `/api/ika/create-dwallet` → Ika gRPC DKG → real dWallet PDA
2. Frontend builds `create_loan` instruction with dWallet pubkey
3. User signs transaction → `LoanPosition` PDA created on devnet
4. **Transaction visible on Solana Explorer**

### Step 2 — Fund Vault
1. User sends BTC to their Ika dWallet address (real Bitcoin address)
2. Frontend calls `mark_vault_ready` instruction
3. `LoanPosition` status transitions: `Draft → VaultReady`
4. **Transaction visible on Solana Explorer**

### Step 3 — Attest Collateral (FHE Encryption)
1. Frontend calls `/api/encrypt/create-input` → real ciphertext identifier returned
2. Frontend builds `attach_attestation` instruction with ciphertext account keypairs
3. User signs → `AttestationRecord` PDA created, ciphertext accounts initialized
4. `LoanPosition` status transitions: `VaultReady → Active`
5. **Transaction visible on Solana Explorer**, ciphertext ID displayed in UI

### Step 4 — Borrow USDC
1. User specifies borrow amount
2. Frontend calls `borrow` instruction (devnet simulation)
3. LTV check runs against encrypted ciphertext accounts
4. USDC disbursed from pool PDA (pre-funded on devnet)

---

## Repository Structure

```
NCC Lines/
├── programs/
│   └── native_credit_lines/
│       ├── src/
│       │   ├── lib.rs              # Instruction dispatcher
│       │   ├── state.rs            # Account layouts + constants
│       │   └── instructions/
│       │       ├── create_loan.rs  # Loan PDA + dWallet binding
│       │       ├── attestation.rs  # Ciphertext creation + state machine
│       │       ├── borrow.rs       # LTV-gated disbursement
│       │       └── policy.rs       # Release/liquidation policies
│       └── tests/
│           └── mollusk_tests.rs    # State layout + LTV math tests
├── apps/
│   └── dashboard/
│       ├── src/
│       │   ├── app/
│       │   │   └── api/
│       │   │       ├── encrypt/create-input/  # Encrypt gRPC bridge
│       │   │       └── ika/create-dwallet/    # Ika DKG bridge
│       │   ├── components/         # Next.js UI components
│       │   └── lib/
│       │       ├── transactions.ts # Solana instruction builders
│       │       ├── ika-bcs-types.ts # BCS types from Ika SDK
│       │       └── onchain.ts      # Account fetching
│       └── .env.example
└── docs/
    └── technical_architecture.md
```

---

## Running Locally

```bash
# Prerequisites: Node 20+, Phantom wallet with devnet SOL

cd apps/dashboard
cp .env.example .env.local
npm install
npm run dev
# Open http://localhost:3000
```

No Anchor CLI needed — the program is already deployed to devnet.

---

## Running Tests

```bash
cd programs/native_credit_lines
cargo test
# Tests state layout offsets, LTV math, instruction encoding
# All tests pass without deploying to devnet
```

---

## Pre-Alpha Disclaimers

- **Encrypt FHE**: Pre-alpha — data is stored as plaintext. No real encryption until mainnet.
- **Ika dWallet**: Pre-alpha — uses a single mock signer, not real distributed MPC.
- Both protocols are deployed on Solana devnet only.
- All interfaces subject to change before mainnet.

---

## Built With

- **Solana** (devnet) — on-chain state machine and transaction settlement
- **Encrypt FHE** (pre-alpha) — encrypted ciphertext creation via gRPC executor
- **Ika dWallet** (pre-alpha) — distributed key generation via gRPC executor
- **Next.js 15** — dashboard with server-side API routes for gRPC bridging
- **@grpc/grpc-js** — Node.js gRPC client for executor communication
- **@mysten/bcs** — BCS serialization for Ika request encoding
- **Mollusk** — instruction-level SVM testing without full deployment
