"use client";

import { useEffect, useState } from "react";

interface Stat {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}

const DEMO_STATS: Stat[] = [
  { label: "Total Value Locked", value: "$0", sub: "Protocol launch", accent: "var(--amber)" },
  { label: "Active Credit Lines", value: "0", sub: "Open positions", accent: "var(--teal)" },
  { label: "FHE Operations", value: "0", sub: "Verified on-chain", accent: "var(--purple)" },
  { label: "dWallet Signatures", value: "0", sub: "MPC approvals", accent: "var(--amber)" },
];

export function ProtocolStats() {
  const [stats] = useState<Stat[]>(DEMO_STATS);

  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto 3rem",
        padding: "0 1.5rem",
      }}
    >
      <div
        className="glass-card"
        style={{
          padding: "1.5rem 2rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {stats.map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: s.accent,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "-0.04em",
              }}
            >
              {s.value}
            </div>
            <div style={{ fontWeight: 600, fontSize: "0.8rem", marginTop: "0.25rem" }}>{s.label}</div>
            {s.sub && <div className="text-muted" style={{ fontSize: "0.72rem", marginTop: "0.1rem" }}>{s.sub}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
