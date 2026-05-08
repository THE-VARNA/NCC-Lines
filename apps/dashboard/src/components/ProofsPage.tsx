"use client";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useConnection } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchProgramTxHistory, formatBlockTime, type TxRecord } from "@/lib/onchain";
import { explorerTx, PROGRAM_ID } from "@/lib/constants";

export function ProofsPage() {
  const { connection } = useConnection();
  const [history, setHistory] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const records = await fetchProgramTxHistory(connection, 25);
      if (!cancelled) {
        setHistory(records);
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [connection]);

  return (
    <main className="z-content min-h-screen" style={{ display: "flex", flexDirection: "column" }}>
      <Navbar />

      <div aria-hidden style={{
        position: "fixed", top: "10%", left: "5%", width: 500, height: 500,
        background: "radial-gradient(circle, rgba(168,85,247,0.04) 0%, transparent 60%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        style={{ position: "relative", zIndex: 1, flex: 1, maxWidth: 1000, margin: "0 auto", width: "100%", padding: "clamp(2.5rem, 6vw, 4rem) clamp(1rem, 4vw, 2rem)" }}
      >
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span className="pill">
              <span className="dot dot-green" style={{ width: 6, height: 6 }} />
              Live Devnet Proofs
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", marginBottom: "0.625rem" }}>Proof Event Log</h1>
          <p style={{ color: "var(--text-2)", maxWidth: 580 }}>
            Showing the last 25 transactions for the NCC Lines program (<code style={{ color: "var(--cyan)", fontSize: "0.8em" }}>{PROGRAM_ID.slice(0, 8)}...</code>).
            Every interaction is recorded natively on Solana.
          </p>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 2fr 1fr",
            padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-1)",
            background: "var(--surface-2)", fontSize: "0.75rem",
            fontWeight: 600, color: "var(--text-2)", letterSpacing: "0.05em", textTransform: "uppercase",
          }}>
            <div>Time (UTC)</div>
            <div>Transaction Signature</div>
            <div style={{ textAlign: "right" }}>Status</div>
          </div>

          <div style={{ padding: "0.5rem 0" }}>
            {loading && history.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <div className="dot dot-cyan" style={{ width: 8, height: 8, margin: "0 auto 1rem" }} />
                <p style={{ color: "var(--text-2)" }}>Fetching transaction history...</p>
              </div>
            ) : history.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-3)" }}>
                No transactions found for this program on devnet yet.
              </div>
            ) : (
              <AnimatePresence>
                {history.map((tx, i) => (
                  <motion.div
                    key={tx.signature}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ delay: i * 0.05 }}
                    style={{
                      display: "grid", gridTemplateColumns: "1fr 2fr 1fr",
                      padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-1)",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>
                      {formatBlockTime(tx.blockTime)}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>
                      <a href={explorerTx(tx.signature)} target="_blank" rel="noreferrer"
                         style={{ color: "var(--cyan)", textDecoration: "none" }}>
                        {tx.signature.slice(0, 48)}...
                      </a>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {tx.err ? (
                        <span className="badge badge-red">Failed</span>
                      ) : (
                        <span className="badge badge-green">Success</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </motion.div>
      <Footer />
    </main>
  );
}
