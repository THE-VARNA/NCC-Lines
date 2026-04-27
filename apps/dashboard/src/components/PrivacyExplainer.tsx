"use client";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Lock BTC Collateral",
    desc: "Your BTC is secured in an Ika dWallet — a threshold MPC wallet jointly controlled by Ika's network and the Solana program. No bridges, no wrapped tokens.",
    icon: "₿",
    color: "var(--amber)",
    glow: "var(--amber-glow)",
    border: "rgba(245,158,11,0.20)",
  },
  {
    step: "02",
    title: "FHE Checks LTV",
    desc: "Encrypt's on-chain FHE computes whether your loan-to-value ratio is safe — without ever seeing the number. The program receives a single encrypted bit.",
    icon: "🔒",
    color: "var(--cyan)",
    glow: "var(--cyan-glow)",
    border: "rgba(34,211,238,0.20)",
  },
  {
    step: "03",
    title: "Receive USDC Credit",
    desc: "Credit flows instantly on Solana. Sub-second settlement, fractions-of-a-cent fees. Repay at any time — Ika releases your BTC collateral back to your wallet.",
    icon: "⚡",
    color: "var(--violet)",
    glow: "var(--violet-glow)",
    border: "rgba(168,85,247,0.20)",
  },
];

const DIFFERENTIATORS = [
  { label: "No Bridges", icon: "🚫", desc: "BTC never leaves the Bitcoin network" },
  { label: "Private LTV",  icon: "🔏", desc: "FHE keeps debt amounts invisible" },
  { label: "MPC Custody",  icon: "🤝", desc: "Threshold signing — no single point of failure" },
  { label: "Instant", icon: "⚡", desc: "Solana finality in < 400ms" },
];

export function PrivacyExplainer() {
  return (
    <section className="z-base section">
      <div className="container" style={{ display: "flex", flexDirection: "column", gap: "clamp(3rem, 6vw, 5rem)" }}>

        {/* How it works */}
        <div>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <span className="pill" style={{ marginBottom: "1rem", display: "inline-flex" }}>Protocol Flow</span>
            <h2 style={{ marginTop: "1rem" }}>How It Works</h2>
            <p style={{ marginTop: "0.75rem", maxWidth: 520, margin: "0.75rem auto 0" }}>
              Three steps from BTC to USDC credit — fully on-chain, fully private.
            </p>
          </div>

          <div className="grid-3" style={{ alignItems: "stretch" }}>
            {HOW_IT_WORKS.map(({ step, title, desc, icon, color, glow, border }) => (
              <div key={step} className="card" style={{
                padding: "2rem",
                border: `1px solid ${border}`,
                background: glow,
                display: "flex", flexDirection: "column", gap: "1.25rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color: color,
                  }}>STEP {step}</span>
                  <div style={{
                    width: 44, height: 44,
                    background: `${color}20`,
                    border: `1px solid ${color}35`,
                    borderRadius: "var(--r-md)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.375rem",
                  }}>{icon}</div>
                </div>
                <div>
                  <h3 style={{ marginBottom: "0.625rem", color: "var(--text-0)" }}>{title}</h3>
                  <p style={{ fontSize: "0.875rem", lineHeight: 1.7, color: "var(--text-2)" }}>{desc}</p>
                </div>
                <div style={{
                  height: 2,
                  background: `linear-gradient(90deg, ${color}70, transparent)`,
                  borderRadius: 2,
                  marginTop: "auto",
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Why we win */}
        <div style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-1)",
          borderRadius: "var(--r-xl)",
          padding: "clamp(2rem, 5vw, 3.5rem)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Background accent */}
          <div aria-hidden style={{
            position: "absolute", top: "-30%", right: "-10%",
            width: 400, height: 400,
            background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 60%)",
            pointerEvents: "none",
          }} />
          <div aria-hidden style={{
            position: "absolute", bottom: "-20%", left: "-5%",
            width: 300, height: 300,
            background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 60%)",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <h2 style={{ marginBottom: "0.75rem" }}>Why Native Collateral Credit Lines Wins</h2>
              <p style={{ maxWidth: 560, margin: "0 auto", color: "var(--text-2)" }}>
                The first protocol to combine Encrypt FHE and Ika dWallet in production lending.
                No other submission can show this stack.
              </p>
            </div>

            <div className="grid-4" style={{ gap: "1rem", marginBottom: "2.5rem" }}>
              {DIFFERENTIATORS.map(({ label, icon, desc }) => (
                <div key={label} style={{
                  textAlign: "center",
                  padding: "1.25rem 1rem",
                  background: "var(--surface-2)",
                  borderRadius: "var(--r-lg)",
                  border: "1px solid var(--border-1)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem",
                }}>
                  <span style={{ fontSize: "1.5rem" }}>{icon}</span>
                  <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--text-0)" }}>{label}</span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--text-3)", lineHeight: 1.5 }}>{desc}</span>
                </div>
              ))}
            </div>

            {/* Quote */}
            <div style={{
              background: "linear-gradient(135deg, rgba(34,211,238,0.06), rgba(168,85,247,0.06))",
              border: "1px solid var(--border-2)",
              borderRadius: "var(--r-lg)",
              padding: "1.5rem 2rem",
              textAlign: "center",
            }}>
              <p style={{
                fontSize: "clamp(0.9375rem, 2vw, 1.125rem)",
                lineHeight: 1.65,
                color: "var(--text-1)",
                fontStyle: "italic",
                maxWidth: 680, margin: "0 auto",
              }}>
                "Institutional borrowers will not put BTC into a protocol where competitors can watch their position.
                Private capital markets require confidentiality as a baseline — not a feature.{" "}
                <span style={{ color: "var(--cyan)", fontWeight: 600, fontStyle: "normal" }}>NCC Lines delivers it, on Solana, natively.</span>"
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
