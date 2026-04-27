#!/usr/bin/env node
// Seed pool via IX_DEBUG_SEED_POOL (disc=100) — no Encrypt CPI needed.
// Run from: apps/dashboard/
//   node seed-pool.js

const {
  Connection, Keypair, PublicKey, Transaction,
  TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const fs = require("fs"), os = require("os"), path = require("path");

const PROGRAM_ID   = new PublicKey("712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ");
const RPC_URL      = "https://api.devnet.solana.com";
const POOL_ID_SEED = "btc_main_v1";
const POOL_LEN     = 153;
const DISC_POOL    = 1;
const POOL_LOAN_COUNT = 132;
const IX_DEBUG_SEED_POOL = 100;
const ASSET_BTC = 1;

async function main() {
  const secret = JSON.parse(fs.readFileSync(
    path.join(os.homedir(), ".config", "solana", "id.json"), "utf8"
  ));
  const admin = Keypair.fromSecretKey(Uint8Array.from(secret));
  const conn  = new Connection(RPC_URL, "confirmed");
  const bal   = await conn.getBalance(admin.publicKey);
  console.log("Admin  :", admin.publicKey.toBase58());
  console.log("Balance:", (bal / LAMPORTS_PER_SOL).toFixed(4), "SOL");

  const poolId = Buffer.alloc(32);
  Buffer.from(POOL_ID_SEED, "utf8").copy(poolId);

  const [poolPda, poolBump] = await PublicKey.findProgramAddress(
    [Buffer.from("pool"), poolId], PROGRAM_ID
  );
  console.log("Pool PDA:", poolPda.toBase58(), "(bump:", poolBump + ")");

  // Check existing
  const existing = await conn.getAccountInfo(poolPda);
  if (existing && existing.data.length >= POOL_LEN && existing.data[0] === DISC_POOL) {
    console.log("✅ Pool already seeded! Loans:", existing.data.readUInt32LE(POOL_LOAN_COUNT));
    console.log("Explorer:", `https://explorer.solana.com/address/${poolPda.toBase58()}?cluster=devnet`);
    return;
  }

  // Build IX_DEBUG_SEED_POOL instruction
  // Data layout: pool_id(32) + asset(1) + pool_bump(1) = 34 bytes
  const idata = Buffer.alloc(35);
  idata[0] = IX_DEBUG_SEED_POOL;         // discriminator
  poolId.copy(idata, 1);                 // pool_id[32]
  idata[33] = ASSET_BTC;                 // asset
  idata[34] = poolBump;                  // pool_bump

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: poolPda,                    isSigner: false, isWritable: true  },
      { pubkey: admin.publicKey,            isSigner: true,  isWritable: false },
      { pubkey: admin.publicKey,            isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId,    isSigner: false, isWritable: false },
    ],
    data: idata,
  });

  console.log("Sending debug_seed_pool transaction...");
  try {
    const tx  = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(conn, tx, [admin], { commitment: "confirmed" });
    console.log("✅ Pool seeded! Tx:", sig);
    console.log("Explorer:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);

    const info = await conn.getAccountInfo(poolPda);
    console.log("Pool account length:", info?.data.length, "bytes");
    console.log("Discriminator:", info?.data[0], "(expected 1)");
    console.log("Loan count:", info?.data.readUInt32LE(POOL_LOAN_COUNT));
    console.log("");
    console.log("✅ Pool is ready! The /borrow page will now work with Phantom.");
  } catch (err) {
    console.error("❌ Error:", err.message);
    const logs = err.logs || [];
    if (logs.length) console.log("Program logs:", logs.slice(0, 5).join("\n"));
  }
}

main().catch(err => { console.error("Fatal:", err.message); process.exit(1); });
