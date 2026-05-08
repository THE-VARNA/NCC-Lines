"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fetchPoolState } from "@/lib/onchain";
import { ENCRYPT_PROGRAM_ID, IKA_DWALLET_PROGRAM_ID } from "@/lib/constants";

const PILLARS = [
  {
    icon: "🔒",
    label: "FHE-Encrypted LTV",
    sub: "Debt stays private on-chain",
    color: "var(--cyan)",
    glow: "rgba(34,211,238,0.08)",
    border: "rgba(34,211,238,0.2)",
    accent: "#22d3ee",
  },
  {
    icon: "₿",
    label: "Native BTC Custody",
    sub: "No bridges. No wrapping.",
    color: "var(--amber)",
    glow: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
    accent: "#f59e0b",
  },
  {
    icon: "⚡",
    label: "Liquid on Solana",
    sub: "Receive native USDC directly",
    color: "var(--violet)",
    glow: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.2)",
    accent: "#a855f7",
  },
];


export function HeroSection() {
  const { connected } = useWallet();
  const [poolStatus, setPoolStatus] = useState<"checking" | "live" | "offline">("checking");

  useEffect(() => {
    import("@solana/web3.js").then(({ Connection, clusterApiUrl }) => {
      const conn = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl("devnet"));
      fetchPoolState(conn)
        .then(p => setPoolStatus(p.exists ? "live" : "offline"))
        .catch(() => setPoolStatus("offline"));
    });
  }, []);

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
  };

  return (
    <section className="z-base" style={{
      padding: "clamp(5.5rem, 13vw, 10rem) 0 clamp(3.5rem, 8vw, 7rem)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Layered orbs */}
      <div aria-hidden style={{
        position: "absolute", top: "-15%", left: "-5%",
        width: 700, height: 700,
        background: "radial-gradient(circle at center, rgba(34,211,238,0.06) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div aria-hidden style={{
        position: "absolute", top: "5%", right: "-8%",
        width: 600, height: 600,
        background: "radial-gradient(circle at center, rgba(168,85,247,0.07) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />
      <div aria-hidden style={{
        position: "absolute", bottom: "-5%", left: "30%",
        width: 800, height: 350,
        background: "radial-gradient(ellipse at center, rgba(245,158,11,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      {/* Grid overlay */}
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        pointerEvents: "none",
        maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%)",
      }} />

      <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "2.75rem" }}>

        {/* Sponsor badges */}
        <motion.div
          variants={containerVariants} initial="hidden" animate="show"
          style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}
        >
          {[
            { label: "Encrypt FHE", dot: "dot-cyan", color: "#22d3ee" },
            { label: "Ika dWallet", dot: "dot-amber", color: "#f59e0b" },
            { label: "Solana Devnet", dot: "dot-green", color: "#4ade80" },
          ].map(({ label, dot, color }) => (
            <motion.span key={label} variants={itemVariants} className="pill" style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${color}30`,
              backdropFilter: "blur(8px)",
            }}>
              <span className={`dot ${dot}`} style={{ width: 6, height: 6 }} />
              {label}
            </motion.span>
          ))}
        </motion.div>

        {/* Headline */}
        <motion.div
          variants={itemVariants} initial="hidden" animate="show"
          transition={{ delay: 0.2 }}
          style={{ maxWidth: 900 }}
        >
          <h1 style={{ lineHeight: 1.06, letterSpacing: "-0.035em" }}>
            Confidential Credit Lines{" "}
            <br />
            <span style={{
              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 45%, #d97706 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 48px rgba(245,158,11,0.45))",
            }}>
              Backed by Native BTC
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.6 }}
            style={{
              marginTop: "1.5rem",
              fontSize: "clamp(1.0625rem, 2vw, 1.2rem)",
              maxWidth: 680,
              margin: "1.5rem auto 0",
              color: "var(--text-1)",
              lineHeight: 1.75,
            }}
          >
            Borrow Solana USDC against Bitcoin with{" "}
            <span style={{ color: "var(--cyan)", fontWeight: 600 }}>FHE-encrypted LTV checks</span>
            {" "}— keeping your debt position entirely private. Your collateral remains on the Bitcoin network, secured by an{" "}
            <span style={{ color: "var(--violet)", fontWeight: 600 }}>Ika dWallet MPC</span>
            {" "}— no bridges, no wrapped tokens.
          </motion.p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}
          style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap", justifyContent: "center" }}
        >
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
        </motion.div>

        {/* Pillar cards — glassmorphic */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", width: "100%", maxWidth: 680 }}>
          {PILLARS.map(({ icon, label, sub, color, glow, border, accent }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 + i * 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              whileHover={{ y: -5, boxShadow: `0 12px 40px ${glow}, 0 0 1px ${border}` }}
              style={{
                background: `linear-gradient(135deg, ${glow}, rgba(255,255,255,0.02))`,
                border: `1px solid ${border}`,
                borderRadius: "var(--r-lg)",
                padding: "1.5rem 1.25rem",
                textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                cursor: "default",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: `${glow}`,
                border: `1px solid ${border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.375rem",
              }}>{icon}</div>
              <span style={{ fontWeight: 700, fontSize: "0.8125rem", color }}>{label}</span>
              <span style={{ fontSize: "0.6875rem", color: "var(--text-2)", lineHeight: 1.5 }}>{sub}</span>
            </motion.div>
          ))}
        </div>

        {/* Network status */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}
          style={{
            display: "flex", alignItems: "center", gap: "1rem",
            flexWrap: "wrap", justifyContent: "center",
            padding: "0.625rem 1.5rem",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "var(--r-full)",
            fontSize: "0.6875rem",
            color: "var(--text-2)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span className={`dot ${poolStatus === "live" ? "dot-green" : poolStatus === "checking" ? "dot-cyan" : "dot-red"}`} />
            Pool {poolStatus === "live" ? "Live" : poolStatus === "checking" ? "Syncing..." : "Offline"}
          </span>
          <span style={{ color: "var(--border-2)" }}>·</span>
          <span>Encrypt <code style={{ color: "#22d3ee", fontSize: "0.6rem" }}>{ENCRYPT_PROGRAM_ID.slice(0, 8)}...</code></span>
          <span style={{ color: "var(--border-2)" }}>·</span>
          <span>Ika <code style={{ color: "#a855f7", fontSize: "0.6rem" }}>{IKA_DWALLET_PROGRAM_ID.slice(0, 8)}...</code></span>
          <span style={{ color: "var(--border-2)" }}>·</span>
          <span style={{ color: "#4ade80", fontWeight: 600 }}>Devnet</span>
        </motion.div>

      </div>
    </section>
  );
}
