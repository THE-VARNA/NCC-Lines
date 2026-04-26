// Protocol constants shared between frontend and (future) tests
export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "11111111111111111111111111111111";
export const ENCRYPT_PROGRAM_ID = process.env.NEXT_PUBLIC_ENCRYPT_PROGRAM_ID ?? "";
export const IKA_DWALLET_PROGRAM_ID = process.env.NEXT_PUBLIC_IKA_PROGRAM_ID ?? "";

// Risk parameters (mirrors on-chain constants)
export const MAX_BORROW_LTV_BPS = 6000;  // 60%
export const LIQUIDATION_LTV_BPS = 7500; // 75%
export const BPS_DENOMINATOR = 10000;

// Instruction discriminators (mirrors lib.rs)
export const IX = {
  INITIALIZE_POOL: 0,
  CREATE_LOAN: 1,
  MARK_VAULT_READY: 2,
  ATTACH_ATTESTATION: 3,
  ACTIVATE_LOAN: 4,
  BORROW: 5,
  REPAY: 6,
  REQUEST_RELEASE_POLICY: 7,
  FINALIZE_RELEASE: 8,
  REQUEST_LIQUIDATION_POLICY: 9,
  FINALIZE_LIQUIDATION: 10,
} as const;

// Asset IDs
export const ASSET_BTC = 1;

// Loan statuses (mirrors LoanStatus enum)
export const LOAN_STATUS = {
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
} as const;

export type LoanStatusKey = keyof typeof LOAN_STATUS;

export function loanStatusLabel(code: number): string {
  return LOAN_STATUS[code as LoanStatusKey] ?? "Unknown";
}

export function computeCreditLimit(collateralUsdCents: bigint): bigint {
  return (collateralUsdCents * BigInt(MAX_BORROW_LTV_BPS)) / BigInt(BPS_DENOMINATOR);
}

export function isLiquidatable(debtUsdCents: bigint, collateralUsdCents: bigint): boolean {
  if (collateralUsdCents === 0n) return false;
  return debtUsdCents * BigInt(BPS_DENOMINATOR) >= collateralUsdCents * BigInt(LIQUIDATION_LTV_BPS);
}

export function usdCentsToDisplay(cents: bigint): string {
  const dollars = Number(cents) / 100;
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function ltvPercent(debtUsdCents: bigint, collateralUsdCents: bigint): number {
  if (collateralUsdCents === 0n) return 0;
  return Math.round(Number((debtUsdCents * 10000n) / collateralUsdCents) / 100);
}
