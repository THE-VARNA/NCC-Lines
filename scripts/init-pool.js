#!/usr/bin/env node
/**
 * Initialize the BTC/USDC Pool PDA on Solana devnet.
 * Run from: apps/dashboard/  (where @solana/web3.js is installed)
 *
 *   node scripts/init-pool.js
 */

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const fs   = require("fs");
const os   = require("os");
const path = require("path");

// ── Config ─────────────────────────────────────────────────────────────────
const PROGRAM_ID   = new PublicKey("712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ");
const RPC_URL      = "https://api.devnet.solana.com";
const POOL_ID_SEED = "btc_main_v1";

// State layout (must match state.rs)
const POOL_LEN        = 153;
const DISC_POOL       = 1;
const ASSET_BTC       = 1;
const POOL_LOAN_COUNT = 132;
const IX_INITIALIZE_POOL = 0;

// ── Helpers ─────────────────────────────────────────────────────────────────
function getPoolId() {
  const id  = Buffer.alloc(32);
  const enc = Buffer.from(POOL_ID_SEED, "utf8");
  enc.copy(id, 0, 0, Math.min(enc.length, 32));
  return id;
}

async function main() {
  // Load keypair
  const keypairPath = process.env.SOLANA_KEYPAIR_PATH
    || path.join(os.homedir(), ".config", "solana", "id.json");
  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const admin  = Keypair.fromSecretKey(Uint8Array.from(secret));

  const connection = new Connection(RPC_URL, "confirmed");
  const balance    = await connection.getBalance(admin.publicKey);
  console.log("Admin  :", admin.publicKey.toBase58());
  console.log("Balance:", (balance / LAMPORTS_PER_SOL).toFixed(4), "SOL");

  // Derive Pool PDA
  const poolId = getPoolId();
  const [poolPda, poolBump] = await PublicKey.findProgramAddress(
    [Buffer.from("pool"), poolId],
    PROGRAM_ID
  );
  console.log("Pool PDA:", poolPda.toBase58(), "(bump:", poolBump + ")");

  // ── Check if already exists ───────────────────────────────────────────────
  const existing = await connection.getAccountInfo(poolPda);
  if (existing && existing.data.length > 0 && existing.data[0] === DISC_POOL) {
    const loanCount = existing.data.readUInt32LE(POOL_LOAN_COUNT);
    console.log("✅ Pool already initialized! Loan count:", loanCount);
    console.log("Explorer:", `https://explorer.solana.com/address/${poolPda.toBase58()}?cluster=devnet`);
    return;
  }

  // ── Build initialize_pool instruction ─────────────────────────────────────
  // Data: pool_id(32) + asset(1) + seed_liquidity(8) + pool_bump(1) + encrypt_cpi_bump(1) = 43 bytes
  const idata = Buffer.alloc(44); // disc(1) + 43
  idata[0] = IX_INITIALIZE_POOL;
  poolId.copy(idata, 1);                       // pool_id
  idata[33] = ASSET_BTC;                       // asset
  idata.writeBigUInt64LE(BigInt(500_000_000), 34); // seed_liquidity: $5M (in cents)
  idata[42] = poolBump;                        // pool_bump
  idata[43] = 255;                             // encrypt_cpi_bump placeholder

  // Fresh keypairs for the two ciphertext accounts (required by instruction)
  const debtCtKp  = Keypair.generate();
  const liqCtKp   = Keypair.generate();

  console.log("Sending initialize_pool transaction...");
  console.log("  debt_ct :", debtCtKp.publicKey.toBase58());
  console.log("  liq_ct  :", liqCtKp.publicKey.toBase58());

  const rentPool = await connection.getMinimumBalanceForRentExemption(POOL_LEN);
  const rentSmall = await connection.getMinimumBalanceForRentExemption(8);

  // Pre-fund the ciphertext accounts with rent
  const fundTx = new Transaction()
    .add(SystemProgram.createAccount({
      fromPubkey: admin.publicKey,
      newAccountPubkey: debtCtKp.publicKey,
      lamports: rentSmall,
      space: 8,
      programId: SystemProgram.programId,
    }))
    .add(SystemProgram.createAccount({
      fromPubkey: admin.publicKey,
      newAccountPubkey: liqCtKp.publicKey,
      lamports: rentSmall,
      space: 8,
      programId: SystemProgram.programId,
    }));

  await sendAndConfirmTransaction(connection, fundTx, [admin, debtCtKp, liqCtKp], { commitment: "confirmed" });
  console.log("Ciphertext accounts funded.");

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: poolPda,             isSigner: false, isWritable: true  }, // Pool PDA
      { pubkey: debtCtKp.publicKey,  isSigner: false, isWritable: true  }, // total_debt_ct
      { pubkey: liqCtKp.publicKey,   isSigner: false, isWritable: true  }, // pool_liquidity_ct
      { pubkey: admin.publicKey,     isSigner: true,  isWritable: false }, // admin
      { pubkey: admin.publicKey,     isSigner: true,  isWritable: true  }, // payer
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // Encrypt CPI accounts (placeholders — pre-alpha not accessible)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // encrypt program
      { pubkey: admin.publicKey,     isSigner: false, isWritable: false }, // config
      { pubkey: admin.publicKey,     isSigner: false, isWritable: true  }, // deposit
      { pubkey: admin.publicKey,     isSigner: false, isWritable: false }, // cpi authority
      { pubkey: PROGRAM_ID,          isSigner: false, isWritable: false }, // caller program
      { pubkey: admin.publicKey,     isSigner: false, isWritable: false }, // network enc key
      { pubkey: admin.publicKey,     isSigner: false, isWritable: false }, // event authority
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: idata,
  });

  try {
    const tx  = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [admin], { commitment: "confirmed" });
    console.log("✅ Pool initialized! Tx:", sig);
    console.log("Explorer:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (err) {
    const msg = err.message || String(err);
    // The Encrypt CPI will fail because the pre-alpha endpoint is not the public devnet.
    // Check if the pool account was created before the CPI call.
    const info = await connection.getAccountInfo(poolPda);
    if (info && info.data.length >= POOL_LEN) {
      console.log("✅ Pool PDA created (Encrypt CPI skipped — pre-alpha only)");
      console.log("Explorer:", `https://explorer.solana.com/address/${poolPda.toBase58()}?cluster=devnet`);
    } else {
      console.log("\n⚠ initialize_pool failed (Encrypt FHE CPI requires pre-alpha network).");
      console.log("This is expected — the Encrypt pre-alpha endpoint is not public devnet.");
      console.log("\nThe create_loan tx from the browser WILL work if the pool account exists.");
      console.log("Pool PDA:", poolPda.toBase58());
      console.log("Error:", msg.split("\n")[0]);
    }
  }
}

main().catch(err => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});
