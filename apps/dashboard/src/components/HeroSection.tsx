"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

export function HeroSection() {
  const { connected } = useWallet();

  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "6rem 1.5rem 4rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "2rem",
      }}
    >
      {/* Sponsor badge row */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <span className="badge badge-amber">⚡ Encrypt FHE</span>
        <span className="badge badge-purple">🔐 Ika dWallet</span>
        <span className="badge badge-teal">◎ Solana</span>
      </div>

      {/* Headline */}
      <div>
        <h1 style={{ maxWidth: 780 }}>
          Confidential Credit Lines{" "}
          <span className="text-amber glow-amber">Backed by Native BTC</span>
        </h1>
        <p
          style={{
            marginTop: "1.25rem",
            fontSize: "1.125rem",
            maxWidth: 620,
            margin: "1.25rem auto 0",
          }}
        >
          Borrow USDC against BTC collateral with{" "}
          <span className="text-teal">FHE-encrypted LTV checks</span> — your debt stays
          private. Collateral is secured by <span className="text-purple">Ika dWallet</span>{" "}
          MPC signing: no bridges, no custodians, no trust.
        </p>
      </div>

      {/* CTA */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        {connected ? (
          <Link href="/borrow" className="btn-primary" style={{ textDecoration: "none" }}>
            Open Credit Line →
          </Link>
        ) : (
          <WalletMultiButton />
        )}
        <Link href="/proofs" className="btn-secondary" style={{ textDecoration: "none" }}>
          View Proof Log
        </Link>
      </div>

      {/* Trust indicators */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1rem",
          maxWidth: 680,
          width: "100%",
          marginTop: "1rem",
        }}
      >
        {[
          { icon: "🔒", label: "FHE-Private LTV", sub: "Encrypted on-chain" },
          { icon: "⛓", label: "MPC-Secured BTC", sub: "No bridge required" },
          { icon: "⚡", label: "Instant Liquidity", sub: "USDC in seconds" },
        ].map(({ icon, label, sub }) => (
          <div key={label} className="stat-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{icon}</div>
            <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{label}</div>
            <div style={{ fontSize: "0.75rem" }} className="text-muted">{sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
