"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState } from "react";

interface Pool {
  id: string;
  asset: string;
  totalDebt: string;
  liquidity: string;
  utilization: number;
  apy: string;
  loanCount: number;
}

const DEMO_POOLS: Pool[] = [
  {
    id: "pool_btc_main",
    asset: "BTC / USDC",
    totalDebt: "$0",
    liquidity: "$0",
    utilization: 0,
    apy: "—",
    loanCount: 0,
  },
];

function PoolCard({ pool }: { pool: Pool }) {
  const [depositing, setDepositing] = useState(false);

  return (
    <div className="glass-card" style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 40, height: 40, borderRadius: 10,
              background: "linear-gradient(135deg, var(--amber-dim), var(--teal-dim))",
              border: "1px solid var(--border-glow)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.2rem",
            }}
          >₿</div>
          <div>
            <div style={{ fontWeight: 700 }}>{pool.asset}</div>
            <code style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{pool.id}</code>
          </div>
        </div>
        <span className="badge badge-teal">{pool.loanCount} Loans</span>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
        {[
          { label: "Total Debt", value: pool.totalDebt, color: "var(--text-primary)" },
          { label: "Available", value: pool.liquidity, color: "var(--teal)" },
          { label: "Utilization", value: `${pool.utilization}%`, color: pool.utilization > 70 ? "var(--red)" : "var(--amber)" },
          { label: "Lender APY", value: pool.apy, color: "var(--green)" },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div className="text-muted" style={{ fontSize: "0.7rem", marginBottom: "0.2rem" }}>{label}</div>
            <div style={{ fontWeight: 700, color, fontFamily: "var(--font-mono), monospace" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Utilization bar */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div className="progress-track">
          <div
            className={`progress-fill${pool.utilization > 70 ? " danger" : ""}`}
            style={{ width: `${pool.utilization}%` }}
          />
        </div>
      </div>

      {/* FHE note */}
      <div
        style={{
          background: "var(--teal-dim)",
          border: "1px solid rgba(0,201,167,0.12)",
          borderRadius: 8,
          padding: "0.75rem 1rem",
          fontSize: "0.78rem",
          color: "var(--text-secondary)",
          marginBottom: "1.25rem",
        }}
      >
        🔒 Total debt is stored as an FHE ciphertext — pool utilization is computed privately.
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button id={`btn-deposit-${pool.id}`} className="btn-primary" disabled>
          Deposit Liquidity
        </button>
        <button id={`btn-withdraw-${pool.id}`} className="btn-secondary" disabled>
          Withdraw
        </button>
      </div>
    </div>
  );
}

export function PoolsPage() {
  const { connected } = useWallet();

  return (
    <main className="z-content min-h-screen">
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "4rem 1.5rem" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2rem" }}>Liquidity Pools</h1>
          <p style={{ marginTop: "0.5rem" }}>
            Provide USDC liquidity to earn yield from confidential lending activity.
          </p>
        </div>

        {!connected && (
          <div
            className="glass-card"
            style={{ padding: "1.5rem", marginBottom: "2rem", display: "flex", alignItems: "center", gap: "1rem" }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Connect to manage positions</div>
              <p style={{ fontSize: "0.85rem" }}>View live pool stats and deposit liquidity.</p>
            </div>
            <WalletMultiButton />
          </div>
        )}

        <div style={{ display: "grid", gap: "1.25rem" }}>
          {DEMO_POOLS.map((pool) => (
            <PoolCard key={pool.id} pool={pool} />
          ))}
        </div>
      </div>
    </main>
  );
}
