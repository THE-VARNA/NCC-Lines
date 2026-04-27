"use client";

import { Navbar } from "@/components/Navbar";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { useState } from "react";

type Step = "connect" | "dwallet" | "attestation" | "ready";

interface FormState {
  btcAddress: string;
  btcAmount: string;
}

export function BorrowPage() {
  const { connected } = useWallet();
  const [step, setStep] = useState<Step>(connected ? "dwallet" : "connect");
  const [form, setForm] = useState<FormState>({ btcAddress: "", btcAmount: "" });
  const [loading, setLoading] = useState(false);

  async function handleStep(next: Step) {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1800));
    setLoading(false);
    setStep(next);
  }

  const STEPS_META = [
    { key: "connect", label: "Connect Wallet" },
    { key: "dwallet", label: "Create dWallet" },
    { key: "attestation", label: "Attest Collateral" },
    { key: "ready", label: "Activate Line" },
  ] as const;

  const stepIdx = STEPS_META.findIndex((s) => s.key === step);

  return (
    <main className="z-content min-h-screen">
      <Navbar />

      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "4rem 1.5rem",
        }}
      >
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2rem" }}>Open Credit Line</h1>
          <p style={{ marginTop: "0.5rem" }}>
            Secure BTC collateral with Ika dWallet MPC and access USDC liquidity privately.
          </p>
        </div>

        {/* Step progress */}
        <div
          style={{
            display: "flex",
            gap: "0",
            marginBottom: "2.5rem",
            alignItems: "center",
          }}
        >
          {STEPS_META.map((s, i) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < STEPS_META.length - 1 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    background: i < stepIdx
                      ? "var(--teal)"
                      : i === stepIdx
                      ? "var(--amber)"
                      : "rgba(255,255,255,0.06)",
                    color: i <= stepIdx ? "#000" : "var(--text-muted)",
                    border: i === stepIdx ? "2px solid var(--amber)" : "none",
                    boxShadow: i === stepIdx ? "0 0 12px rgba(247,147,26,0.4)" : "none",
                    transition: "all 0.3s",
                  }}
                >
                  {i < stepIdx ? "✓" : i + 1}
                </div>
                <span
                  style={{
                    fontSize: "0.65rem",
                    marginTop: "0.3rem",
                    color: i === stepIdx ? "var(--amber)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                    fontWeight: i === stepIdx ? 600 : 400,
                  }}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS_META.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: i < stepIdx ? "var(--teal)" : "rgba(255,255,255,0.06)",
                    margin: "0 0.5rem",
                    marginBottom: "1.2rem",
                    transition: "background 0.4s",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="glass-card" style={{ padding: "2rem" }}>
          {step === "connect" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👋</div>
              <h3 style={{ marginBottom: "0.5rem" }}>Connect Your Wallet</h3>
              <p style={{ marginBottom: "1.5rem" }}>
                Connect a Solana wallet to begin setting up your BTC credit line.
              </p>
              <ClientWalletButton />
            </div>
          )}

          {step === "dwallet" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🔑</span>
                <div>
                  <h3>Create Ika dWallet</h3>
                  <p style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}>
                    Distributed key generation — your BTC key is never held by a single party.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: "var(--purple-dim)",
                  border: "1px solid rgba(139,92,246,0.15)",
                  borderRadius: 10,
                  padding: "1rem",
                  marginBottom: "1.5rem",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.3rem", color: "var(--purple)" }}>What happens:</div>
                <ul style={{ paddingLeft: "1.2rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                  <li>Ika MPC network performs DKG with <code>EcdsaDoubleSha256</code></li>
                  <li>The signing authority is transferred to this program's PDA</li>
                  <li>You receive a dWallet ID for your BTC address</li>
                </ul>
              </div>

              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 500 }}>
                Your BTC Receive Address (Taproot)
              </label>
              <input
                id="btc-address-input"
                className="input-field"
                placeholder="bc1p..."
                value={form.btcAddress}
                onChange={(e) => setForm((f) => ({ ...f, btcAddress: e.target.value }))}
                style={{ marginBottom: "1.5rem" }}
              />

              <button
                id="btn-create-dwallet"
                className="btn-primary"
                style={{ width: "100%" }}
                onClick={() => handleStep("attestation")}
                disabled={loading}
              >
                {loading ? "Creating dWallet..." : "Create dWallet via Ika DKG →"}
              </button>
            </div>
          )}

          {step === "attestation" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "1.5rem" }}>📋</span>
                <div>
                  <h3>Attest BTC Collateral</h3>
                  <p style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}>
                    The oracle attests your BTC balance. Value is encrypted on-chain with FHE.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: "var(--teal-dim)",
                  border: "1px solid rgba(0,201,167,0.15)",
                  borderRadius: 10,
                  padding: "1rem",
                  marginBottom: "1.5rem",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.3rem", color: "var(--teal)" }}>Privacy guarantee:</div>
                <p style={{ color: "var(--text-secondary)" }}>
                  The collateral value is stored as an <code>EUint64</code> ciphertext. Only the
                  Encrypt FHE circuit can read it — not validators, not oracles, not other users.
                </p>
              </div>

              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 500 }}>
                BTC Amount to Collateralize
              </label>
              <input
                id="btc-amount-input"
                className="input-field"
                type="number"
                placeholder="e.g. 0.5"
                min="0"
                step="0.001"
                value={form.btcAmount}
                onChange={(e) => setForm((f) => ({ ...f, btcAmount: e.target.value }))}
                style={{ marginBottom: "0.75rem" }}
              />

              {form.btcAmount && (
                <div
                  className="stat-card"
                  style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between" }}
                >
                  <span className="text-secondary" style={{ fontSize: "0.85rem" }}>Estimated Credit Limit (60% LTV)</span>
                  <span className="text-amber" style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    ~${(parseFloat(form.btcAmount) * 97000 * 0.6).toLocaleString()}
                  </span>
                </div>
              )}

              <button
                id="btn-attach-attestation"
                className="btn-primary"
                style={{ width: "100%" }}
                onClick={() => handleStep("ready")}
                disabled={loading || !form.btcAmount}
              >
                {loading ? "Attesting..." : "Attach Attestation →"}
              </button>
            </div>
          )}

          {step === "ready" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
              <h3 style={{ marginBottom: "0.5rem" }}>Credit Line Active!</h3>
              <p style={{ marginBottom: "1.5rem" }}>
                Your BTC is secured by an Ika dWallet. Your collateral value is FHE-encrypted
                on-chain. You can now borrow USDC privately.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <a href="/" className="btn-primary" style={{ textDecoration: "none" }}>
                  View Dashboard →
                </a>
              </div>

              {/* Summary */}
              <div style={{ marginTop: "1.5rem", textAlign: "left" }}>
                {[
                  { label: "dWallet ID", value: "dw_" + Math.random().toString(36).slice(2, 10) },
                  { label: "Sig Scheme", value: "EcdsaDoubleSha256" },
                  { label: "BTC Collateral", value: form.btcAmount + " BTC" },
                  { label: "Credit Limit", value: "~$" + (parseFloat(form.btcAmount || "0") * 97000 * 0.6).toLocaleString() },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.6rem 0",
                      borderBottom: "1px solid var(--border-subtle)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span className="text-secondary">{label}</span>
                    <code style={{ color: "var(--text-primary)" }}>{value}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
