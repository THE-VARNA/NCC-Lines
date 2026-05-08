"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fetchPoolState } from "@/lib/onchain";
import { ENCRYPT_PROGRAM_ID, IKA_DWALLET_PROGRAM_ID } from "@/lib/constants";

const TRUST_ITEMS = [
  {
    icon: "🔒",
    label: "FHE-Encrypted LTV",
    sub: "Debt stays private on-chain",
    color: "var(--cyan)",
    glow: "var(--cyan-glow)",
    border: "rgba(34,211,238,0.18)",
  },
  {
    icon: "₿",
    label: "Native BTC Custody",
    sub: "No bridges. No wrapping.",
    color: "var(--amber)",
    glow: "var(--amber-glow)",
    border: "rgba(245,158,11,0.18)",
  },
  {
    icon: "⚡",
    label: "Instant USDC Credit",
    sub: "Sub-second settlement",
    color: "var(--violet)",
    glow: "var(--violet-glow)",
    border: "rgba(168,85,247,0.18)",
  },
];

export function HeroSection() {
  const { connected } = useWallet();
  const [poolStatus, setPoolStatus] = useState<"checking" | "live" | "offline">("checking");

  useEffect(() => {
    // Only connection isn't passed here, we'll just check if it returns
    // Since fetchPoolState requires connection, we can instantiate a quick one or just rely on the fallback
    import("@solana/web3.js").then(({ Connection, clusterApiUrl }) => {
      const conn = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl("devnet"));
      fetchPoolState(conn)
        .then(p => setPoolStatus(p.exists ? "live" : "offline"))
        .catch(() => setPoolStatus("offline"));
    });
  }, []);

  return (
    <section className="z-base" style={{
      padding: "clamp(5rem, 12vw, 9rem) 0 clamp(3rem, 7vw, 6rem)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Decorative orbs */}
      <div aria-hidden style={{
        position: "absolute", top: "-20%", left: "5%",
        width: 500, height: 500,
        background: "radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)",
        pointerEvents: "none", filter: "blur(1px)",
      }} />
      <div aria-hidden style={{
        position: "absolute", top: "10%", right: "5%",
        width: 400, height: 400,
        background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div aria-hidden style={{
        position: "absolute", bottom: "0%", left: "35%",
        width: 600, height: 300,
        background: "radial-gradient(ellipse, rgba(245,158,11,0.05) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "2.5rem" }}>

        {/* Sponsor pill badges */}
        <div className="animate-in" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          <span className="pill">
            <span className="dot dot-cyan" style={{ width: 6, height: 6 }} />
            Encrypt FHE
          </span>
          <span className="pill">
            <span className="dot dot-amber" style={{ width: 6, height: 6 }} />
            Ika dWallet
          </span>
          <span className="pill">
            <span style={{
              display: "inline-block", width: 10, height: 10,
              background: "linear-gradient(135deg,#9945ff,#14f195)",
              borderRadius: "50%",
            }} />
            Solana
          </span>
        </div>

        {/* Main headline */}
        <div className="animate-in delay-1" style={{ maxWidth: 880 }}>
          <h1 style={{ lineHeight: 1.08 }}>
            Confidential Credit Lines{" "}
            <br />
            <span style={{
              background: "linear-gradient(135deg, var(--amber-light) 0%, var(--amber) 40%, var(--amber-dark) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "none",
              filter: "drop-shadow(0 0 40px rgba(245,158,11,0.4))",
            }}>
              Backed by Native BTC
            </span>
          </h1>
          <p style={{
            marginTop: "1.5rem",
            fontSize: "clamp(1rem, 2.2vw, 1.2rem)",
            maxWidth: 660,
            margin: "1.5rem auto 0",
            color: "var(--text-1)",
            lineHeight: 1.7,
          }}>
            Borrow USDC against Bitcoin with{" "}
            <span style={{ color: "var(--cyan)", fontWeight: 600 }}>FHE-encrypted LTV checks</span>
            {" "}— debt stays private. Collateral secured by{" "}
            <span style={{ color: "var(--violet)", fontWeight: 600 }}>Ika dWallet MPC</span>
            {" "}— no bridges, no custodians.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="animate-in delay-2" style={{
          display: "flex", gap: "0.875rem", flexWrap: "wrap",
          justifyContent: "center", width: "100%",
        }}>
          {connected ? (
            <Link href="/borrow" id="btn-hero-borrow" className="btn btn-primary btn-xl" style={{ textDecoration: "none" }}>
              Open Credit Line →
            </Link>
          ) : (
            <ClientWalletButton />
          )}
          <Link href="/proofs" id="btn-hero-proofs" className="btn btn-secondary btn-xl" style={{ textDecoration: "none" }}>
            View Proof Log
          </Link>
        </div>

        {/* Trust card grid */}
        <div className="grid-3" style={{ width: "100%", maxWidth: 700 }}>
          {TRUST_ITEMS.map(({ icon, label, sub, color, glow, border }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
              style={{
                background: glow,
                border: `1px solid ${border}`,
                borderRadius: "var(--r-lg)",
                padding: "1.25rem 1rem",
                textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
                backdropFilter: "blur(12px)",
              }}
              whileHover={{ y: -3, boxShadow: `0 8px 32px ${glow}` }}
            >
              <span style={{ fontSize: "1.625rem" }}>{icon}</span>
              <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: color }}>{label}</span>
              <span style={{ fontSize: "0.6875rem", color: "var(--text-2)", lineHeight: 1.4 }}>{sub}</span>
            </motion.div>
          ))}
        </div>

        {/* Network status strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            flexWrap: "wrap", justifyContent: "center",
            padding: "0.5rem 1.25rem",
            background: "var(--surface-1)",
            border: "1px solid var(--border-1)",
            borderRadius: "var(--r-full)",
            fontSize: "0.6875rem",
            color: "var(--text-2)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span className={`dot ${poolStatus === 'live' ? 'dot-green' : poolStatus === 'checking' ? 'dot-cyan' : 'dot-red'}`} />
            Pool {poolStatus === 'live' ? 'Live' : poolStatus === 'checking' ? 'Checking...' : 'Offline'}
          </span>
          <span style={{ color: "var(--border-2)" }}>·</span>
          <span>Encrypt <code style={{ color: "var(--cyan)", fontSize: "0.65rem" }}>{ENCRYPT_PROGRAM_ID.slice(0, 7)}...</code></span>
          <span style={{ color: "var(--border-2)" }}>·</span>
          <span>Ika <code style={{ color: "var(--violet)", fontSize: "0.65rem" }}>{IKA_DWALLET_PROGRAM_ID.slice(0, 7)}...</code></span>
          <span style={{ color: "var(--border-2)" }}>·</span>
          <span style={{ color: "var(--green)", fontWeight: 600 }}>Pre-Alpha</span>
        </motion.div>

      </div>
    </section>
  );
}
