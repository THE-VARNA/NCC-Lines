"use client";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { fetchLoansByBorrower, type LoanAccount } from "@/lib/onchain";
import { explorerAddress } from "@/lib/constants";

const STATUS_CONFIG: Record<number, { label: string; color: string; bg: string; dot: string }> = {
  2: { label: "Active", color: "#4ade80", bg: "rgba(74,222,128,0.1)", dot: "dot-green" },
  1: { label: "Funded", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", dot: "dot-amber" },
  0: { label: "Pending", color: "#6b7280", bg: "rgba(107,114,128,0.1)", dot: "dot-gray" },
};

function LoanCard({ loan, index }: { loan: LoanAccount; index: number }) {
  const status = STATUS_CONFIG[loan.statusCode] ?? STATUS_CONFIG[0];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "var(--r-lg)",
        padding: "1.5rem",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* BTC icon */}
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.25rem",
          }}>₿</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-0)" }}>
              Loan #{loan.loanIndex}
            </div>
            <a
              href={explorerAddress(loan.pubkey)} target="_blank" rel="noreferrer"
              style={{ fontSize: "0.6875rem", color: "var(--text-3)", fontFamily: "var(--font-mono)", textDecoration: "none" }}
            >
              {loan.pubkey.slice(0, 8)}...{loan.pubkey.slice(-6)} ↗
            </a>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.375rem",
          background: status.bg,
          border: `1px solid ${status.color}30`,
          borderRadius: "var(--r-full)",
          padding: "0.25rem 0.75rem",
          fontSize: "0.75rem", fontWeight: 600, color: status.color,
        }}>
          <span className={`dot ${status.dot}`} style={{ width: 6, height: 6 }} />
          {status.label}
        </div>
      </div>

      {/* Ciphertext grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {[
          { icon: "🔒", label: "Collateral CT", value: loan.collateralCtPubkey, color: "#22d3ee" },
          { icon: "🔒", label: "Debt CT", value: loan.debtCtPubkey, color: "#a855f7" },
        ].map(({ icon, label, value, color }) => (
          <div key={label} style={{
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "var(--r-sm)",
            padding: "0.75rem",
          }}>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-2)", marginBottom: "0.375rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              {icon} {label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem" }}>
              {value === "11111111111111111111111111111111" ? (
                <span style={{ color: "var(--text-3)" }}>Uninitialized</span>
              ) : (
                <a href={explorerAddress(value)} target="_blank" rel="noreferrer"
                  style={{ color, textDecoration: "none" }}>
                  {value.slice(0, 10)}...{value.slice(-6)} ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ika dWallet */}
      <div style={{
        marginTop: "0.75rem",
        background: "rgba(168,85,247,0.04)",
        border: "1px solid rgba(168,85,247,0.12)",
        borderRadius: "var(--r-sm)",
        padding: "0.625rem 0.875rem",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "0.5rem",
      }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--text-2)" }}>🔑 Ika dWallet</span>
        <a href={explorerAddress(loan.dwalletPubkey)} target="_blank" rel="noreferrer"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "#a855f7", textDecoration: "none" }}>
          {loan.dwalletPubkey.slice(0, 10)}...{loan.dwalletPubkey.slice(-6)} ↗
        </a>
      </div>
    </motion.div>
  );
}

export function LoanDashboard() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!connected || !publicKey) { setLoans([]); setLoading(false); return; }
      setLoading(true);
      try {
        const fetched = await fetchLoansByBorrower(connection, publicKey);
        if (!cancelled) setLoans(fetched);
      } catch {
        if (!cancelled) setLoans([]);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    const interval = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [connected, publicKey, connection]);

  if (!connected) {
    return (
      <section className="z-base section-sm" style={{ borderTop: "1px solid var(--border-1)" }}>
        <div className="container" style={{ textAlign: "center", padding: "5rem 0" }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.75rem", margin: "0 auto 1.75rem",
            }}
          >🔒</motion.div>
          <h2 style={{ marginBottom: "1rem" }}>Your Credit Lines</h2>
          <p style={{ color: "var(--text-2)", maxWidth: 360, margin: "0 auto 2rem", lineHeight: 1.65 }}>
            Connect your wallet to view FHE-encrypted credit lines secured by Ika dWallet MPC.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ClientWalletButton />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="z-base section-sm" style={{ borderTop: "1px solid var(--border-1)" }}>
      <div className="container">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h2 style={{ fontSize: "1.25rem" }}>Your Credit Lines</h2>
            {loans.length > 0 && (
              <span style={{
                background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "var(--r-full)", padding: "0.125rem 0.625rem",
                fontSize: "0.75rem", fontWeight: 600, color: "var(--amber)",
              }}>{loans.length}</span>
            )}
          </div>
          <a href="/borrow" className="btn btn-primary" style={{ textDecoration: "none", fontSize: "0.8125rem", padding: "0.4rem 1rem" }}>
            + New Line
          </a>
        </div>

        {loading && loans.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: "var(--r-lg)" }}>
            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
              className="dot dot-cyan" style={{ width: 8, height: 8, margin: "0 auto 0.75rem" }} />
            <p style={{ color: "var(--text-3)", fontSize: "0.8125rem" }}>Scanning devnet…</p>
          </div>
        ) : loans.length === 0 ? (
          <div style={{
            padding: "2.5rem 2rem", textAlign: "center",
            border: "1px dashed rgba(255,255,255,0.07)", borderRadius: "var(--r-lg)",
            background: "rgba(255,255,255,0.01)",
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>₿</div>
            <p style={{ color: "var(--text-2)", marginBottom: "1.25rem", fontSize: "0.875rem" }}>No active credit lines yet.</p>
            <a href="/borrow" className="btn btn-primary" style={{ textDecoration: "none", fontSize: "0.8125rem" }}>Open Credit Line →</a>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <AnimatePresence mode="popLayout">
                {loans.slice(0, 3).map((loan, i) => {
                  const sc = STATUS_CONFIG[loan.statusCode] ?? STATUS_CONFIG[0];
                  return (
                    <motion.div
                      key={loan.pubkey}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.35 }}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.875rem",
                        padding: "0.875rem 1.125rem",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "var(--r-md)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                        background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.18)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem",
                      }}>₿</div>

                      {/* Label */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-0)" }}>
                          Loan #{loan.loanIndex}
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-3)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {loan.pubkey.slice(0, 12)}...{loan.pubkey.slice(-6)}
                        </div>
                      </div>

                      {/* Status */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: "0.3rem",
                        background: sc.bg, border: `1px solid ${sc.color}30`,
                        borderRadius: "var(--r-full)", padding: "0.2rem 0.625rem",
                        fontSize: "0.6875rem", fontWeight: 600, color: sc.color, flexShrink: 0,
                      }}>
                        <span className={`dot ${sc.dot}`} style={{ width: 5, height: 5 }} />
                        {sc.label}
                      </div>

                      {/* Explorer link */}
                      <a href={explorerAddress(loan.pubkey)} target="_blank" rel="noreferrer"
                        style={{ color: "var(--text-3)", textDecoration: "none", fontSize: "0.75rem", flexShrink: 0 }}>
                        ↗
                      </a>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* See all link */}
            {loans.length > 3 && (
              <div style={{ textAlign: "center", marginTop: "0.875rem" }}>
                <a href="/proofs" style={{
                  fontSize: "0.8125rem", color: "var(--text-2)", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: "0.375rem",
                }}>
                  See all {loans.length} positions →
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

