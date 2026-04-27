"use client";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useState } from "react";

interface ProofEvent {
  id: string;
  type: "fhe_borrow" | "fhe_repay" | "fhe_policy" | "ika_approve" | "decrypt_verify";
  loan: string;
  ts: string;
  details: string;
  txSig?: string;
  badge: string;
  badgeClass: string;
  color: string;
}

const DEMO_EVENTS: ProofEvent[] = [
  {
    id: "evt-001",
    type: "fhe_borrow",
    loan: "7xKm...mPQ",
    ts: "2026-04-26 16:42:11 UTC",
    details: "borrow_check FHE graph executed. Inputs: debt_ct, pool_ct, collateral_ct, amount_ct. Outputs: new_debt_ct, new_pool_ct, actual_ct. All values remain encrypted.",
    txSig: "3dF7...aQ1",
    badge: "⚡ FHE Op",
    badgeClass: "badge-cyan",
    color: "var(--cyan)",
  },
  {
    id: "evt-002",
    type: "decrypt_verify",
    loan: "7xKm...mPQ",
    ts: "2026-04-26 16:42:44 UTC",
    details: "Decryption request created via Encrypt network. Pending digest: 0xAB4C...1F2E. Result: policy_bit = 1 (approved). On-chain digest verified against expected hash.",
    txSig: "9qR2...bL4",
    badge: "🔒 Decrypt",
    badgeClass: "badge-violet",
    color: "var(--violet)",
  },
  {
    id: "evt-003",
    type: "fhe_policy",
    loan: "7xKm...mPQ",
    ts: "2026-04-26 16:43:01 UTC",
    details: "release_policy FHE graph executed. LTV check passed: ltv_ct < threshold_ct → policy_bit = 1. Collateral release approved. State: ReleaseCheckPending → FinalizeRelease.",
    txSig: "5kT9...xM7",
    badge: "📋 Policy",
    badgeClass: "badge-amber",
    color: "var(--amber)",
  },
  {
    id: "evt-004",
    type: "ika_approve",
    loan: "7xKm...mPQ",
    ts: "2026-04-26 16:43:18 UTC",
    details: "approve_message CPI called on Ika dWallet program (87W54kG...). Signature scheme: EcdsaDoubleSha256 (scheme_id: 2). MessageApproval PDA created. Ika MPC threshold signing initiated.",
    txSig: "7pW3...nK8",
    badge: "✍️ Ika Sign",
    badgeClass: "badge-violet",
    color: "var(--violet)",
  },
  {
    id: "evt-005",
    type: "fhe_repay",
    loan: "7xKm...mPQ",
    ts: "2026-04-26 16:44:02 UTC",
    details: "repay_check FHE graph executed. Inputs: debt_ct, amount_ct. Output: new_debt_ct (reduced). Encrypt CPI: compute_encrypted called. Pool liquidity restored.",
    txSig: "2mN5...vR9",
    badge: "↩ Repay FHE",
    badgeClass: "badge-green",
    color: "var(--green)",
  },
];

const TYPE_LABELS: Record<ProofEvent["type"], string> = {
  fhe_borrow:     "Borrow Check",
  fhe_repay:      "Repay Update",
  fhe_policy:     "Policy Check",
  ika_approve:    "Ika Signature",
  decrypt_verify: "Decrypt & Verify",
};

