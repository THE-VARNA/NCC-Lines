/**
 * NCC Lines — Solana Transaction Helpers
 *
 * Wires up real on-chain instructions for the borrow flow.
 * Program: 712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

// ── Program IDs ────────────────────────────────────────────────────────────
export const NCC_PROGRAM_ID = new PublicKey(
  "712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ"
);

// ── Instruction discriminators (matches lib.rs) ────────────────────────────
const IX_CREATE_LOAN      = 1;
const IX_MARK_VAULT_READY = 2;

// ── Fixed pool (deployed on devnet, seeded as BTC/USDC main pool) ──────────
// pool seed: "pool" + pool_id(32 bytes of "btc_main_pool" padded)
const POOL_ID_SEED = "btc_main_v1";

export function getPoolId(): Uint8Array {
  const id = new Uint8Array(32);
  const enc = new TextEncoder().encode(POOL_ID_SEED);
  id.set(enc.slice(0, Math.min(enc.length, 32)));
  return id;
}

export async function findPoolPda(
  programId: PublicKey = NCC_PROGRAM_ID
): Promise<[PublicKey, number]> {
  const poolId = getPoolId();
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), Buffer.from(poolId)],
    programId
  );
}

export async function findLoanPda(
  poolId: Uint8Array,
  loanIndex: number,
  programId: PublicKey = NCC_PROGRAM_ID
): Promise<[PublicKey, number]> {
  const indexBuf = Buffer.alloc(4);
  indexBuf.writeUInt32LE(loanIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("loan"), Buffer.from(poolId), indexBuf],
    programId
  );
}

// ── Read loan count from pool account ─────────────────────────────────────
export async function getPoolLoanCount(connection: Connection): Promise<number> {
  const [poolPda] = await findPoolPda();
  try {
    const info = await connection.getAccountInfo(poolPda);
    if (!info || info.data.length < 140) return 0;
    // POOL_LOAN_COUNT offset = 132 (4 bytes LE u32)
    const count = info.data.readUInt32LE(132);
    return count;
  } catch {
    return 0;
  }
}

export async function poolExists(connection: Connection): Promise<boolean> {
  const [poolPda] = await findPoolPda();
  const info = await connection.getAccountInfo(poolPda);
  return !!info && info.data.length > 0 && info.data[0] === 1; // DISC_POOL = 1
}

// ── Build create_loan instruction ──────────────────────────────────────────
// Instruction data layout: pool_id(32) + dwallet_pubkey(32) + loan_bump(1) = 65 bytes
export async function buildCreateLoanIx(
  borrower: PublicKey,
  dwalletPubkey: PublicKey,
  connection: Connection
): Promise<{ ix: TransactionInstruction; loanPda: PublicKey; loanBump: number }> {
  const poolId = getPoolId();
  const [poolPda] = await findPoolPda();
  const loanCount = await getPoolLoanCount(connection);
  const [loanPda, loanBump] = await findLoanPda(poolId, loanCount);

  const data = Buffer.alloc(66); // discriminator(1) + pool_id(32) + dwallet_pubkey(32) + loan_bump(1)
  data[0] = IX_CREATE_LOAN;
  data.set(poolId, 1);
  data.set(dwalletPubkey.toBytes(), 33);
  data[65] = loanBump;

  const ix = new TransactionInstruction({
    programId: NCC_PROGRAM_ID,
    keys: [
      { pubkey: loanPda,           isSigner: false, isWritable: true  }, // 0: Loan PDA
      { pubkey: poolPda,           isSigner: false, isWritable: false  }, // 1: Pool PDA (readonly per instruction)
      { pubkey: dwalletPubkey,     isSigner: false, isWritable: false  }, // 2: dWallet account
      { pubkey: borrower,          isSigner: true,  isWritable: false  }, // 3: Borrower
      { pubkey: borrower,          isSigner: true,  isWritable: true   }, // 4: Payer
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 5: System
    ],
    data,
  });

  return { ix, loanPda, loanBump };
}

// ── Build mark_vault_ready instruction ─────────────────────────────────────
// This records that the dWallet DKG is complete and vault is ready.
// Instruction data layout: discriminator(1) only (no extra data)
export async function buildMarkVaultReadyIx(
  borrower: PublicKey,
  loanPda: PublicKey,
  dwalletId: PublicKey,
  connection: Connection
): Promise<TransactionInstruction> {
  const [poolPda] = await findPoolPda();

  const data = Buffer.alloc(1);
  data[0] = IX_MARK_VAULT_READY;

  return new TransactionInstruction({
    programId: NCC_PROGRAM_ID,
    keys: [
      { pubkey: loanPda,   isSigner: false, isWritable: true  }, // Loan PDA
      { pubkey: poolPda,   isSigner: false, isWritable: false  }, // Pool PDA
      { pubkey: dwalletId, isSigner: false, isWritable: false  }, // dWallet
      { pubkey: borrower,  isSigner: true,  isWritable: false  }, // Borrower
    ],
    data,
  });
}

// ── Check if pool is initialized, returns readable status ──────────────────
export async function getPoolStatus(connection: Connection): Promise<{
  exists: boolean;
  loanCount: number;
  poolPda: PublicKey;
}> {
  const [poolPda] = await findPoolPda();
  const exists = await poolExists(connection);
  const loanCount = exists ? await getPoolLoanCount(connection) : 0;
  return { exists, loanCount, poolPda };
}

// ── Send and confirm transaction ───────────────────────────────────────────
export async function sendTx(
  connection: Connection,
  transaction: Transaction,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = transaction.instructions[0].keys.find(k => k.isSigner && k.isWritable)?.pubkey;

  const signed = await signTransaction(transaction);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

export const DEVNET_EXPLORER = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
