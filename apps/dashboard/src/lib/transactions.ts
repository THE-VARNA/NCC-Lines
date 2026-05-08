/**
 * NCC Lines — Solana Transaction Helpers
 *
 * Real on-chain instructions for the full borrow flow.
 * Program: 712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ
 * Encrypt:  4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8 (pre-alpha devnet)
 * Ika:      87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY (pre-alpha devnet)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

function safePublicKey(envVar: string | undefined, fallback: string): PublicKey {
  try {
    return new PublicKey((envVar || fallback).trim());
  } catch (e) {
    return new PublicKey(fallback);
  }
}

// ── Program IDs ────────────────────────────────────────────────────────────
export const NCC_PROGRAM_ID = safePublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID,
  "712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ"
);

export const ENCRYPT_PROGRAM_ID = safePublicKey(
  process.env.NEXT_PUBLIC_ENCRYPT_PROGRAM_ID,
  "4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8"
);

export const IKA_PROGRAM_ID = safePublicKey(
  process.env.NEXT_PUBLIC_IKA_PROGRAM_ID,
  "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY"
);

// ── Instruction discriminators (matches lib.rs) ────────────────────────────
const IX_CREATE_LOAN        = 1;
const IX_MARK_VAULT_READY   = 2;
const IX_ATTACH_ATTESTATION = 3;

// ── Pool seed (matches debug_seed_pool.js / seed-pool.js) ─────────────────
const POOL_ID_SEED = "btc_main_v1";

export function getPoolId(): Uint8Array {
  const id = new Uint8Array(32);
  const enc = new TextEncoder().encode(POOL_ID_SEED);
  id.set(enc.slice(0, Math.min(enc.length, 32)));
  return id;
}

// ── PDA derivation ─────────────────────────────────────────────────────────
export function findPoolPda(
  programId: PublicKey = NCC_PROGRAM_ID
): [PublicKey, number] {
  const poolId = getPoolId();
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), Buffer.from(poolId)],
    programId
  );
}

export function findLoanPda(
  poolId: Uint8Array,
  loanIndex: number,
  programId: PublicKey = NCC_PROGRAM_ID
): [PublicKey, number] {
  const indexBuf = Buffer.alloc(4);
  indexBuf.writeUInt32LE(loanIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("loan"), Buffer.from(poolId), indexBuf],
    programId
  );
}

export function findAttestationPda(
  loanPda: PublicKey,
  programId: PublicKey = NCC_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("attestation"), loanPda.toBytes()],
    programId
  );
}

// ── Encrypt CPI PDAs ───────────────────────────────────────────────────────
// Seeds sourced from encrypt-pre-alpha SDK source:
//   config       → "encrypt_config"
//   deposit      → "encrypt_deposit" + payer_pubkey
//   event_auth   → "__event_authority"
//   network_key  → "network_encryption_key" + 32-byte key from config
export function findEncryptConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("encrypt_config")],
    ENCRYPT_PROGRAM_ID
  );
}

export function findEncryptDepositPda(payer: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("encrypt_deposit"), payer.toBytes()],
    ENCRYPT_PROGRAM_ID
  );
}

export function findEncryptCpiAuthorityPda(callerProgram: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__encrypt_cpi_authority")],
    callerProgram
  );
}

// Network encryption key PDA — seed is ["network_encryption_key", networkKeyBytes]
// The 32-byte key lives at config.data[100..132]. Pass it after reading config.
export function findEncryptNetworkEncryptionKeyPda(networkKeyBytes: Uint8Array): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("network_encryption_key"), Buffer.from(networkKeyBytes)],
    ENCRYPT_PROGRAM_ID
  );
}

export function findEncryptEventAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    ENCRYPT_PROGRAM_ID
  );
}

// ── Ensure EncryptDeposit PDA exists ────────────────────────────────────────
// The Encrypt program validates enc_vault (account index 5) against
// config.data[100..132]. If that field is the system program, payer is used.
// Returns the instruction to create it (IX_CREATE_DEPOSIT = 14), or null if
// it already exists on-chain.
export async function buildCreateEncryptDepositIxIfNeeded(
  payer: PublicKey,
  connection: Connection
): Promise<TransactionInstruction | null> {
  const [depositPda, depositBump] = findEncryptDepositPda(payer);
  const [configPda]               = findEncryptConfigPda();

  // Check if deposit already exists
  const existing = await connection.getAccountInfo(depositPda);
  if (existing) return null;

  // Read enc_vault from config account (bytes 100..132)
  // If it equals the system program (all zeros / dev mode), fall back to payer
  const configInfo = await connection.getAccountInfo(configPda);
  let encVault = payer;
  if (configInfo && configInfo.data.length >= 132) {
    const vaultBytes = configInfo.data.slice(100, 132);
    const vaultKey = new PublicKey(vaultBytes);
    if (!vaultKey.equals(SystemProgram.programId)) {
      encVault = vaultKey;
    }
  }
  const vaultIsSigner = encVault.equals(payer);

  // IX_CREATE_DEPOSIT = 14, layout: [14, bump, 0x00 * 16]
  const data = Buffer.alloc(18);
  data[0] = 14; // IX_CREATE_DEPOSIT
  data[1] = depositBump;

  return new TransactionInstruction({
    programId: ENCRYPT_PROGRAM_ID,
    data,
    keys: [
      { pubkey: depositPda,              isSigner: false,        isWritable: true  },
      { pubkey: configPda,               isSigner: false,        isWritable: false },
      { pubkey: payer,                   isSigner: true,         isWritable: false },
      { pubkey: payer,                   isSigner: true,         isWritable: true  },
      { pubkey: payer,                   isSigner: true,         isWritable: true  },
      { pubkey: encVault,                isSigner: vaultIsSigner, isWritable: true }, // enc_vault from config
      { pubkey: SystemProgram.programId, isSigner: false,        isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false,        isWritable: false },
    ],
  });
}

// ── Ika CPI PDAs ───────────────────────────────────────────────────────────
export function findIkaCpiAuthorityPda(callerProgram: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__ika_cpi_authority")],
    callerProgram
  );
}

// ── Read pool loan count ───────────────────────────────────────────────────
export async function getPoolLoanCount(connection: Connection): Promise<number> {
  const [poolPda] = findPoolPda();
  try {
    const info = await connection.getAccountInfo(poolPda);
    if (!info || info.data.length < 140) return 0;
    return (info.data as Buffer).readUInt32LE(132); // POOL_LOAN_COUNT offset
  } catch {
    return 0;
  }
}

export async function poolExists(connection: Connection): Promise<boolean> {
  const [poolPda] = findPoolPda();
  const info = await connection.getAccountInfo(poolPda);
  return !!info && info.data.length > 0 && info.data[0] === 1; // DISC_POOL = 1
}

// ── Build create_loan instruction ──────────────────────────────────────────
// data layout: discriminator(1) + pool_id(32) + dwallet_pubkey(32) + loan_bump(1) = 66 bytes
export async function buildCreateLoanIx(
  borrower: PublicKey,
  dwalletPubkey: PublicKey,
  connection: Connection
): Promise<{ ix: TransactionInstruction; loanPda: PublicKey; loanBump: number }> {
  const poolId = getPoolId();
  const [poolPda] = findPoolPda();
  const loanCount = await getPoolLoanCount(connection);
  const [loanPda, loanBump] = findLoanPda(poolId, loanCount);

  const data = Buffer.alloc(66);
  data[0] = IX_CREATE_LOAN;
  data.set(poolId, 1);
  data.set(dwalletPubkey.toBytes(), 33);
  data[65] = loanBump;

  const ix = new TransactionInstruction({
    programId: NCC_PROGRAM_ID,
    keys: [
      { pubkey: loanPda,             isSigner: false, isWritable: true  }, // 0: Loan PDA (create)
      { pubkey: poolPda,             isSigner: false, isWritable: true  }, // 1: Pool PDA (loan_count++)
      { pubkey: dwalletPubkey,       isSigner: false, isWritable: false }, // 2: dWallet account
      { pubkey: borrower,            isSigner: true,  isWritable: false }, // 3: Borrower signer
      { pubkey: borrower,            isSigner: true,  isWritable: true  }, // 4: Payer (same as borrower)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 5: System
    ],
    data,
  });

  return { ix, loanPda, loanBump };
}

// ── Build mark_vault_ready instruction ─────────────────────────────────────
// data layout: discriminator(1) only
export function buildMarkVaultReadyIx(
  borrower: PublicKey,
  loanPda: PublicKey,
  dwalletId: PublicKey
): TransactionInstruction {
  const [ikaCpiAuth] = findIkaCpiAuthorityPda(NCC_PROGRAM_ID);

  const data = Buffer.alloc(1);
  data[0] = IX_MARK_VAULT_READY;

  return new TransactionInstruction({
    programId: NCC_PROGRAM_ID,
    keys: [
      { pubkey: loanPda,    isSigner: false, isWritable: true  }, // 0: Loan PDA
      { pubkey: dwalletId,  isSigner: false, isWritable: false }, // 1: dWallet (readonly)
      { pubkey: borrower,   isSigner: true,  isWritable: false }, // 2: Borrower signer
      { pubkey: ikaCpiAuth, isSigner: false, isWritable: false }, // 3: Ika CPI Authority PDA
    ],
    data,
  });
}

// ── Build attach_attestation instruction ───────────────────────────────────
//
// data layout (58 bytes):
//   attestation_hash[32] + collateral_value_usd_cents[8] (u64 LE)
//   + timestamp[8] (i64 LE) + expiry[8] (i64 LE) + att_bump[1] + encrypt_cpi_bump[1]
//
// Requires 16 accounts including Encrypt CPI accounts.
// Returns null if Encrypt program is not found on devnet (caller handles gracefully).
//
export async function buildAttachAttestationIx(
  borrower: PublicKey,
  loanPda: PublicKey,
  collateralValueUsdCents: bigint,
  btcAddress: string,
  connection: Connection
): Promise<{ ix: TransactionInstruction; collateralCtKeypair: Keypair; debtCtKeypair: Keypair } | null> {
  // Check Encrypt program is present on devnet
  const encryptInfo = await connection.getAccountInfo(ENCRYPT_PROGRAM_ID);
  if (!encryptInfo) {
    return null; // Encrypt program not found on this devnet
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const expiry = now + BigInt(86400 * 30); // 30 days

  // Compute attestation hash: SHA256(btc_address || collateral_value_le8)
  const encoder = new TextEncoder();
  const btcBytes = encoder.encode(btcAddress);
  const collBytes = Buffer.alloc(8);
  const collView = new DataView(collBytes.buffer, collBytes.byteOffset, collBytes.byteLength);
  collView.setBigUint64(0, collateralValueUsdCents, true);
  const hashInput = Buffer.concat([btcBytes, collBytes]);
  const hashBuffer = await crypto.subtle.digest("SHA-256", hashInput);
  const attestationHash = new Uint8Array(hashBuffer);

  // PDAs
  const [attestationPda, attBump]          = findAttestationPda(loanPda);
  const [encryptConfig]                    = findEncryptConfigPda();
  const [encryptDeposit]                   = findEncryptDepositPda(borrower);
  const [encryptCpiAuth, encryptCpiBump]   = findEncryptCpiAuthorityPda(NCC_PROGRAM_ID);
  const [eventAuthority]                   = findEncryptEventAuthorityPda();

  // Read network encryption key from config account (bytes 100..132)
  const configInfo = await connection.getAccountInfo(encryptConfig);
  const networkKeyBytes = configInfo && configInfo.data.length >= 132
    ? configInfo.data.slice(100, 132)
    : new Uint8Array(32).fill(0x55); // fallback to test vector if config unreadable
  const [networkEncKey] = findEncryptNetworkEncryptionKeyPda(networkKeyBytes);

  // Fresh keypairs for ciphertext accounts
  const collateralCtKeypair = Keypair.generate();
  const debtCtKeypair       = Keypair.generate();

  // Build instruction data (59 bytes = 1 discriminator + 58 payload)
  const data = Buffer.alloc(59);
  const dataView = new DataView(data.buffer, data.byteOffset, data.length);
  let offset = 0;
  data[0] = IX_ATTACH_ATTESTATION;
  // Note: discriminator is the first byte. The program splits at data[0], so rest starts at [1].
  // The attestation.rs `process` receives `rest` (data after discriminator), so:
  // rest[0..32] = attestation_hash, rest[32..40] = collateral_value, etc.
  data.set(attestationHash, 1);
  dataView.setBigUint64(33, collateralValueUsdCents, true);
  dataView.setBigInt64(41, now, true);
  dataView.setBigInt64(49, expiry, true);
  data[57] = attBump;
  data[58] = encryptCpiBump;
  offset;

  const ix = new TransactionInstruction({
    programId: NCC_PROGRAM_ID,
    keys: [
      { pubkey: loanPda,                    isSigner: false, isWritable: true  }, //  0: Loan PDA
      { pubkey: attestationPda,             isSigner: false, isWritable: true  }, //  1: Attestation PDA (create)
      { pubkey: collateralCtKeypair.publicKey, isSigner: true, isWritable: true }, //  2: Collateral value ct (fresh)
      { pubkey: debtCtKeypair.publicKey,    isSigner: true,  isWritable: true  }, //  3: Debt ct (fresh, init to 0)
      { pubkey: borrower,                   isSigner: true,  isWritable: false }, //  4: Issuer = borrower
      { pubkey: borrower,                   isSigner: true,  isWritable: false }, //  5: Borrower
      { pubkey: borrower,                   isSigner: true,  isWritable: true  }, //  6: Payer
      { pubkey: SystemProgram.programId,    isSigner: false, isWritable: false }, //  7: System
      { pubkey: ENCRYPT_PROGRAM_ID,         isSigner: false, isWritable: false }, //  8: Encrypt program
      { pubkey: encryptConfig,              isSigner: false, isWritable: false }, //  9: EncryptConfig PDA
      { pubkey: encryptDeposit,             isSigner: false, isWritable: true  }, // 10: EncryptDeposit PDA
      { pubkey: encryptCpiAuth,             isSigner: false, isWritable: false }, // 11: Encrypt CPI authority
      { pubkey: NCC_PROGRAM_ID,             isSigner: false, isWritable: false }, // 12: Caller program (this)
      { pubkey: networkEncKey,              isSigner: false, isWritable: false }, // 13: NetworkEncryptionKey PDA
      { pubkey: eventAuthority,             isSigner: false, isWritable: false }, // 14: Event authority
      { pubkey: SystemProgram.programId,    isSigner: false, isWritable: false }, // 15: System (Encrypt CPI)
    ],
    data,
  });

  return { ix, collateralCtKeypair, debtCtKeypair };
}

// ── Pool status helper ─────────────────────────────────────────────────────
export async function getPoolStatus(connection: Connection): Promise<{
  exists: boolean;
  loanCount: number;
  poolPda: PublicKey;
}> {
  const [poolPda] = findPoolPda();
  const exists = await poolExists(connection);
  const loanCount = exists ? await getPoolLoanCount(connection) : 0;
  return { exists, loanCount, poolPda };
}

// ── Send and confirm ────────────────────────────────────────────────────────
export async function sendTx(
  connection: Connection,
  transaction: Transaction,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  extraSigners: Keypair[] = []
): Promise<string> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  if (!transaction.feePayer) {
    transaction.feePayer =
      transaction.instructions[0].keys.find(k => k.isSigner && k.isWritable)?.pubkey;
  }
  if (extraSigners.length > 0) {
    transaction.partialSign(...extraSigners);
  }
  const signed = await signTransaction(transaction);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return sig;
}

export const DEVNET_EXPLORER = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
