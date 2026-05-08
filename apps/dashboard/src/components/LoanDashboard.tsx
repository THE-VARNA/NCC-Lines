"use client";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { fetchLoansByBorrower, type LoanAccount } from "@/lib/onchain";
import { explorerAddress } from "@/lib/constants";

export function LoanDashboard() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!connected || !publicKey) {
        setLoans([]);
        setLoading(false);
        return;
      }
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
      <section className="z-base section-sm" style={{ background: "var(--surface-1)", borderTop: "1px solid var(--border-1)" }}>
        <div className="container" style={{ textAlign: "center", padding: "4rem 0" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "var(--surface-2)",
            border: "1px solid var(--border-2)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem", margin: "0 auto 1.5rem",
          }}>🔒</div>
          <h2 style={{ marginBottom: "1rem" }}>Your Credit Lines</h2>
          <p style={{ color: "var(--text-2)", maxWidth: 400, margin: "0 auto 2rem" }}>
            Connect your wallet to view your active FHE-encrypted credit lines and dWallet vaults.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ClientWalletButton />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="z-base section-sm" style={{ background: "var(--surface-1)", borderTop: "1px solid var(--border-1)", borderBottom: "1px solid var(--border-1)" }}>
      <div className="container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem" }}>Your Credit Lines</h2>
          <span className="badge badge-cyan">{loans.length} Positions</span>
        </div>

        {loading && loans.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", border: "1px dashed var(--border-2)", borderRadius: "var(--r-lg)" }}>
            <div className="dot dot-cyan" style={{ width: 8, height: 8, margin: "0 auto 1rem" }} />
            <p style={{ color: "var(--text-2)" }}>Scanning devnet for your loan PDAs...</p>
          </div>
        ) : loans.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", border: "1px dashed var(--border-2)", borderRadius: "var(--r-lg)" }}>
            <p style={{ color: "var(--text-2)", marginBottom: "1.5rem" }}>No active credit lines found for this wallet.</p>
            <a href="/borrow" className="btn btn-primary" style={{ textDecoration: "none" }}>Open Credit Line</a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <AnimatePresence>
              {loans.map((loan, i) => (
                <motion.div
                  key={loan.pubkey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card"
                  style={{ padding: "1.5rem" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>Loan #{loan.loanIndex}</span>
                        <span className={`badge ${loan.statusCode === 2 ? 'badge-green' : 'badge-amber'}`}>
                          {loan.statusLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
                        PDA: <a href={explorerAddress(loan.pubkey)} target="_blank" rel="noreferrer" style={{ color: "var(--text-2)" }}>{loan.pubkey.slice(0, 16)}...</a>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginBottom: "0.25rem" }}>Ika dWallet pubkey</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--violet)" }}>
                        <a href={explorerAddress(loan.dwalletPubkey)} target="_blank" rel="noreferrer" style={{ color: "var(--violet)" }}>{loan.dwalletPubkey.slice(0, 12)}...</a>
                      </div>
                    </div>
                  </div>

                  <div className="grid-2" style={{ gap: "1rem", background: "var(--surface-2)", padding: "1rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border-1)" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-2)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <span>🔒 Collateral Value CT</span>
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-1)" }}>
                        {loan.collateralCtPubkey === "11111111111111111111111111111111" ? "Zero / Uninitialized" : (
                          <a href={explorerAddress(loan.collateralCtPubkey)} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
                            {loan.collateralCtPubkey.slice(0, 16)}...
                          </a>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-2)", marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <span>🔒 Debt CT</span>
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-1)" }}>
                        {loan.debtCtPubkey === "11111111111111111111111111111111" ? "Zero / Uninitialized" : (
                          <a href={explorerAddress(loan.debtCtPubkey)} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
                            {loan.debtCtPubkey.slice(0, 16)}...
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}
