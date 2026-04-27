"use client";

import { usdCentsToDisplay, ltvPercent } from "@/lib/constants";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { useState } from "react";

interface LoanPosition {
  id: string;
  statusLabel: string;
  collateralBtc: number;
  collateralUsd: bigint;
  debtUsd: bigint;
  creditLimit: bigint;
  ltvLimit: number;
}

const DEMO_LOANS: LoanPosition[] = [
  {
    id: "Loan7xKm...mPQ3",
    statusLabel: "Active",
    collateralBtc: 0.5,
    collateralUsd: 5_000_000n,
    debtUsd:       2_000_000n,
    creditLimit:   3_000_000n,
    ltvLimit:      75,
  },
];

function LtvBar({ ltv, limit }: { ltv: number; limit: number }) {
  const pct = Math.min((ltv / limit) * 100, 100);
  const isWarn   = ltv >= limit * 0.75 && ltv < limit;
  const isDanger = ltv >= limit;
  const color = isDanger ? "var(--red)" : isWarn ? "var(--amber)" : "var(--cyan)";
  const fillClass = isDanger ? "danger" : isWarn ? "warn" : "";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", alignItems: "center" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)" }}>
          Loan-to-Value
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color }}>
          {ltv}%{" "}
          <span style={{ color: "var(--text-3)", fontWeight: 400 }}>/ {limit}%</span>
        </span>
      </div>
      <div className="progress">
        <div className={`progress-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      {isWarn && (
        <p style={{ marginTop: "0.375rem", fontSize: "0.6875rem", color: "var(--amber)", fontWeight: 500 }}>
          ⚠ Approaching liquidation threshold
        </p>
      )}
    </div>
  );
}

function BorrowModal({ loan, onClose }: { loan: LoanPosition; onClose: () => void }) {
  const available = loan.creditLimit > loan.debtUsd ? loan.creditLimit - loan.debtUsd : 0n;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(2,6,15,0.85)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }} onClick={onClose}>
      <div className="card" style={{
        maxWidth: 460, width: "100%",
        padding: "2rem",
        border: "1px solid var(--border-cyan)",
        boxShadow: "var(--shadow-cyan), var(--shadow-lg)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3>Borrow USDC</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer", fontSize: "1.25rem", padding: "0.25rem" }}>✕</button>
        </div>
        <p style={{ marginBottom: "1.25rem", fontSize: "0.875rem" }}>
          Available credit: <span style={{ color: "var(--cyan)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{usdCentsToDisplay(available)}</span>
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input className="input" placeholder="Amount (USDC)" type="number" />
          <div className="divider" />
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-primary" style={{ flex: 1 }}>Confirm Borrow →</button>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoanCard({ loan, demo }: { loan: LoanPosition; demo?: boolean }) {
  const ltv = ltvPercent(loan.debtUsd, loan.collateralUsd);
  const available = loan.creditLimit > loan.debtUsd ? loan.creditLimit - loan.debtUsd : 0n;
  const [showBorrow, setShowBorrow] = useState(false);

  return (
    <>
      <div className="card" style={{
        padding: "clamp(1.5rem, 3vw, 2rem)",
        position: "relative", overflow: "hidden",
        border: "1px solid var(--border-1)",
      }}>
        {/* Glow accent top */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, var(--cyan), var(--violet))",
        }} />

        {/* DEMO badge */}
        {demo && (
          <div style={{
            position: "absolute", top: 12, right: 12,
            background: "var(--amber-glow)",
            color: "var(--amber-light)",
            fontSize: "0.5625rem", fontWeight: 800,
            letterSpacing: "0.12em", textTransform: "uppercase",
            padding: "0.2rem 0.625rem",
            borderRadius: "var(--r-full)",
            border: "1px solid rgba(245,158,11,0.25)",
          }}>DEMO</div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
              <span className="dot dot-green" />
              <span style={{ fontWeight: 700, fontSize: "1.0625rem" }}>BTC Credit Line</span>
              <span className="badge badge-cyan" style={{ fontSize: "0.625rem" }}>{loan.statusLabel}</span>
            </div>
            <code style={{ fontSize: "0.6875rem", color: "var(--text-3)" }}>{loan.id}</code>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontSize: "clamp(1.25rem, 3vw, 1.75rem)", fontWeight: 800,
              fontFamily: "var(--font-mono)",
              color: "var(--amber-light)",
              letterSpacing: "-0.03em",
            }}>{loan.collateralBtc} BTC</div>
            <div className="metric-label">Collateral</div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid-4" style={{ marginBottom: "1.5rem", gap: "0.625rem" }}>
          {[
            { label: "Collateral Value", val: usdCentsToDisplay(loan.collateralUsd), color: "var(--text-0)" },
            { label: "Outstanding Debt",  val: usdCentsToDisplay(loan.debtUsd),       color: "var(--text-0)" },
            { label: "Available Credit",  val: usdCentsToDisplay(available),           color: "var(--cyan)" },
            { label: "Credit Limit",      val: usdCentsToDisplay(loan.creditLimit),    color: "var(--text-1)" },
          ].map(({ label, val, color }) => (
            <div key={label} className="card-flat" style={{ padding: "0.875rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <span className="metric-label">{label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.9375rem", color }}>{val}</span>
            </div>
          ))}
        </div>

        {/* LTV */}
        <LtvBar ltv={ltv} limit={loan.ltvLimit} />

        <div className="divider" style={{ margin: "1.25rem 0" }} />

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
          <button id={`btn-borrow-${loan.id}`}
            className="btn btn-primary btn-sm"
            onClick={() => !demo && setShowBorrow(true)}
            disabled={!!demo}>
            Borrow USDC
          </button>
          <button id={`btn-repay-${loan.id}`}
            className="btn btn-secondary btn-sm"
            disabled={!!demo}>
            Repay
          </button>
          <button id={`btn-release-${loan.id}`}
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto", color: "var(--text-2)", fontSize: "0.8125rem" }}
            disabled={!!demo}>
            Release Collateral →
          </button>
        </div>

        {/* Privacy tags */}
        <div style={{ display: "flex", gap: "0.375rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <span className="badge badge-cyan">🔒 FHE-Private Debt</span>
          <span className="badge badge-violet">⚡ Ika MPC Custody</span>
          <span className="badge badge-amber">₿ EcdsaDoubleSha256</span>
        </div>
      </div>

      {showBorrow && <BorrowModal loan={loan} onClose={() => setShowBorrow(false)} />}
    </>
  );
}

export function LoanDashboard() {
  const { connected, publicKey } = useWallet();
  const loans = connected ? [] : DEMO_LOANS;
  const isDemo = !connected;

  return (
    <section className="z-base section">
      <div className="container">
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2>Credit Positions</h2>
            <p style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
              {connected
                ? <span>Wallet <code style={{ color: "var(--cyan)" }}>{publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-4)}</code></span>
                : "Connect wallet to view live positions"}
            </p>
          </div>
          <Link href="/borrow" id="btn-new-credit-line"
            className="btn btn-primary btn-sm"
            style={{ textDecoration: "none", opacity: connected ? 1 : 0.5, pointerEvents: connected ? "auto" : "none" }}>
            + New Credit Line
          </Link>
        </div>

        {/* Content */}
        {loans.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {loans.map(loan => <LoanCard key={loan.id} loan={loan} demo={isDemo} />)}
          </div>
        ) : connected ? (
          <div className="card" style={{ padding: "clamp(3rem, 7vw, 5rem)", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem", filter: "grayscale(0.2)" }}>₿</div>
            <h3 style={{ marginBottom: "0.5rem" }}>No Credit Lines Yet</h3>
            <p style={{ marginBottom: "2rem", maxWidth: 360, margin: "0.5rem auto 2rem" }}>
              Open your first confidential BTC credit line in under a minute.
            </p>
            <Link href="/borrow" id="btn-open-first-line" className="btn btn-primary btn-lg" style={{ textDecoration: "none" }}>
              Open Credit Line →
            </Link>
          </div>
        ) : (
          <div className="card" style={{ padding: "clamp(2.5rem, 6vw, 4rem)", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
            <h3 style={{ marginBottom: "0.5rem" }}>Connect Your Wallet</h3>
            <p style={{ marginBottom: "1.75rem" }}>Manage your live credit positions on Solana devnet.</p>
            <div suppressHydrationWarning style={{ display: "flex", justifyContent: "center" }}>
              <WalletMultiButton />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
