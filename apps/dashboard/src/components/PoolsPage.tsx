"use client";

import { Navbar } from "@/components/Navbar";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { fetchPoolState, type PoolState } from "@/lib/onchain";
import { PROGRAM_ID } from "@/lib/constants";
import { explorerAddress } from "@/lib/constants";

function UtilBar({ pct }: { pct: number }) {
  const color = pct > 70 ? "var(--red)" : pct > 45 ? "var(--amber)" : "var(--cyan)";
  const fillClass = pct > 70 ? "danger" : pct > 45 ? "warn" : "";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <span className="metric-label">Utilization</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color }}>
          {pct > 0 ? `${pct}%` : "—"}
        </span>
      </div>
      <div className="progress">
        <motion.div
          className={`progress-fill ${fillClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}

function PoolCard({ pool }: { pool: PoolState }) {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      style={{ padding: "clamp(1.25rem, 3vw, 1.75rem)", position: "relative", overflow: "hidden" }}
    >
      {/* Top accent */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: pool.paused
          ? "var(--border-1)"
          : "linear-gradient(90deg, var(--amber), var(--cyan))",
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
          <div style={{
            width: 46, height: 46, borderRadius: "var(--r-md)",
            background: "linear-gradient(135deg, var(--amber-glow), var(--cyan-glow))",
            border: "1px solid var(--border-amber)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.375rem",
          }}>₿</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-0)" }}>BTC / USDC</div>
            <code style={{ fontSize: "0.6875rem", color: "var(--text-3)" }}>btc_main_v1</code>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
          <span className={pool.paused ? "badge badge-red" : "badge badge-green"}>
            {pool.paused ? "Paused" : "Active"}
          </span>
          <span className="badge badge-cyan">{pool.loanCount} Loans</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid-4" style={{ marginBottom: "1.25rem", gap: "0.75rem" }}>
        {[
          { label: "Total Loans",     value: pool.loanCount.toString(),                color: "var(--text-0)" },
          { label: "Debt CT Account", value: pool.debtCtPubkey ? pool.debtCtPubkey.slice(0, 8) + "..." : "None (debug path)", color: "var(--cyan)" },
          { label: "Pool PDA",        value: pool.poolPda.slice(0, 8) + "...",          color: "var(--amber)" },
          { label: "Collateral",      value: "BTC (Native)",                             color: "var(--amber)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-flat" style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="metric-label">{label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.85rem", color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Utilization — unknown on pre-alpha (debt is FHE encrypted) */}
      <UtilBar pct={0} />

      {/* FHE note */}
      <div style={{
        background: "var(--cyan-glow)", border: "1px solid rgba(34,211,238,0.15)",
        borderRadius: "var(--r-sm)", padding: "0.625rem 0.875rem",
        fontSize: "0.75rem", color: "var(--text-2)", lineHeight: 1.5,
        marginTop: "1.25rem", marginBottom: "1.25rem",
      }}>
        🔒 Debt ciphertext:{" "}
        {pool.debtCtPubkey ? (
          <a href={explorerAddress(pool.debtCtPubkey)} target="_blank" rel="noreferrer"
             style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
            {pool.debtCtPubkey.slice(0, 12)}... ↗
          </a>
        ) : (
          <span style={{ color: "var(--text-3)" }}>Not set — pool seeded via debug path (IX=100)</span>
        )}
      </div>

      {/* Explorer link */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <a href={explorerAddress(pool.poolPda)} target="_blank" rel="noreferrer"
           className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
          View Pool on Explorer ↗
        </a>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span className="dot" style={{
            width: 6, height: 6,
            background: pool.paused ? "var(--text-3)" : "var(--green)",
          }} />
          <span style={{ fontSize: "0.6875rem", color: "var(--text-3)" }}>
            {pool.paused ? "Pool paused" : "Accepting loans"}
          </span>
        </span>
      </div>
    </motion.div>
  );
}

function PoolNotFound() {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: "3rem", textAlign: "center", border: "1px solid rgba(244,63,94,0.2)" }}
    >
      <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠</div>
      <h3 style={{ marginBottom: "0.5rem", color: "var(--amber)" }}>Pool PDA Not Found</h3>
      <p style={{ fontSize: "0.875rem", color: "var(--text-2)", maxWidth: 400, margin: "0 auto 1.5rem" }}>
        The BTC/USDC pool PDA (<code style={{ color: "var(--cyan)", fontSize: "0.75rem" }}>btc_main_v1</code>) has not
        been seeded on devnet yet. Run <code style={{ color: "var(--amber)" }}>node seed-pool.js</code> to initialize it
        using the <code>debug_seed_pool</code> (IX=100) instruction.
      </p>
      <a href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
         target="_blank" rel="noreferrer"
         className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>
        View Program on Explorer ↗
      </a>
    </motion.div>
  );
}

export function PoolsPage() {
  const { connected } = useWallet();
  const { connection } = useConnection();
  const [pool, setPool] = useState<PoolState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const poolState = await fetchPoolState(connection);
        if (!cancelled) setPool(poolState);
      } catch {
        if (!cancelled) setPool(null);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [connection]);

  return (
    <main className="z-content min-h-screen" style={{ display: "flex", flexDirection: "column" }}>
      <Navbar />

      {/* Ambient */}
      <div aria-hidden style={{
        position: "fixed", top: "5%", right: "10%", width: 450, height: 450,
        background: "radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        style={{ position: "relative", zIndex: 1, flex: 1, maxWidth: 1000, margin: "0 auto", width: "100%", padding: "clamp(2.5rem, 6vw, 4rem) clamp(1rem, 4vw, 2rem)" }}
      >
        {/* Page header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span className="pill">
              <span className="dot dot-green" style={{ width: 6, height: 6 }} />
              Liquidity Pools · Devnet Live
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", marginBottom: "0.625rem" }}>Liquidity Pools</h1>
          <p style={{ color: "var(--text-2)", maxWidth: 540 }}>
            Real-time on-chain pool state read from Solana devnet.
            Debt balances are FHE-encrypted via Encrypt — only the ciphertext account pubkey is visible.
          </p>
        </div>

        {/* Summary stats — real data */}
        <div className="grid-3" style={{ marginBottom: "2rem", gap: "1rem" }}>
          {[
            { label: "Total Loans",     value: loading ? "..." : pool?.exists ? pool.loanCount.toString() : "0",   color: "var(--amber)", icon: "₿" },
            { label: "Pool Status",     value: loading ? "..." : pool?.exists ? (pool.paused ? "Paused" : "Active") : "Not Found", color: "var(--cyan)",  icon: "🔒" },
            { label: "Program",         value: `${PROGRAM_ID.slice(0, 8)}...`,                                       color: "var(--green)", icon: "⚡" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{
                width: 42, height: 42, borderRadius: "var(--r-sm)",
                background: `${color}15`, border: `1px solid ${color}28`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.125rem", flexShrink: 0,
              }}>{icon}</div>
              <div>
                <div className="metric-label">{label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "1.125rem", color, marginTop: "0.2rem" }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Wallet connect banner */}
        {!connected && (
          <div className="card" style={{
            padding: "1.25rem 1.5rem", marginBottom: "1.75rem",
            display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap",
            border: "1px solid var(--border-amber)",
            background: "var(--amber-glow)",
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, marginBottom: "0.25rem", color: "var(--amber-light)" }}>Connect to manage positions</div>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>View your live loan PDAs and open new credit lines.</p>
            </div>
            <ClientWalletButton />
          </div>
        )}

        {/* Pool card */}
        {loading ? (
          <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
            <div className="dot dot-cyan" style={{ width: 8, height: 8, margin: "0 auto 1rem" }} />
            <p style={{ color: "var(--text-2)" }}>Fetching Pool PDA from Solana devnet...</p>
          </div>
        ) : pool?.exists ? (
          <PoolCard pool={pool} />
        ) : (
          <PoolNotFound />
        )}

        {/* Protocol guarantees */}
        <div className="card" style={{ marginTop: "2rem", padding: "1.5rem", border: "1px solid var(--border-cyan)" }}>
          <h3 style={{ marginBottom: "1.25rem", fontSize: "1rem" }}>Protocol Guarantees</h3>
          <div className="grid-4" style={{ gap: "1rem" }}>
            {[
              { label: "Debt Storage",   value: "FHE EUint64 ciphertext", color: "var(--cyan)" },
              { label: "LTV Checks",     value: "On-chain FHE circuit",   color: "var(--cyan)" },
              { label: "BTC Custody",    value: "Ika dWallet MPC",        color: "var(--violet)" },
              { label: "Signing Scheme", value: "EcdsaDoubleSha256",      color: "var(--amber)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <span className="metric-label">{label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.8125rem", color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      <Footer />
    </main>
  );
}
