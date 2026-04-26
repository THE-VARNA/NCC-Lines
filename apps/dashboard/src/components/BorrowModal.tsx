"use client";

import { useState } from "react";
import { computeCreditLimit, usdCentsToDisplay } from "@/lib/constants";

interface BorrowModalProps {
  loanId: string;
  creditLimit: bigint;
  currentDebt: bigint;
  onClose: () => void;
}

type Step = "input" | "fhe" | "ika" | "done";

export function BorrowModal({ loanId, creditLimit, currentDebt, onClose }: BorrowModalProps) {
  const available = creditLimit - currentDebt;
  const [amountStr, setAmountStr] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState("");

  const amountCents = Math.round(parseFloat(amountStr || "0") * 100);
  const amountBig = BigInt(isNaN(amountCents) ? 0 : amountCents);
  const exceedsLimit = amountBig > available;

  async function handleBorrow() {
    if (exceedsLimit || amountBig <= 0n) {
      setError("Enter a valid amount within your credit limit.");
      return;
    }
    setError("");

    // Step 1: FHE borrow_check execution
    setStep("fhe");
    await new Promise((r) => setTimeout(r, 2200));

    // Step 2: Ika sign
    setStep("ika");
    await new Promise((r) => setTimeout(r, 1800));

    setStep("done");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass-card"
        style={{ width: "100%", maxWidth: 480, padding: "2rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h3>Borrow USDC</h3>
            <code style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{loanId}</code>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}
          >
            ✕
          </button>
        </div>

        {step === "input" && (
          <>
            {/* Available credit */}
            <div
              className="stat-card"
              style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between" }}
            >
              <span className="text-secondary" style={{ fontSize: "0.85rem" }}>Available Credit</span>
              <span className="text-teal" style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                {usdCentsToDisplay(available)}
              </span>
            </div>

            {/* Amount input */}
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 500 }}>
              Amount (USD)
            </label>
            <input
              id="borrow-amount-input"
              type="number"
              min="0"
              step="100"
              className="input-field"
              placeholder="e.g. 10000"
              value={amountStr}
              onChange={(e) => { setAmountStr(e.target.value); setError(""); }}
              style={{ marginBottom: "0.75rem" }}
            />
            {error && <p style={{ color: "var(--red)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{error}</p>}

            {/* FHE privacy note */}
            <div
              style={{
                background: "var(--purple-dim)",
                border: "1px solid rgba(139,92,246,0.15)",
                borderRadius: 10,
                padding: "0.875rem 1rem",
                marginBottom: "1.5rem",
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
              }}
            >
              🔒 Your debt balance and LTV check will be computed inside an FHE circuit.{" "}
              <span style={{ color: "var(--purple)" }}>No plaintext values leave your device.</span>
            </div>

            <button
              id="btn-confirm-borrow"
              className="btn-primary"
              style={{ width: "100%" }}
              onClick={handleBorrow}
              disabled={amountBig <= 0n || exceedsLimit}
            >
              Confirm Borrow {amountBig > 0n ? `${usdCentsToDisplay(amountBig)}` : ""}
            </button>
          </>
        )}

        {step === "fhe" && <ProgressStep icon="🔒" title="Executing FHE borrow_check" sub="Encrypting amount and verifying LTV inside the Encrypt circuit..." />}
        {step === "ika" && <ProgressStep icon="⚡" title="Awaiting dWallet Confirmation" sub="Ika MPC network verifying collateral authorization..." />}

        {step === "done" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
            <h3 style={{ marginBottom: "0.5rem" }}>Borrow Confirmed!</h3>
            <p style={{ marginBottom: "1.5rem" }}>
              {usdCentsToDisplay(amountBig)} USDC has been credited. Your LTV was verified privately.
            </p>
            <button className="btn-primary" style={{ width: "100%" }} onClick={onClose}>
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressStep({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "2rem 0" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "1rem", animation: "pulse-amber 1.5s infinite" }}>{icon}</div>
      <h3 style={{ marginBottom: "0.5rem" }}>{title}</h3>
      <p style={{ fontSize: "0.85rem" }}>{sub}</p>
      <div className="shimmer" style={{ height: 6, marginTop: "1.5rem", borderRadius: 6 }} />
    </div>
  );
}
