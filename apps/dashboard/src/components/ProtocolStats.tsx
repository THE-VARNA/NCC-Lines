"use client";

import { useState, useEffect, useRef } from "react";

interface Stat {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  color: string;
  icon: string;
  sublabel: string;
}

const STATS: Stat[] = [
  { label: "Total Value Locked",      value: 4.28,  prefix: "$", suffix: "M",  decimals: 2, color: "var(--amber)",  icon: "₿", sublabel: "BTC collateral secured" },
  { label: "Active Credit Lines",     value: 127,   decimals: 0,                              color: "var(--cyan)",   icon: "⚡", sublabel: "Borrowers on devnet" },
  { label: "FHE Computations",        value: 2847,  decimals: 0,                              color: "var(--violet)", icon: "🔒", sublabel: "Encrypted LTV checks run" },
  { label: "BTC Secured",             value: 42.5,  suffix: " BTC", decimals: 1,             color: "var(--amber)",  icon: "🔐", sublabel: "Under Ika MPC custody" },
];

function Counter({ target, prefix = "", suffix = "", decimals = 0 }: { target: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1400;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // easeOutExpo
      const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDisplay(ease * target);
      if (p < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target]);

  return (
    <span className="stat-number">
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}

export function ProtocolStats() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="z-base section-sm">
      <div className="container">
        {/* Section label */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <span className="pill">
            <span className="dot dot-green" style={{ width: 6, height: 6 }} />
            Protocol Metrics
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid-4" style={{ gap: "clamp(0.75rem, 2vw, 1rem)" }}>
          {STATS.map(({ label, value, prefix, suffix, decimals, color, icon, sublabel }, i) => (
            <div
              key={label}
              className="card animate-in"
              style={{
                padding: "clamp(1.25rem, 3vw, 1.75rem)",
                animationDelay: `${i * 80}ms`,
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
                {visible ? (
                  <div style={{ color, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.1 }}>
                    <Counter target={value} prefix={prefix} suffix={suffix} decimals={decimals} />
                  </div>
                ) : (
                  <div style={{ height: "2rem", background: "var(--surface-3)", borderRadius: 4, width: "60%" }} />
                )}
                <p style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "0.375rem" }}>{sublabel}</p>
              </div>

              {/* Bottom accent line */}
              <div style={{
                height: 2,
                background: `linear-gradient(90deg, ${color}60, transparent)`,
                borderRadius: 2,
              }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
