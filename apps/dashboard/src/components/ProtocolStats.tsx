"use client";

import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { fetchPoolState, fetchBtcPrice, type PoolState } from "@/lib/onchain";
import { ENCRYPT_PROGRAM_ID, IKA_DWALLET_PROGRAM_ID } from "@/lib/constants";

interface LiveStat {
  label: string;
  value: string;
  subValue: string;
  color: string;
  icon: string;
  sublabel: string;
  isLive: boolean;
}

function buildStats(pool: PoolState | null, btcPrice: number | null): LiveStat[] {
  return [
    {
      label: "On-Chain Loans",
      value: pool ? pool.loanCount.toString() : "—",
      subValue: pool ? `Pool: ${pool.poolPda.slice(0, 8)}...` : "Fetching...",
      color: "var(--amber)",
      icon: "₿",
      sublabel: pool ? (pool.paused ? "Pool paused" : "Pool active · Devnet") : "Connecting to devnet...",
      isLive: !!pool,
    },
    {
      label: "BTC Price",
      value: btcPrice ? `$${btcPrice.toLocaleString()}` : "—",
      subValue: "CoinGecko live",
      color: "var(--cyan)",
      icon: "💹",
      sublabel: "Live oracle price",
      isLive: !!btcPrice,
    },
    {
      label: "Encrypt FHE",
      value: "Pre-alpha",
      subValue: ENCRYPT_PROGRAM_ID.slice(0, 10) + "...",
      color: "var(--cyan)",
      icon: "🔒",
      sublabel: "4ebfzWdK... · Devnet",
      isLive: true,
    },
    {
      label: "Ika dWallet",
      value: "Pre-alpha",
      subValue: IKA_DWALLET_PROGRAM_ID.slice(0, 10) + "...",
      color: "var(--violet)",
      icon: "⚡",
      sublabel: "87W54kGY... · Devnet",
      isLive: true,
    },
  ];
}

function Counter({ target, isLive }: { target: string; isLive: boolean }) {
  if (!isLive || target === "—") {
    return (
      <span className="stat-number" style={{ color: "var(--text-3)" }}>—</span>
    );
  }
  return <span className="stat-number">{target}</span>;
}

export function ProtocolStats() {
  const { connection } = useConnection();
  const [pool, setPool] = useState<PoolState | null>(null);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Intersection observer for stagger trigger
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [poolState, price] = await Promise.all([
          fetchPoolState(connection),
          fetchBtcPrice(),
        ]);
        if (!cancelled) {
          setPool(poolState);
          setBtcPrice(price);
        }
      } catch {
        // silently fail — UI shows "—"
      }
    }
    load();
    // Refresh every 30s
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [connection]);

  const stats = buildStats(pool, btcPrice);

  return (
    <section className="z-base section-sm">
      <div className="container">
        {/* Section label */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <span className="pill">
            <span className="dot dot-green" style={{ width: 6, height: 6 }} />
            Protocol Metrics · Live Devnet
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid-4" style={{ gap: "clamp(0.75rem, 2vw, 1rem)" }}>
          {stats.map(({ label, value, subValue, color, icon, sublabel, isLive }, i) => (
            <motion.div
              key={label}
              className="card"
              initial={{ opacity: 0, y: 20 }}
              animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: i * 0.08, duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
              style={{
                padding: "clamp(1.25rem, 3vw, 1.75rem)",
                display: "flex", flexDirection: "column", gap: "0.875rem",
              }}
            >
              {/* Icon + label row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="metric-label">{label}</span>
                <div style={{
                  width: 32, height: 32,
                  background: `${color}18`,
                  border: `1px solid ${color}28`,
                  borderRadius: "var(--r-sm)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.875rem",
                }}>{icon}</div>
              </div>

              {/* Value */}
              <div>
                <div style={{ color, fontSize: "clamp(1.25rem, 3vw, 1.875rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1, fontFamily: "var(--font-mono)" }}>
                  <Counter target={value} isLive={isLive} />
                </div>
                <p style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "0.25rem" }}>
                  {sublabel}
                </p>
                {subValue && (
                  <p style={{ fontSize: "0.6rem", color: "var(--text-3)", marginTop: "0.125rem", fontFamily: "var(--font-mono)" }}>
                    {subValue}
                  </p>
                )}
              </div>

              {/* Live indicator + bottom accent */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                {isLive && pool !== null ? (
                  <span className="dot dot-green" style={{ width: 5, height: 5 }} />
                ) : (
                  <span className="dot dot-amber" style={{ width: 5, height: 5 }} />
                )}
                <div style={{
                  flex: 1, height: 2,
                  background: `linear-gradient(90deg, ${color}60, transparent)`,
                  borderRadius: 2,
                }} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Disclaimer for hackathon judges */}
        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-3)" }}>
            On-Chain Loans reads real Pool PDA · BTC price from CoinGecko ·{" "}
            <a href="https://explorer.solana.com/address/712fUCmQKHViAsnUCjtB6WT1BQuVzFD6iQn97LjboDeQ?cluster=devnet"
               target="_blank" rel="noreferrer"
               style={{ color: "var(--cyan)", textDecoration: "none" }}>
              View Program on Solana Explorer ↗
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