function ProofRow({ evt }: { evt: ProofEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card" style={{
      padding: "1.25rem 1.5rem",
      border: `1px solid ${evt.color}20`,
      cursor: "pointer",
      transition: "border-color var(--t-md), box-shadow var(--t-md)",
    }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Row header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", flex: 1 }}>
          <span className={`badge ${evt.badgeClass}`}>{evt.badge}</span>
          <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-0)" }}>
            {TYPE_LABELS[evt.type]}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
            Loan <code style={{ color: evt.color, fontSize: "0.7rem" }}>{evt.loan}</code>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          <time style={{
            fontSize: "0.6875rem", color: "var(--text-3)",
            fontFamily: "var(--font-mono)", whiteSpace: "nowrap",
          }}>
            {evt.ts}
          </time>
          <span style={{ color: "var(--text-3)", fontSize: "0.75rem", transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>
            ▾
          </span>
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${evt.color}20` }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", lineHeight: 1.75, marginBottom: "0.75rem" }}>
            {evt.details}
          </p>
          {evt.txSig && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="metric-label">Tx Signature</span>
              <code style={{ fontSize: "0.7rem", color: evt.color, letterSpacing: "0.01em" }}>{evt.txSig}</code>
              <span style={{
                fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "var(--text-3)",
                border: "1px solid var(--border-1)", borderRadius: "var(--r-full)",
                padding: "0.1rem 0.5rem",
              }}>devnet</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom accent */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: evt.color, borderRadius: "var(--r-lg) 0 0 var(--r-lg)",
        opacity: 0.6,
      }} />
    </div>
  );
}

export function ProofsPage() {
  const [filter, setFilter] = useState<"all" | ProofEvent["type"]>("all");

  const filtered = filter === "all"
    ? DEMO_EVENTS
    : DEMO_EVENTS.filter(e => e.type === filter);

  return (
    <main className="z-content min-h-screen" style={{ display: "flex", flexDirection: "column" }}>
      <Navbar />

      {/* Ambient */}
      <div aria-hidden style={{
        position: "fixed", top: "15%", left: "5%", width: 400, height: 400,
        background: "radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "clamp(2.5rem, 6vw, 4rem) clamp(1rem, 4vw, 2rem)" }}>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <span className="pill" style={{ marginBottom: "1rem", display: "inline-flex" }}>
            <span className="dot dot-cyan" style={{ width: 6, height: 6 }} />
            FHE Proof Explorer
          </span>
          <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", marginTop: "0.75rem", marginBottom: "0.625rem" }}>
            Proof Explorer
          </h1>
          <p style={{ color: "var(--text-2)", maxWidth: 560 }}>
            Every FHE computation, decryption verification, and Ika signature approval is recorded on-chain.
            Click any row to expand the full event details.
          </p>
        </div>

        {/* Legend + filter */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.75rem", alignItems: "center" }}>
          {[
            { key: "all",            label: "All Events",    cls: "" },
            { key: "fhe_borrow",     label: "⚡ FHE Op",     cls: "badge-cyan" },
            { key: "decrypt_verify", label: "🔒 Decrypt",    cls: "badge-violet" },
            { key: "fhe_policy",     label: "📋 Policy",     cls: "badge-amber" },
            { key: "ika_approve",    label: "✍️ Ika Sign",   cls: "badge-violet" },
            { key: "fhe_repay",      label: "↩ Repay",       cls: "badge-green" },
          ].map(({ key, label, cls }) => (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              className={cls ? `badge ${cls}` : "pill"}
              style={{
                cursor: "pointer", border: "none",
                outline: filter === key ? `2px solid var(--border-3)` : "none",
                outlineOffset: 2,
                opacity: filter === key ? 1 : 0.65,
                transition: "opacity var(--t-sm), outline var(--t-sm)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {label}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: "0.6875rem", color: "var(--text-3)", whiteSpace: "nowrap" }}>
            Demo data — connect wallet for live events
          </span>
        </div>

        {/* Event log */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", position: "relative" }}>
          {filtered.map(evt => <ProofRow key={evt.id} evt={evt} />)}
          {filtered.length === 0 && (
            <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔍</div>
              <p style={{ color: "var(--text-2)" }}>No events match this filter.</p>
            </div>
          )}
        </div>

        {/* Protocol guarantees */}
        <div className="card" style={{ marginTop: "2rem", padding: "1.5rem", border: "1px solid var(--border-cyan)" }}>
          <h3 style={{ marginBottom: "1.25rem", fontSize: "1rem" }}>Protocol Guarantees</h3>
          <div className="grid-4" style={{ gap: "1rem" }}>
            {[
              { label: "FHE Computation", value: "On-chain, verifiable", color: "var(--cyan)" },
              { label: "Digest Verification", value: "On-chain, canonical", color: "var(--cyan)" },
              { label: "Signing Authority", value: "Ika MPC, threshold", color: "var(--violet)" },
              { label: "Debt Visibility", value: "Encrypted always", color: "var(--amber)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <span className="metric-label">{label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "0.8125rem", color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live data note */}
        <div style={{
          marginTop: "1.25rem", textAlign: "center", display: "flex",
          alignItems: "center", justifyContent: "center", gap: "0.5rem",
          fontSize: "0.6875rem", color: "var(--text-3)",
        }}>
          <span className="dot dot-amber" />
          Showing demo proof events. Deploy program and connect wallet to view live on-chain events.
          Explorer: <code style={{ color: "var(--cyan)", fontSize: "0.65rem" }}>712fUCmQ...</code>
        </div>
      </div>
      <Footer />
    </main>
  );
}
