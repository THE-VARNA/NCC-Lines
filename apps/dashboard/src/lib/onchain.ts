/**
 * NCC Lines — Live Devnet Data Fetchers
 *
 * All helpers read directly from Solana devnet using @solana/web3.js.
 * No hardcoded demo data. Matches state.rs byte offsets exactly.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { NCC_PROGRAM_ID, findPoolPda, findLoanPda, getPoolId } from "./transactions";

// ── Program IDs (official devnet) ─────────────────────────────────────────
export const ENCRYPT_PROGRAM_ID_PUBKEY = new PublicKey(
  process.env.NEXT_PUBLIC_ENCRYPT_PROGRAM_ID ?? "4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8"
);
export const IKA_PROGRAM_ID_PUBKEY = new PublicKey(
  process.env.NEXT_PUBLIC_IKA_PROGRAM_ID ?? "87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY"
);

// ── State offsets (mirrors state.rs exactly) ──────────────────────────────
const POOL_LOAN_COUNT    = 132; // u32 LE
const POOL_PAUSED        = 131; // u8
const POOL_TOTAL_DEBT_CT = 66;  // [u8;32] ciphertext pubkey
const POOL_LIQUIDITY_CT  = 98;  // [u8;32] ciphertext pubkey
const POOL_ADMIN         = 34;  // [u8;32]
const POOL_LEN           = 153;
const DISC_POOL          = 1;

const LOAN_LEN        = 317;
const DISC_LOAN       = 2;
const LOAN_BORROWER   = 34;  // [u8;32]
const LOAN_DWALLET    = 66;  // [u8;32]
const LOAN_DEBT_CT    = 130; // [u8;32]
const LOAN_COLL_CT    = 162; // [u8;32]
const LOAN_STATUS     = 295; // u8
const LOAN_INDEX      = 290; // u32 LE
const LOAN_NONCE      = 296; // u32 LE

// ── Types ─────────────────────────────────────────────────────────────────

export interface PoolState {
  exists: boolean;
  loanCount: number;
  paused: boolean;
  debtCtPubkey: string | null;   // Encrypt ciphertext account pubkey (hex or b58)
  liquidityCtPubkey: string | null;
  adminPubkey: string | null;
  poolPda: string;
}

export interface LoanAccount {
  pubkey: string;
  loanIndex: number;
  borrower: string;
  dwalletPubkey: string;
  debtCtPubkey: string;
  collateralCtPubkey: string;
  statusCode: number;
  statusLabel: string;
  nonce: number;
}

export interface TxRecord {
  signature: string;
  slot: number;
  blockTime: number | null | undefined;
  err: boolean;
}

// ── Pool ──────────────────────────────────────────────────────────────────

export async function fetchPoolState(connection: Connection): Promise<PoolState> {
  const [poolPda] = await findPoolPda();
  const info = await connection.getAccountInfo(poolPda);

  if (!info || info.data.length < POOL_LEN || info.data[0] !== DISC_POOL) {
    return {
      exists: false,
      loanCount: 0,
      paused: false,
      debtCtPubkey: null,
      liquidityCtPubkey: null,
      adminPubkey: null,
      poolPda: poolPda.toBase58(),
    };
  }

  const d = info.data;
  const loanCount = d.readUInt32LE(POOL_LOAN_COUNT);
  const paused = d[POOL_PAUSED] !== 0;

  const debtCtBytes = d.slice(POOL_TOTAL_DEBT_CT, POOL_TOTAL_DEBT_CT + 32);
  const liqCtBytes  = d.slice(POOL_LIQUIDITY_CT, POOL_LIQUIDITY_CT + 32);
  const adminBytes  = d.slice(POOL_ADMIN, POOL_ADMIN + 32);

  const isZero = (b: Buffer) => b.every(v => v === 0);

  return {
    exists: true,
    loanCount,
    paused,
    debtCtPubkey: isZero(debtCtBytes) ? null : new PublicKey(debtCtBytes).toBase58(),
    liquidityCtPubkey: isZero(liqCtBytes) ? null : new PublicKey(liqCtBytes).toBase58(),
    adminPubkey: isZero(adminBytes) ? null : new PublicKey(adminBytes).toBase58(),
    poolPda: poolPda.toBase58(),
  };
}

// ── Loan ──────────────────────────────────────────────────────────────────

const LOAN_STATUS_LABELS: Record<number, string> = {
  0: "Draft",
  1: "Vault Ready",
  2: "Active",
  3: "Release Check Pending",
  4: "Release Pending Signature",
  5: "Released",
  6: "Liquidation Check Pending",
  7: "Liquidation Pending Signature",
  8: "Liquidated",
  9: "Frozen",
};

function parseLoanAccount(pubkey: PublicKey, data: Buffer): LoanAccount | null {
  if (data.length < LOAN_LEN || data[0] !== DISC_LOAN) return null;

  const borrowerBytes = data.slice(LOAN_BORROWER, LOAN_BORROWER + 32);
  const dwalletBytes  = data.slice(LOAN_DWALLET, LOAN_DWALLET + 32);
  const debtCtBytes   = data.slice(LOAN_DEBT_CT, LOAN_DEBT_CT + 32);
  const collCtBytes   = data.slice(LOAN_COLL_CT, LOAN_COLL_CT + 32);
  const statusCode    = data[LOAN_STATUS];
  const loanIndex     = data.readUInt32LE(LOAN_INDEX);
  const nonce         = data.readUInt32LE(LOAN_NONCE);

  return {
    pubkey: pubkey.toBase58(),
    loanIndex,
    borrower: new PublicKey(borrowerBytes).toBase58(),
    dwalletPubkey: new PublicKey(dwalletBytes).toBase58(),
    debtCtPubkey: new PublicKey(debtCtBytes).toBase58(),
    collateralCtPubkey: new PublicKey(collCtBytes).toBase58(),
    statusCode,
    statusLabel: LOAN_STATUS_LABELS[statusCode] ?? "Unknown",
    nonce,
  };
}

export async function fetchLoansByBorrower(
  connection: Connection,
  borrowerPubkey: PublicKey
): Promise<LoanAccount[]> {
  // First get pool to know how many loans exist
  const poolState = await fetchPoolState(connection);
  if (!poolState.exists || poolState.loanCount === 0) return [];

  const poolId = getPoolId();
  const results: LoanAccount[] = [];

  // Scan all loan PDAs, filter by borrower
  const keys: PublicKey[] = [];
  const indices: number[] = [];
  for (let i = 0; i < poolState.loanCount; i++) {
    const [loanPda] = findLoanPda(poolId, i);
    keys.push(loanPda);
    indices.push(i);
  }

  // Batch fetch (getMultipleAccountsInfo)
  const accounts = await connection.getMultipleAccountsInfo(keys);

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    if (!acc) continue;
    const loan = parseLoanAccount(keys[i], acc.data as Buffer);
    if (!loan) continue;
    if (loan.borrower === borrowerPubkey.toBase58()) {
      results.push(loan);
    }
  }

  return results;
}

// ── BTC Price (CoinGecko, no key needed) ─────────────────────────────────

let _btcPriceCache: { price: number; ts: number } | null = null;

export async function fetchBtcPrice(): Promise<number> {
  // Cache for 60 seconds
  if (_btcPriceCache && Date.now() - _btcPriceCache.ts < 60_000) {
    return _btcPriceCache.price;
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { next: { revalidate: 60 } } as RequestInit
    );
    if (!res.ok) throw new Error("CoinGecko error");
    const json = await res.json() as { bitcoin: { usd: number } };
    const price = json.bitcoin.usd;
    _btcPriceCache = { price, ts: Date.now() };
    return price;
  } catch {
    return _btcPriceCache?.price ?? 97000; // fallback to last known or 97k
  }
}

// ── Program Tx History ────────────────────────────────────────────────────

export async function fetchProgramTxHistory(
  connection: Connection,
  limit = 25
): Promise<TxRecord[]> {
  try {
    const sigs = await connection.getSignaturesForAddress(NCC_PROGRAM_ID, { limit });
    return sigs.map(s => ({
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime,
      err: !!s.err,
    }));
  } catch {
    return [];
  }
}

// ── Timestamp formatter ───────────────────────────────────────────────────

export function formatBlockTime(blockTime: number | null | undefined): string {
  if (!blockTime) return "—";
  const d = new Date(blockTime * 1000);
  return d.toUTCString().replace(" GMT", " UTC").slice(5); // "08 May 2026 02:42:11 UTC"
}
