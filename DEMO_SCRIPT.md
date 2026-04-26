# Demo Script — Native Collateral Credit Lines
## 90-Second Hackathon Walkthrough

---

### Recording Setup

```bash
# Tool: OBS Studio / Loom / Quicktime
# Resolution: 1920×1080 @ 30fps
# Window: Firefox/Chrome at 1280px width (dashboard running at localhost:3000)
# Narration: screen + mic, no camera needed
```

---

### Script

#### 0:00–0:10 — Title card
> *"Native Collateral Credit Lines — zero-bridge BTC lending with confidential LTV.  
> Built on Solana with Encrypt FHE and Ika dWallet."*

Show: landing page. Pause on the three trust badges (Encrypt FHE · Ika dWallet · Solana) and the live network status dots.

---

#### 0:10–0:25 — Architecture (15s)
> *"No bridges. No custodians. The BTC sits in a dWallet — an MPC wallet controlled  
> jointly by Ika's threshold network and this Solana program.  
> The debt and LTV are never plaintext on-chain — they live in Encrypt FHE ciphertexts."*

Show: the `/` homepage. Point to the two sponsor program IDs in the footer:
- Encrypt: `4ebfzWd...`
- Ika dWallet: `87W54kG...`

---

#### 0:25–0:50 — Borrow flow (25s)
> *"I'll open a credit line. Connect wallet, select BTC collateral, set amount."*

Steps to record:
1. Click **Connect Wallet** → select Phantom → approve
2. Navigate to `/borrow`
3. Fill the loan form:  
   - Collateral: `0.5 BTC`  
   - Credit amount: `18,000 USDC`
4. Watch the **LTV badge** update to ~40% (green)
5. Click **Open Credit Line**
6. Show the transaction confirmation toast

> *"On-chain, that calls `create_loan` — a Pinocchio instruction that writes the loan  
> state and derives the dWallet PDA for collateral custody."*

---

#### 0:50–1:05 — FHE proof log (15s)
> *"The loan is active. Navigate to Proofs."*

Navigate to `/proofs`. Point to:
- The FHE computation log showing encrypted LTV check
- The `EcdsaDoubleSha256` scheme label on the dWallet entry
- The `MessageApproval` pending signature line

> *"Every borrow triggers an FHE computation graph via Encrypt's Pinocchio CPI.  
> The result stays encrypted — only the comparison bit is revealed to the program."*

---

#### 1:05–1:20 — Test suite (15s)
Switch to terminal:

```bash
cargo test -p native-credit-lines
```

Show output:
```
test result: ok. 14 passed; 0 failed   ← unit + layout tests
test result: ok. 6 passed; 0 failed    ← SVM instruction execution tests
```

> *"Six tests run instructions through the actual BPF binary via Mollusk SVM —  
> `mark_vault_ready` verifies the dWallet authority transition, and error paths  
> confirm the access control works end-to-end."*

---

#### 1:20–1:30 — Deploy (10s)
```bash
cargo-build-sbf --manifest-path programs/native_credit_lines/Cargo.toml
# Output: native_credit_lines.so  66K  optimized
solana program deploy target/deploy/native_credit_lines.so --url devnet
```

> *"The binary is 66 KB, fully optimized. Ready for devnet."*

---

### Submission Checklist

- [ ] Record at 1920×1080
- [ ] Keep total under 90 seconds
- [ ] Narrate live — avoid long pauses
- [ ] Show terminal commands in a readable font (`JetBrains Mono 16pt`)
- [ ] Upload to YouTube (unlisted) or Loom and add link to submission README
