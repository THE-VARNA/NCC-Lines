# Technical Architecture
## Native Collateral Credit Lines (NCC)

This document provides a deep dive into the technical design, state architecture, and cross-chain execution flow of the Native Collateral Credit Lines protocol.

---

## 1. System Overview

NCC operates across three distinct networks to provide a trustless, confidential lending experience:

1. **Solana (Execution Layer):** Hosts the core BPF program (written using the lightweight Pinocchio framework). It manages the state machine, user interactions, and USDC liquidity.
2. **Ika dWallet Network (Custody Layer):** Provides an MPC (Multi-Party Computation) decentralized network that generates native Bitcoin Taproot addresses and signs Bitcoin transactions only when authorized by the Solana program.
3. **Encrypt FHE (Privacy Layer):** Provides Fully Homomorphic Encryption. It stores financial values as ciphertexts and computes mathematical graphs (like Loan-to-Value checks) directly on encrypted data without ever decrypting the underlying amounts.

---

## 2. On-Chain State Architecture

The Solana program stores state in derived PDAs (Program Derived Addresses). The architecture relies heavily on precise byte layouts to remain highly optimized (66KB binary size).

### Pool Account
A global singleton account for a specific asset pair (e.g., BTC/USDC).
- **Discriminator:** `1`
- **Admin Pubkey:** Controls pausing/upgrading.
- **Encrypt FHE Pubkeys:** Stores the `domain_public_key` and `server_public_key` required for FHE operations.
- **Loan Count:** An auto-incrementing `u32` used to derive unique Loan PDAs.

### Loan Account (317 Bytes)
The core position account for a user. It binds the borrower, the Ika dWallet, and the Encrypt FHE ciphertexts together.
- **Discriminator:** `2`
- **Borrower Pubkey (32 bytes):** The owner of the loan.
- **dWallet Pubkey (32 bytes):** The reference to the Ika MPC wallet holding the native BTC.
- **Status (1 byte):** A state machine enum (`Draft` → `VaultReady` → `Active` → `ReleasePending` etc.).
- **Encrypted Collateral Value (128 bytes):** The USD value of the deposited BTC, encrypted as an Encrypt `EncryptedUint64`.
- **Encrypted Debt Value (128 bytes):** The outstanding USDC loan amount, encrypted as an `EncryptedUint64`.

---

## 3. The Ika dWallet Integration (Custody)

We utilize Ika to achieve **native Bitcoin custody** without wrapping or bridging.

1. **DKG (Distributed Key Generation):** The user requests an Ika worker to generate a dWallet. This outputs a native Bitcoin Taproot address and an Ika dWallet account on Solana.
2. **Authority Transfer:** The dWallet's signing authority is transferred to our Solana program's PDA (`Ika CPI Authority`). This ensures the user cannot withdraw the BTC while they have an active loan.
3. **CPI Signature Execution:** When a user repays their loan, our program calls the Ika `approve_message` CPI.
   - It passes the `EcdsaDoubleSha256` signature scheme.
   - It passes the raw Bitcoin transaction hash that sends the BTC back to the user.
   - The Ika network validators verify the CPI, sign the hash via MPC, and broadcast it to the Bitcoin network.

---

## 4. The Encrypt FHE Integration (Privacy)

We utilize Encrypt FHE to guarantee that **debt balances and liquidation thresholds are never public**.

### The Homomorphic LTV Engine
When an oracle updates the price of BTC, we must evaluate if a user is liquidatable. However, we cannot decrypt their collateral or debt to check. Instead, we use an FHE graph.

**The Graph Logic:**
```text
Condition to Liquidate: (Debt * 10,000) >= (Collateral * 7,500)
```
1. The graph multiplies the encrypted Debt by `10,000`.
2. The graph multiplies the encrypted Collateral by `7,500` (the 75% Max LTV parameter).
3. The graph performs an encrypted Greater-Than-Or-Equal (`GTE`) comparison.

**The Output:**
The result of this graph is a single encrypted bit (`1` if liquidatable, `0` if safe). The protocol requests a decryption of *only* this single bit. The actual dollar amounts remain mathematically secure ciphertexts.

---

## 5. Instruction Lifecycle

The protocol enforces a strict state machine across 11 instructions:

### Setup Phase
1. **`initialize_pool`**: Creates the Pool PDA and calls the Encrypt FHE CPI to generate the initial encrypted zero-state ciphertexts.
2. **`create_loan`**: Derives a new Loan PDA for the borrower.
3. **`mark_vault_ready`**: Verifies the Ika dWallet authority has been transferred to the protocol.
4. **`attach_attestation`**: Saves the initial FHE ciphertexts (Collateral = X, Debt = 0) into the Loan PDA.

### Active Phase
5. **`borrow`**: The borrower requests USDC. The protocol transfers USDC from the vault and executes an FHE Addition graph to increase the encrypted debt ciphertext.
6. **`repay`**: The borrower sends USDC back. The protocol executes an FHE Subtraction graph to decrease the encrypted debt ciphertext.

### Resolution Phase (Release)
7. **`request_release_policy`**: To withdraw BTC, the protocol runs an FHE graph checking if `Encrypted Debt == 0`.
8. **`finalize_release`**: If the decrypted result is `1` (true), the protocol executes the Ika `approve_message` CPI, releasing the native BTC back to the user on the Bitcoin network.

### Resolution Phase (Liquidation)
9. **`request_liquidation_policy`**: A liquidator triggers the FHE LTV graph (as explained in Section 4).
10. **`finalize_liquidation`**: If the decrypted result is `1` (liquidatable), the protocol executes the Ika `approve_message` CPI, sending the native BTC to the liquidator on the Bitcoin network.

---

## 6. Security Considerations

- **No Plaintext Leaks:** Because calculations occur homomorphically, MEV bots cannot front-run liquidations based on visible debt cliffs.
- **Non-Custodial Design:** The Solana program is the sole authority over the Ika dWallets. No central admin or multi-sig can steal the underlying Bitcoin.
- **Idempotent Decryptions:** Decryption requests are asynchronous. The state machine prevents a loan from mutating while an FHE decryption or Ika signature is in flight.
