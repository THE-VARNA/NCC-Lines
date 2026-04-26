"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

const TRUST_ITEMS = [
  { icon: "🔒", label: "FHE-Encrypted LTV", sub: "On-chain, verifiable" },
  { icon: "⛓", label: "Native BTC Custody", sub: "No bridge required" },
  { icon: "⚡", label: "Instant USDC Credit", sub: "Sub-second settlement" },
];

const BADGE_DATA = [
  { label: "Encrypt FHE", class: "badge-teal" },
  { label: "Ika dWallet", class: "badge-purple" },
  { label: "Solana", class: "badge-amber" },
];

export function HeroSection() {
  const { connected } = useWallet();

  return (
    <section className="z-base" style={{ padding: "clamp(4rem, 10vw, 7rem) 0 clamp(3rem, 6vw, 5rem)" }}>
      <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "2rem" }}>

        {/* Sponsor badges */}
        <div className="animate-in" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center", animationDelay: "0ms" }}>
          {BADGE_DATA.map(b => (
            <span key={b.label} className={`badge ${b.class}`}>{b.label}</span>
          ))}
        </div>

        {/* Headline */}
        <div className="animate-in" style={{ animationDelay: "60ms", maxWidth: 820 }}>
          <h1>
            Confidential Credit Lines{" "}
            <br className="show-mobile-only" />
            <span className="c-amber glow-amber">Backed by Native BTC</span>
          </h1>
          <p style={{
            marginTop: "1.25rem",
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            maxWidth: 640,
            margin: "1.25rem auto 0",
            color: "var(--text-1)",
            lineHeight: 1.65,
          }}>
            Borrow USDC against BTC with{" "}
            <span className="c-teal" style={{ fontWeight: 600 }}>FHE-encrypted LTV checks</span>
            {" "}— debt stays private. Collateral secured by{" "}
            <span className="c-purple" style={{ fontWeight: 600 }}>Ika dWallet MPC</span>
            {" "}— no bridges, no custodians.
          </p>
        </div>

        {/* CTAs */}
        <div className="animate-in" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", animationDelay: "120ms", width: "100%" }}>
          {connected ? (
            <Link href="/borrow" className="btn btn-primary btn-lg" style={{ textDecoration: "none" }}>
              Open Credit Line →
            </Link>
          ) : (
            <WalletMultiButton />
          )}
          <Link href="/proofs" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            View Proof Log
          </Link>
        </div>

        {/* Trust indicators */}
        <div
          className="animate-in grid-3"
          style={{ width: "100%", maxWidth: 680, animationDelay: "180ms" }}
        >
          {TRUST_ITEMS.map(({ icon, label, sub }) => (
            <div
              key={label}
              className="card-flat"
              style={{ padding: "1.125rem 1rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}
            >
              <span style={{ fontSize: "1.375rem" }}>{icon}</span>
              <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--text-0)" }}>{label}</span>
              <span style={{ fontSize: "0.6875rem", color: "var(--text-2)" }}>{sub}</span>
            </div>
          ))}
        </div>

        {/* Network status */}
        <div className="animate-in" style={{ display: "flex", alignItems: "center", gap: "0.5rem", animationDelay: "240ms" }}>
          <span className="dot dot-green" />
          <span style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>
            Encrypt <code style={{ color: "var(--teal)", fontSize: "0.7rem" }}>4ebfzWd...</code>
            <span style={{ margin: "0 0.5rem", color: "var(--text-3)" }}>·</span>
            Ika dWallet <code style={{ color: "var(--purple)", fontSize: "0.7rem" }}>87W54kG...</code>
            <span style={{ margin: "0 0.5rem", color: "var(--text-3)" }}>·</span>
            devnet
          </span>
        </div>

      </div>
    </section>
  );
}
