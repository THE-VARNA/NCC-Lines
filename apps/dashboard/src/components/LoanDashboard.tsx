"use client";

import { ltvPercent, usdCentsToDisplay } from "@/lib/constants";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { useState } from "react";

interface LoanPosition {
  id: string;
  statusCode: number;
  statusLabel: string;
  collateralBtc: number;
  collateralUsd: bigint;
  debtUsd: bigint;
  creditLimit: bigint;
  dwalletId: string;
  ltvLimit: number;
}

const DEMO_LOANS: LoanPosition[] = [
  {
    id: "Loan7xKm...mPQ3",
    statusCode: 2,
    statusLabel: "Active",
    collateralBtc: 0.5,
    collateralUsd: 5_000_000n,
    debtUsd:       2_000_000n,
    creditLimit:   3_000_000n,
    dwalletId:     "dw_0xAABB...CC01",
    ltvLimit:      75,
  },
];

function LtvBar({ ltv, limit }: { ltv: number; limit: number }) {
  const pct = Math.min((ltv / limit) * 100, 100);
  const cls = ltv >= limit ? "danger" : ltv >= limit * 0.75 ? "warn" : "";
  const color = ltv >= limit ? "var(--red)" : ltv >= limit * 0.75 ? "var(--amber)" : "var(--green)";
  return (
    <div>
      <div className="flex justify-between" style={{ marginBottom: "0.375rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>LTV</span>
        <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color, fontWeight: 700 }}>
          {ltv}% <span style={{ color: "var(--text-3)", fontWeight: 400 }}>/ {limit}%</span>
        </span>
      </div>
      <div className="progress">
        <div className={`progress-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LoanCard({ loan, demo }: { loan: LoanPosition; demo?: boolean }) {
  const ltv = ltvPercent(loan.debtUsd, loan.collateralUsd);
  const available = loan.creditLimit > loan.debtUsd ? loan.creditLimit - loan.debtUsd : 0n;
  const [showBorrow, setShowBorrow] = useState(false);
  const [showRepay, setShowRepay] = useState(false);

  return (
    <>
      <div className="card animate-in" style={{ padding: "clamp(1.25rem, 3vw, 1.75rem)", position: "relative", overflow: "hidden" }}>

        {/* Demo watermark */}
        {demo && (
          <div style={{
            position: "absolute", top: 0, right: 0,
            background: "var(--amber-soft)", color: "var(--amber)",
            fontSize: "0.625rem", fontWeight: 800, letterSpacing: "0.1em",
            padding: "0.2rem 0.75rem", borderBottomLeftRadius: "var(--r-sm)",
            borderTop: "1px solid var(--border-amber)", borderRight: "1px solid var(--border-amber)",
          }}>DEMO</div>
        )}

        {/* Header */}
        <div className="flex justify-between items-start" style={{ marginBottom: "1.25rem", gap: "0.5rem" }}>
          <div>
            <div className="flex items-center" style={{ gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="dot dot-green" />
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>BTC Credit Line</span>
              <span className="badge badge-teal">{loan.statusLabel}</span>
            </div>
            <code style={{ fontSize: "0.6875rem", color: "var(--text-3)" }}>{loan.id}</code>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div className="metric-value c-amber">{loan.collateralBtc} BTC</div>
            <div className="metric-label">Collateral</div>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid-4" style={{ marginBottom: "1.25rem" }}>
          {[
            { label: "Collateral Value", value: usdCentsToDisplay(loan.collateralUsd), color: "var(--text-0)" },
            { label: "Outstanding Debt",  value: usdCentsToDisplay(loan.debtUsd),       color: "var(--text-0)" },
            { label: "Credit Available",  value: usdCentsToDisplay(available),           color: "var(--teal)" },
            { label: "Credit Limit",      value: usdCentsToDisplay(loan.creditLimit),    color: "var(--text-1)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="card-flat" style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span className="metric-label">{label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.9375rem", color }}>{value}</span>
            </div>
          ))}
        </div>

        {/* LTV bar */}
        <LtvBar ltv={ltv} limit={loan.ltvLimit} />

        <div className="divider" style={{ margin: "1.25rem 0" }} />

        {/* Actions */}
        <div className="flex" style={{ gap: "0.625rem", flexWrap: "wrap" }}>
          <button id={`btn-borrow-${loan.id}`} className="btn btn-primary btn-sm"
            onClick={() => !demo && setShowBorrow(true)} disabled={demo}>
            Borrow USDC
          </button>
          <button id={`btn-repay-${loan.id}`} className="btn btn-secondary btn-sm"
            onClick={() => !demo && setShowRepay(true)} disabled={demo}>
            Repay
          </button>
          <button id={`btn-release-${loan.id}`} className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto", color: "var(--text-2)" }} disabled={demo}>
            Release Collateral →
          </button>
        </div>

        {/* Privacy badges */}
        <div className="flex" style={{ gap: "0.375rem", marginTop: "0.875rem", flexWrap: "wrap" }}>
          <span className="badge badge-purple">🔒 FHE-Private Debt</span>
          <span className="badge badge-teal">⚡ Ika MPC Custody</span>
          <span className="badge badge-amber">₿ EcdsaDoubleSha256</span>
        </div>
      </div>

      {showBorrow && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "1rem",
        }} onClick={() => setShowBorrow(false)}>
          <div className="card" style={{ maxWidth: 440, width: "100%", padding: "2rem" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: "1rem" }}>Borrow USDC</h3>
            <p style={{ marginBottom: "1.5rem" }}>Enter amount (max: {usdCentsToDisplay(loan.creditLimit - loan.debtUsd)})</p>
            <input className="input" placeholder="0.00 USDC" style={{ marginBottom: "1rem" }} />
            <div className="flex" style={{ gap: "0.75rem" }}>
              <button className="btn btn-primary" style={{ flex: 1 }}>Confirm Borrow</button>
              <button className="btn btn-secondary" onClick={() => setShowBorrow(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function LoanDashboard() {
  const { connected, publicKey } = useWallet();
  const loans = connected ? [] : DEMO_LOANS;
  const isDemo = !connected;

  return (
    <section className="z-base" style={{ paddingBottom: "clamp(3rem, 6vw, 5rem)" }}>
      <div className="container">
        {/* Section header */}
        <div className="flex justify-between items-center" style={{ marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "1.375rem" }}>Credit Positions</h2>
            <p style={{ fontSize: "0.8125rem", marginTop: "0.2rem" }}>
              {connected
                ? <span>Wallet <code style={{ color: "var(--teal)" }}>{publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-4)}</code></span>
                : "Connect wallet to view live positions"}
            </p>
          </div>
          <Link href="/borrow" id="btn-new-credit-line"
            className={`btn btn-primary btn-sm${!connected ? " hide-mobile" : ""}`}
            style={{ textDecoration: "none", opacity: connected ? 1 : 0.6, pointerEvents: connected ? "auto" : "none" }}>
            + New Credit Line
          </Link>
        </div>

        {/* Loans */}
        {loans.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {loans.map(loan => <LoanCard key={loan.id} loan={loan} demo={isDemo} />)}
          </div>
        ) : connected ? (
          <div className="card" style={{ padding: "clamp(2.5rem, 6vw, 4rem)", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>₿</div>
            <h3 style={{ marginBottom: "0.5rem" }}>No Credit Lines Yet</h3>
            <p style={{ marginBottom: "1.75rem" }}>Open your first confidential BTC credit line in minutes.</p>
            <Link href="/borrow" id="btn-open-first-line" className="btn btn-primary" style={{ textDecoration: "none" }}>
              Open Credit Line →
            </Link>
          </div>
        ) : (
          <div className="card" style={{ padding: "clamp(2rem, 5vw, 3rem)", textAlign: "center" }}>
            <p style={{ marginBottom: "1.25rem" }}>Connect your wallet to manage live credit positions.</p>
            <WalletMultiButton />
          </div>
        )}
      </div>
    </section>
  );
}
