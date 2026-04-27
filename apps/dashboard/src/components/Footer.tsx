"use client";

export function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--border-1)",
      background: "rgba(2,6,15,0.95)",
      padding: "clamp(2rem, 5vw, 3.5rem) 0 clamp(1.5rem, 4vw, 2.5rem)",
      marginTop: "clamp(2rem, 5vw, 4rem)",
    }}>
      <div className="container">
        {/* Top row — brand + built with */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "2rem", marginBottom: "2.5rem" }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem" }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, var(--amber), var(--amber-dark))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1rem", fontWeight: 900, color: "#000",
                boxShadow: "var(--shadow-amber)",
              }}>₿</div>
              <div>
                <span style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "-0.025em" }}>NCC Lines</span>
              </div>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-3)", maxWidth: 260, lineHeight: 1.6 }}>
              Native Collateral Credit Lines — confidential BTC lending on Solana.
              Encrypt × Ika Frontier Hackathon, 2026.
            </p>
          </div>

          {/* Built with */}
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "0.875rem" }}>
              Built with
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {/* Encrypt */}
              <div style={{
                display: "flex", alignItems: "center", gap: "0.625rem",
                padding: "0.5rem 0.875rem",
                background: "var(--cyan-glow)",
                border: "1px solid rgba(34,211,238,0.18)",
                borderRadius: "var(--r-sm)",
              }}>
                <span style={{ fontSize: "0.875rem" }}>🔒</span>
                <div>
                  <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--cyan)" }}>Encrypt FHE</span>
                  <br />
                  <code style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>Pre-alpha Devnet</code>
                </div>
              </div>
              {/* Ika */}
              <div style={{
                display: "flex", alignItems: "center", gap: "0.625rem",
                padding: "0.5rem 0.875rem",
                background: "var(--violet-glow)",
                border: "1px solid rgba(168,85,247,0.18)",
                borderRadius: "var(--r-sm)",
              }}>
                <span style={{ fontSize: "0.875rem" }}>⚡</span>
                <div>
                  <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--violet)" }}>Ika dWallet MPC</span>
                  <br />
                  <code style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>Pre-alpha Devnet</code>
                </div>
              </div>
              {/* Solana */}
              <div style={{
                display: "flex", alignItems: "center", gap: "0.625rem",
                padding: "0.5rem 0.875rem",
                background: "rgba(153,69,255,0.08)",
                border: "1px solid rgba(153,69,255,0.15)",
                borderRadius: "var(--r-sm)",
              }}>
                <div style={{
                  width: 18, height: 18,
                  background: "linear-gradient(135deg, #9945ff, #14f195)",
                  borderRadius: "50%",
                  flexShrink: 0,
                }} />
                <div>
                  <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#9945ff" }}>Solana</span>
                  <span style={{ color: "var(--text-3)", fontSize: "0.6875rem", marginLeft: 6 }}>Devnet</span>
                </div>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "0.875rem" }}>
              Resources
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { label: "Architecture Diagram", href: "#" },
                { label: "README", href: "https://github.com" },
                { label: "DEVNET.md", href: "https://github.com" },
                { label: "Test Suite (20 tests)", href: "https://github.com" },
              ].map(({ label, href }) => (
                <a key={label} href={href}
                  style={{ fontSize: "0.8125rem", color: "var(--text-2)", textDecoration: "none", transition: "color var(--t-sm)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text-0)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}
                >{label}</a>
              ))}
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* Bottom */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", paddingTop: "1.25rem" }}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
            © 2026 Native Collateral Credit Lines · Encrypt × Ika Frontier Hackathon
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="dot dot-green" />
            <span style={{ fontSize: "0.6875rem", color: "var(--text-3)" }}>
              20 tests passing · 66KB BPF · Pre-alpha devnet
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
