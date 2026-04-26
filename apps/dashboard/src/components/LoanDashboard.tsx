"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { computeCreditLimit, ltvPercent, usdCentsToDisplay } from "@/lib/constants";
import { BorrowModal } from "./BorrowModal";

interface LoanPosition {
  id: string;
  status: string;
  statusCode: number;
  collateralBtc: number;
  collateralUsd: bigint;
  debtUsd: bigint;
  creditLimit: bigint;
  dwalletId: string;
}

// Demo positions for unconnected state
const DEMO_LOANS: LoanPosition[] = [
  {
    id: "Demo7xK...mPQ",
    status: "Active",
    statusCode: 2,
    collateralBtc: 0.5,
    collateralUsd: 5_000_000n,   // $50,000
    debtUsd: 20_000_00n,         // $20,000
    creditLimit: 30_000_00n,     // $30,000 (60% of $50K)
    dwalletId: "dw_demo...abc",
  },
];

function LtvBar({ ltv, limit }: { ltv: number; limit: number }) {
  const danger = ltv > 70;
  const warn = ltv > 55;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "0.75rem" }} className="text-secondary">LTV</span>
        <span
          style={{
            fontSize: "0.75rem",
            fontFamily: "'JetBrains Mono', monospace",
            color: danger ? "var(--red)" : warn ? "var(--amber)" : "var(--green)",
            fontWeight: 600,
          }}
        >
          {ltv}% / {limit}%
        </span>
      </div>
      <div className="progress-track">
        <div
          className={`progress-fill${danger ? " danger" : ""}`}
          style={{ width: `${Math.min((ltv / limit) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function LoanCard({ loan, demo }: { loan: LoanPosition; demo?: boolean }) {
  const ltv = ltvPercent(loan.debtUsd, loan.collateralUsd);
  const available = loan.creditLimit - loan.debtUsd;
  const [showBorrow, setShowBorrow] = useState(false);

  return (
    <>
      <div
        className="glass-card"
        style={{
          padding: "1.5rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {demo && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "var(--amber-dim)",
              color: "var(--amber)",
              fontSize: "0.65rem",
              fontWeight: 700,
              padding: "0.25rem 0.75rem",
              borderBottomLeftRadius: 8,
              letterSpacing: "0.05em",
            }}
          >
            DEMO
          </div>
        )}

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="status-dot active" />
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>BTC Credit Line</span>
            </div>
            <code style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{loan.id}</code>
          </div>
          <span className="badge badge-teal">{loan.status}</span>
        </div>

        {/* Numbers grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          {[
            { label: "Collateral", value: usdCentsToDisplay(loan.collateralUsd), accent: "var(--amber)" },
            { label: "Outstanding Debt", value: usdCentsToDisplay(loan.debtUsd), accent: "var(--text-primary)" },
            { label: "Available Credit", value: usdCentsToDisplay(available > 0n ? available : 0n), accent: "var(--teal)" },
          ].map(({ label, value, accent }) => (
            <div key={label}>
              <div className="text-muted" style={{ fontSize: "0.72rem", marginBottom: "0.25rem" }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: accent, fontFamily: "'JetBrains Mono', monospace" }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="divider" style={{ marginBottom: "1.25rem" }} />
        <LtvBar ltv={ltv} limit={75} />

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
          <button
            id={`btn-borrow-${loan.id}`}
            className="btn-primary"
            style={{ fontSize: "0.85rem", padding: "0.6rem 1.25rem" }}
            onClick={() => setShowBorrow(true)}
            disabled={demo}
          >
            Borrow
          </button>
          <button
            id={`btn-repay-${loan.id}`}
            className="btn-secondary"
            style={{ fontSize: "0.85rem", padding: "0.6rem 1.25rem" }}
            disabled={demo}
          >
            Repay
          </button>
          <button
            id={`btn-release-${loan.id}`}
            className="btn-secondary"
            style={{ fontSize: "0.85rem", padding: "0.6rem 1.25rem", marginLeft: "auto" }}
            disabled={demo}
          >
            Release →
          </button>
        </div>

        {/* FHE badge */}
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <span className="badge badge-purple" style={{ fontSize: "0.65rem" }}>🔒 FHE-Private</span>
          <span className="badge badge-amber" style={{ fontSize: "0.65rem" }}>⚡ dWallet Secured</span>
        </div>
      </div>

      {showBorrow && (
        <BorrowModal
          loanId={loan.id}
          creditLimit={loan.creditLimit}
          currentDebt={loan.debtUsd}
          onClose={() => setShowBorrow(false)}
        />
      )}
    </>
  );
}

export function LoanDashboard() {
  const { connected, publicKey } = useWallet();
  const [showNewLoan, setShowNewLoan] = useState(false);

  const loans = connected ? [] : DEMO_LOANS;
  const isDemo = !connected;

  return (
    <section
      style={{ maxWidth: 1200, margin: "0 auto 4rem", padding: "0 1.5rem" }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h2>Credit Positions</h2>
          <p style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {connected ? `${publicKey?.toBase58().slice(0, 8)}...` : "Connect wallet to view your positions"}
          </p>
        </div>
        <button
          id="btn-new-credit-line"
          className="btn-primary"
          onClick={() => setShowNewLoan(true)}
          disabled={!connected}
        >
          + New Credit Line
        </button>
      </div>

      {/* Loans grid */}
      {loans.length > 0 ? (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {loans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} demo={isDemo} />
          ))}
        </div>
      ) : connected ? (
        <div
          className="glass-card"
          style={{
            padding: "4rem",
            textAlign: "center",
            borderStyle: "dashed",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>₿</div>
          <h3>No Credit Lines Yet</h3>
          <p style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
            Open your first confidential BTC credit line in minutes.
          </p>
          <button
            id="btn-open-first-line"
            className="btn-primary"
            onClick={() => setShowNewLoan(true)}
          >
            Open Credit Line →
          </button>
        </div>
      ) : null}
    </section>
  );
}
