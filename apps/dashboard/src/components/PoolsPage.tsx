"use client";

import { Navbar } from "@/components/Navbar";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { Footer } from "@/components/Footer";

interface Pool {
  id: string;
  asset: string;
  icon: string;
  totalDebt: string;
  liquidity: string;
  utilization: number;
  apy: string;
  loanCount: number;
  status: "Active" | "Paused";
}

const DEMO_POOLS: Pool[] = [
  {
    id: "pool_btc_main",
    asset: "BTC / USDC",
    icon: "₿",
    totalDebt: "$2,140,000",
    liquidity: "$4,280,000",
    utilization: 33,
    apy: "8.4%",
    loanCount: 47,
    status: "Active",
  },
  {
    id: "pool_btc_conservative",
    asset: "BTC / USDC (60% LTV)",
    icon: "🔐",
    totalDebt: "$980,000",
    liquidity: "$2,800,000",
    utilization: 21,
    apy: "5.9%",
    loanCount: 28,
    status: "Active",
  },
  {
    id: "pool_btc_institutional",
    asset: "BTC / USDC (Institutional)",
    icon: "🏛",
    totalDebt: "$0",
    liquidity: "$0",
    utilization: 0,
    apy: "—",
    loanCount: 0,
    status: "Paused",
  },
];

function UtilBar({ pct }: { pct: number }) {
  const color = pct > 70 ? "var(--red)" : pct > 45 ? "var(--amber)" : "var(--cyan)";
  const fillClass = pct > 70 ? "danger" : pct > 45 ? "warn" : "";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <span className="metric-label">Utilization</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div className="progress">
        <div className={`progress-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PoolCard({ pool }: { pool: Pool }) {
  return (
    <div className="card" style={{ padding: "clamp(1.25rem, 3vw, 1.75rem)", position: "relative", overflow: "hidden" }}>
      {/* Top accent */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: pool.status === "Paused"
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
          }}>{pool.icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-0)" }}>{pool.asset}</div>
            <code style={{ fontSize: "0.6875rem", color: "var(--text-3)" }}>{pool.id}</code>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
          <span className={pool.status === "Active" ? "badge badge-green" : "badge badge-red"}>
            {pool.status}
          </span>
          <span className="badge badge-cyan">{pool.loanCount} Loans</span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid-4" style={{ marginBottom: "1.25rem", gap: "0.75rem" }}>
        {[
          { label: "Total Debt",   value: pool.totalDebt,  color: "var(--text-0)" },
          { label: "Available",    value: pool.liquidity,   color: "var(--cyan)" },
          { label: "Lender APY",   value: pool.apy,         color: "var(--green)" },
          { label: "Collateral",   value: "BTC (Native)",   color: "var(--amber)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-flat" style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span className="metric-label">{label}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.9rem", color }}>{value}</span>
          </div>
        ))}
      </div>

      <UtilBar pct={pool.utilization} />

      {/* FHE privacy note */}
      <div style={{
        background: "var(--cyan-glow)", border: "1px solid rgba(34,211,238,0.15)",
        borderRadius: "var(--r-sm)", padding: "0.625rem 0.875rem",
        fontSize: "0.75rem", color: "var(--text-2)", lineHeight: 1.5,
        marginTop: "1.25rem", marginBottom: "1.25rem",
      }}>
        🔒 Total debt is stored as an <code style={{ color: "var(--cyan-light)" }}>EUint64</code> FHE ciphertext — pool utilization is computed privately via Encrypt.
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button id={`btn-deposit-${pool.id}`} className="btn btn-primary btn-sm" disabled={pool.status === "Paused"}>
          Deposit Liquidity
        </button>
        <button id={`btn-withdraw-${pool.id}`} className="btn btn-secondary btn-sm" disabled={pool.status === "Paused"}>
          Withdraw
        </button>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span className="dot" style={{
            width: 6, height: 6,
            background: pool.status === "Active" ? "var(--green)" : "var(--text-3)",
          }} />
          <span style={{ fontSize: "0.6875rem", color: "var(--text-3)" }}>
            {pool.status === "Active" ? "Accepting deposits" : "Pool paused"}
          </span>
        </span>
      </div>
    </div>
  );
}

export function PoolsPage() {
  const { connected } = useWallet();

  return (
    <main className="z-content min-h-screen" style={{ display: "flex", flexDirection: "column" }}>
      <Navbar />

      {/* Ambient */}
      <div aria-hidden style={{
        position: "fixed", top: "5%", right: "10%", width: 450, height: 450,
        background: "radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, flex: 1, maxWidth: 1000, margin: "0 auto", width: "100%", padding: "clamp(2.5rem, 6vw, 4rem) clamp(1rem, 4vw, 2rem)" }}>

        {/* Page header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span className="pill">
              <span className="dot dot-green" style={{ width: 6, height: 6 }} />
              Liquidity Pools
            </span>
          </div>
          <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", marginBottom: "0.625rem" }}>Liquidity Pools</h1>
          <p style={{ color: "var(--text-2)", maxWidth: 540 }}>
            Provide USDC liquidity to earn yield from confidential BTC lending. All debt balances are FHE-encrypted — your LP position is never exposed.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid-3" style={{ marginBottom: "2rem", gap: "1rem" }}>
          {[
            { label: "Total Liquidity",  value: "$7.08M",  color: "var(--amber)",  icon: "₿" },
            { label: "Total Debt",       value: "$3.12M",  color: "var(--cyan)",   icon: "🔒" },
            { label: "Active Pools",     value: "2 / 3",   color: "var(--green)",  icon: "⚡" },
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
              <p style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>View live pool stats and deposit USDC liquidity.</p>
            </div>
            <ClientWalletButton />
          </div>
        )}

        {/* Pool cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {DEMO_POOLS.map(pool => <PoolCard key={pool.id} pool={pool} />)}
        </div>

        {/* FHE architecture note */}
        <div className="card" style={{ marginTop: "2rem", padding: "1.5rem", border: "1px solid var(--border-cyan)" }}>
          <h3 style={{ marginBottom: "1.25rem", fontSize: "1rem" }}>Protocol Guarantees</h3>
          <div className="grid-4" style={{ gap: "1rem" }}>
            {[
              { label: "Debt Storage",      value: "FHE EUint64 ciphertext", color: "var(--cyan)" },
              { label: "LTV Checks",        value: "On-chain FHE circuit",   color: "var(--cyan)" },
              { label: "BTC Custody",       value: "Ika dWallet MPC",        color: "var(--violet)" },
              { label: "Signing Scheme",    value: "EcdsaDoubleSha256",      color: "var(--amber)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <span className="metric-label">{label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.8125rem", color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
