"use client";

const STEPS = [
  {
    num: "01",
    title: "Ika DKG",
    icon: "🔑",
    color: "var(--purple)",
    description:
      "A dWallet is created via Ika's distributed key generation. The private key shares are held by the MPC network — no single party has custody.",
  },
  {
    num: "02",
    title: "Authority Transfer",
    icon: "⚡",
    color: "var(--amber)",
    description:
      "The dWallet's signing authority is transferred to this program's Ika CPI authority PDA. The program can now authorize signatures on your behalf.",
  },
  {
    num: "03",
    title: "FHE Attestation",
    icon: "🔒",
    color: "var(--teal)",
    description:
      "A trusted oracle attests to your BTC collateral value. The value is encrypted with Encrypt FHE on-chain — never visible in plaintext.",
  },
  {
    num: "04",
    title: "Private LTV Check",
    icon: "📊",
    color: "var(--teal)",
    description:
      "When you borrow or repay, a borrow_check FHE graph runs on-chain. Debt and LTV are computed in ciphertext. The result is a binary eligible/ineligible bit.",
  },
  {
    num: "05",
    title: "Policy Decryption",
    icon: "🧮",
    color: "var(--amber)",
    description:
      "The binary policy bit is decrypted by the Encrypt network. The program verifies the digest on-chain — preventing any off-chain manipulation.",
  },
  {
    num: "06",
    title: "Ika Message Approval",
    icon: "✍️",
    color: "var(--purple)",
    description:
      "If eligible, the program CPI-calls approve_message on the Ika dWallet program. The MPC network then performs threshold signing, releasing or liquidating BTC.",
  },
];

export function PrivacyExplainer() {
  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto 6rem",
        padding: "0 1.5rem",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "3rem" }}>
        <h2>How Privacy Is Enforced</h2>
        <p style={{ marginTop: "0.75rem", maxWidth: 600, margin: "0.75rem auto 0" }}>
          End-to-end confidentiality from key generation to BTC signing. No plaintext debt values,
          no bridge risk, no custodian.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {STEPS.map((step) => (
          <div
            key={step.num}
            className="stat-card"
            style={{ display: "flex", gap: "1rem" }}
          >
            {/* Step number */}
            <div
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${step.color}22, ${step.color}11)`,
                border: `1px solid ${step.color}33`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: step.color,
              }}
            >
              {step.num}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                <span>{step.icon}</span>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{step.title}</span>
              </div>
              <p style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tech stack row */}
      <div
        className="glass-card"
        style={{
          marginTop: "2rem",
          padding: "1.5rem 2rem",
          display: "flex",
          gap: "2rem",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {[
          { label: "FHE Runtime", value: "Encrypt by dWallet Labs", color: "var(--teal)" },
          { label: "MPC Signing", value: "Ika dWallet Protocol", color: "var(--purple)" },
          { label: "Execution Layer", value: "Solana (Pinocchio)", color: "var(--amber)" },
          { label: "Sig Scheme", value: "EcdsaDoubleSha256 (BTC)", color: "var(--amber)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div className="text-muted" style={{ fontSize: "0.7rem", marginBottom: "0.25rem" }}>{label}</div>
            <div style={{ fontWeight: 600, fontSize: "0.85rem", color }}>{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
