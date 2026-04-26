"use client";

import { Navbar } from "@/components/Navbar";

interface ProofEvent {
  id: string;
  type: "fhe_borrow" | "fhe_repay" | "fhe_policy" | "ika_approve" | "decrypt_verify";
  loan: string;
  ts: string;
  details: string;
  txSig?: string;
  badge: string;
  badgeClass: string;
}

// Demo proof log
const DEMO_EVENTS: ProofEvent[] = [
  {
    id: "evt-001",
    type: "fhe_borrow",
    loan: "7xKm...mPQ",
    ts: "2026-04-26 16:42:11 UTC",
    details: "borrow_check FHE graph executed. Inputs: debt_ct, pool_ct, collateral_ct, amount_ct. Outputs: new_debt_ct, new_pool_ct, actual_ct.",
    txSig: "3dF7...aQ1",
    badge: "⚡ FHE Op",
    badgeClass: "badge-teal",
  },
  {
    id: "evt-002",
    type: "decrypt_verify",
    loan: "7xKm...mPQ",
    ts: "2026-04-26 16:42:44 UTC",
    details: "Decryption request created. Pending digest: 0xAB4C...1F2E. Encrypt network processing.",
    txSig: "9qR2...bL4",
    badge: "🔒 Decrypt",
    badgeClass: "badge-purple",
  },
  {
    id: "evt-003",
    type: "fhe_policy",
    loan: "7xKm...mPQ",
    ts: "2026-04-26 16:43:01 UTC",
    details: "release_policy graph executed. Policy bit decrypted = 1. On-chain digest verified.",
    txSig: "5kT9...xM7",
    badge: "📋 Policy",
    badgeClass: "badge-amber",
  },
  {
    id: "evt-004",
    type: "ika_approve",
    loan: "7xKm...mPQ",
    ts: "2026-04-26 16:43:18 UTC",
    details: "approve_message CPI called. Signature scheme: EcdsaDoubleSha256 (2). MessageApproval PDA created. Ika MPC signing initiated.",
    txSig: "7pW3...nK8",
    badge: "✍️ Signed",
    badgeClass: "badge-purple",
  },
];

function ProofRow({ evt }: { evt: ProofEvent }) {
  return (
    <div
      className="glass-card"
      style={{ padding: "1.25rem 1.5rem" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className={`badge ${evt.badgeClass}`}>{evt.badge}</span>
          <code style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Loan {evt.loan}</code>
        </div>
        <time style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
          {evt.ts}
        </time>
      </div>
      <p style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>{evt.details}</p>
      {evt.txSig && (
        <div style={{ marginTop: "0.75rem" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Tx: </span>
          <code
            style={{
              fontSize: "0.72rem",
              color: "var(--teal)",
              cursor: "pointer",
            }}
          >
            {evt.txSig}
          </code>
        </div>
      )}
    </div>
  );
}

export function ProofsPage() {
  return (
    <main className="z-content min-h-screen">
      <Navbar />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "4rem 1.5rem" }}>
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2rem" }}>Proof Explorer</h1>
          <p style={{ marginTop: "0.5rem" }}>
            Every FHE operation, decryption verification, and Ika signature approval recorded on-chain.
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2rem" }}>
          <span className="badge badge-teal">⚡ FHE Op</span>
          <span className="badge badge-purple">🔒 Decrypt</span>
          <span className="badge badge-amber">📋 Policy</span>
          <span className="badge badge-purple">✍️ Ika Approve</span>
          <span style={{ marginLeft: "auto", fontSize: "0.8rem" }} className="text-muted">
            Demo data — connect wallet for live events
          </span>
        </div>

        {/* Event log */}
        <div style={{ display: "grid", gap: "1rem" }}>
          {DEMO_EVENTS.map((evt) => (
            <ProofRow key={evt.id} evt={evt} />
          ))}
        </div>

        {/* Technical summary */}
        <div
          className="glass-card"
          style={{ marginTop: "2rem", padding: "1.5rem" }}
        >
          <h3 style={{ marginBottom: "1rem" }}>Protocol Guarantees</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            {[
              { label: "FHE Computation", value: "On-chain, verifiable", color: "var(--teal)" },
              { label: "Digest Verification", value: "On-chain, canonical", color: "var(--teal)" },
              { label: "Signing Authority", value: "Ika MPC, threshold", color: "var(--purple)" },
              { label: "Debt Visibility", value: "Encrypted always", color: "var(--amber)" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-muted" style={{ fontSize: "0.72rem", marginBottom: "0.25rem" }}>{label}</div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
