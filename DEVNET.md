# Devnet Deployment Guide

## Prerequisites
```bash
solana config set --url devnet
solana-keygen new --outfile ~/.config/solana/id.json  # skip if already exists
solana airdrop 2
```

## Build the Program
```bash
# Install Solana build tools (if not already installed)
cargo install --git https://github.com/anza-xyz/agave.git cargo-build-sbf

# Build for SBF (Solana BPF format)
cargo build-sbf -p native-credit-lines
# Output: target/deploy/native_credit_lines.so
```

## Deploy
```bash
# Deploy the program
solana program deploy target/deploy/native_credit_lines.so

# Save the program ID to your .env
# NEXT_PUBLIC_PROGRAM_ID=<printed-address>
```

## Run the Frontend
```bash
cd apps/dashboard
cp .env.example .env.local
# Edit .env.local with your deployed program ID
npm run dev
# Visit http://localhost:3000
```

## Run the Ika Worker Sidecar
```bash
# DKG — create a dWallet for a borrower
cargo run -p ika-worker -- dkg --user-pubkey <BORROWER_PUBKEY_BASE58>

# Check status
cargo run -p ika-worker -- status --dwallet-id <DWALLET_HEX>
```

## Run Integration Tests
```bash
cargo test -p native-credit-lines
# Expected: 20 passed; 0 failed
```
## Airdrop More SOL If Needed
```bash
solana airdrop 2 && solana balance
```
