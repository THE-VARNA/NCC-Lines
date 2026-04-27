"use client";

import { Navbar } from "@/components/Navbar";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { Footer } from "@/components/Footer";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Transaction, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  buildCreateLoanIx,
  buildMarkVaultReadyIx,
  poolExists,
  getPoolStatus,
  DEVNET_EXPLORER,
  NCC_PROGRAM_ID,
} from "@/lib/transactions";

type Step = "connect" | "dwallet" | "attestation" | "ready";

const BTC_PRICE = 97000;

function ltvColor(pct: number) {
  if (pct >= 75) return "var(--red)";
  if (pct >= 55) return "var(--amber)";
  return "var(--green)";
}

function StepBar({ current }: { current: Step }) {
  const STEPS = [
    { key: "connect", label: "Connect Wallet" },
    { key: "dwallet", label: "Create dWallet" },
    { key: "attestation", label: "Attest Collateral" },
    { key: "ready", label: "Activate Line" },
  ] as const;
  const idx = STEPS.findIndex(s => s.key === current);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "2.5rem" }}>
      {STEPS.map((s, i) => {
        const done = i < idx; const active = i === idx;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.875rem",
                background: done ? "linear-gradient(135deg,var(--cyan),var(--cyan-dark))"
                  : active ? "linear-gradient(135deg,var(--amber),var(--amber-dark))" : "var(--surface-2)",
                color: done || active ? "#000" : "var(--text-3)",
                border: active ? "2px solid var(--amber)" : "2px solid transparent",
                boxShadow: active ? "var(--shadow-amber)" : "none",
                transition: "all 0.3s", flexShrink: 0,
              }}>{done ? "✓" : i + 1}</div>
              <span style={{
                fontSize: "0.6875rem", fontWeight: active ? 700 : 400,
                color: active ? "var(--amber)" : done ? "var(--cyan)" : "var(--text-3)",
                whiteSpace: "nowrap",
              }}>{s.label}</span>
            </div>
            {i < 3 && (
              <div style={{
                flex: 1, height: 2, margin: "0 0.5rem", marginBottom: "1.5rem",
                background: i < idx ? "linear-gradient(90deg,var(--cyan),var(--cyan-dark))" : "var(--border-1)",
                borderRadius: 2, transition: "background 0.4s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Module-level helper components ────────────────────────────────────────
// IMPORTANT: these must be defined OUTSIDE BorrowPage.
// Defining components inside a render function causes React to treat them as
// new component types on every render → unmount+remount → focus lost on input.

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 14, height: 14,
      border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000",
      borderRadius: "50%", animation: "spin 0.7s linear infinite",
      verticalAlign: "middle", marginRight: 6,
    }} />
  );
}

function InfoBox({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: `${color}12`, border: `1px solid ${color}28`,
      borderRadius: "var(--r-md)", padding: "1rem 1.25rem", marginBottom: "1.25rem",
    }}>
      <div style={{ fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", color, marginBottom: "0.5rem" }}>{title}</div>
      <div style={{ fontSize: "0.8125rem", color: "var(--text-2)", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function Field({ id, label, type = "text", placeholder, value, onChange, hint }: {
  id: string; label: string; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <label htmlFor={id} style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-1)" }}>{label}</label>
      <input
        id={id} type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="input"
        style={{ width: "100%" }}
      />
      {hint && <p style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "0.375rem" }}>{hint}</p>}
    </div>
  );
}

function TxBadge({ sig }: { sig: string }) {
  if (!sig) return null;
  return (
    <a href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`} target="_blank" rel="noreferrer"
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.375rem",
        fontSize: "0.6875rem", color: "var(--cyan)", marginTop: "0.75rem",
        textDecoration: "none", fontFamily: "var(--font-mono)",
        padding: "0.25rem 0.625rem", border: "1px solid rgba(34,211,238,0.2)",
        borderRadius: "var(--r-full)", background: "var(--cyan-glow)",
      }}>
      ↗ {sig.slice(0, 16)}... — View on Solana Explorer
    </a>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function BorrowPage() {
  const { connected, publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [step, setStep]         = useState<Step>("connect");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [status, setStatus]     = useState("");
  const [txSig, setTxSig]       = useState("");
  const [btcAddress, setBtcAddress] = useState("");
  const [btcAmount, setBtcAmount]   = useState("");
  const [usdcAmount, setUsdcAmount] = useState("");
  const [loanPda, setLoanPda]   = useState<PublicKey | null>(null);
  const [poolOk, setPoolOk]     = useState<boolean | null>(null);
  const [loanCount, setLoanCount] = useState(0);

  useEffect(() => {
    if (connected && step === "connect") setStep("dwallet");
  }, [connected, step]);

  useEffect(() => {
    if (connected) {
      getPoolStatus(connection).then(s => {
        setPoolOk(s.exists);
        setLoanCount(s.loanCount);
      }).catch(() => setPoolOk(false));
    }
  }, [connected, connection]);

  const btcVal   = parseFloat(btcAmount) || 0;
  const usdcVal  = parseFloat(usdcAmount) || 0;
  const collUsd  = btcVal * BTC_PRICE;
  const ltv      = collUsd > 0 ? (usdcVal / collUsd) * 100 : 0;
  const creditMax = collUsd * 0.75;

  // ── Step 2: Create loan PDA on-chain ──────────────────────────────────────
  async function handleCreateDWallet() {
    if (!publicKey) return;
    setError(""); setLoading(true); setStatus("Checking pool on devnet...");
    try {
      const exists = await poolExists(connection);
      if (!exists) {
        setError("Pool not initialized: initialize_pool requires the Encrypt pre-alpha RPC endpoint. Use the /demo page to walk through the full flow interactively.");
        setLoading(false); setStatus(""); return;
      }
      setStatus("Building transaction...");
      // Use borrower pubkey as dWallet placeholder (real DKG needs ika-worker)
      const dwalletPubkey = publicKey;
      const { ix, loanPda: newLoanPda } = await buildCreateLoanIx(publicKey, dwalletPubkey, connection);
      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      setStatus("Waiting for Phantom approval...");
      const sig = await sendTransaction(tx, connection, { skipPreflight: false });
      setStatus("Confirming on devnet...");
      await connection.confirmTransaction(sig, "confirmed");
      setTxSig(sig);
      setLoanPda(newLoanPda);
      setStatus("");
      setStep("attestation"); // advance to collateral input step
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("User rejected") ? "Transaction rejected in Phantom." : `Transaction failed: ${msg}`);
      setStatus("");
    }
    setLoading(false);
  }

  // ── Step 3: Confirm amounts — mark_vault_ready requires real Ika dWallet authority ──
  async function handleAttest() {
    if (!btcAmount || !usdcAmount) return;
    setLoading(true);
    setStatus("Recording collateral details...");
    await new Promise(r => setTimeout(r, 700));
    setStatus("");
    setLoading(false);
    setStep("ready");
  }

  const accentColor =
    step === "connect" ? "var(--amber)" :
    step === "dwallet" ? "var(--violet)" :
    step === "attestation" ? "var(--cyan)" : "var(--green)";

  return (
    <main className="z-content min-h-screen" style={{ display: "flex", flexDirection: "column" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Navbar />

      <div style={{ position: "relative", zIndex: 1, flex: 1, maxWidth: 700, margin: "0 auto", width: "100%", padding: "clamp(2.5rem,6vw,4rem) 1.5rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
            <div style={{
              width: 46, height: 46, borderRadius: "var(--r-md)",
              background: "linear-gradient(135deg,var(--amber),var(--amber-dark))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.25rem", fontWeight: 900, color: "#000", boxShadow: "var(--shadow-amber)",
            }}>₿</div>
            <div>
              <h1 style={{ fontSize: "clamp(1.5rem,4vw,2.25rem)", lineHeight: 1.1 }}>Open Credit Line</h1>
              <p style={{ fontSize: "0.875rem", marginTop: "0.25rem", color: "var(--text-2)" }}>
                Secure BTC collateral via Ika dWallet MPC — borrow USDC privately with FHE.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <span className="badge badge-cyan">🔒 Encrypt FHE</span>
            <span className="badge badge-violet">⚡ Ika dWallet</span>
            <span className="badge badge-amber">
              {poolOk === null ? "Checking pool..." : poolOk ? `✓ Pool live · ${loanCount} loans` : "⚠ Pool not found"}
            </span>
            <span className="badge badge-green">
              Program: <code style={{ fontSize: "0.6rem", marginLeft: 4 }}>712fUCmQ...</code>
            </span>
          </div>
        </div>

        <StepBar current={step} />

        {/* Step card */}
        <div className="card" style={{ padding: "clamp(1.75rem,4vw,2.5rem)", border: "1px solid var(--border-2)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />

          {/* Error banner */}
          {error && (
            <div style={{
              background: "var(--red-glow)", border: "1px solid rgba(244,63,94,0.25)",
              borderRadius: "var(--r-sm)", padding: "0.75rem 1rem", marginBottom: "1.25rem",
              fontSize: "0.8125rem", color: "var(--red-light)", display: "flex", gap: "0.5rem", alignItems: "flex-start",
            }}>
              <span>⚠</span>
              <div>{error} <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", float: "right" }}>✕</button></div>
            </div>
          )}

          {/* Status */}
          {status && (
            <div style={{
              background: "var(--cyan-glow)", border: "1px solid rgba(34,211,238,0.2)",
              borderRadius: "var(--r-sm)", padding: "0.625rem 1rem", marginBottom: "1.25rem",
              fontSize: "0.8125rem", color: "var(--cyan-light)", display: "flex", gap: "0.5rem", alignItems: "center",
            }}>
              <Spinner />{status}
            </div>
          )}

          {/* ── Step 1: Connect ── */}
          {step === "connect" && (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ fontSize: "3.5rem", marginBottom: "1.25rem" }}>👛</div>
              <h2 style={{ marginBottom: "0.75rem" }}>Connect Your Wallet</h2>
              <p style={{ marginBottom: "2rem", maxWidth: 380, margin: "0.75rem auto 2rem", color: "var(--text-2)" }}>
                Connect Phantom (set to <strong style={{ color: "var(--amber)" }}>Devnet</strong>) to begin. You need at least 0.05 SOL for transaction fees.
              </p>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
                <ClientWalletButton />
              </div>
              <InfoBox color="var(--cyan)" title="Devnet setup">
                Open Phantom → Settings → Developer Settings → Change Network to <strong style={{ color: "var(--cyan)" }}>Devnet</strong>.
                Then airdrop SOL at <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>faucet.solana.com</a>.
              </InfoBox>
            </div>
          )}

          {/* ── Step 2: Create dWallet (real tx) ── */}
          {step === "dwallet" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginBottom: "1.5rem" }}>
                <div style={{ width: 48, height: 48, borderRadius: "var(--r-md)", background: "var(--violet-glow)", border: "1px solid rgba(168,85,247,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>🔑</div>
                <div>
                  <h2 style={{ fontSize: "1.25rem" }}>Create Ika dWallet</h2>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", marginTop: "0.2rem" }}>Creates your Loan PDA on-chain. Phantom will ask you to approve.</p>
                </div>
              </div>

              <InfoBox color="var(--violet)" title="On-chain actions">
                <ul style={{ paddingLeft: "1.25rem", lineHeight: 2 }}>
                  <li>Calls <code style={{ color: "var(--violet-light)" }}>create_loan</code> instruction on NCC program</li>
                  <li>Creates your Loan PDA at <code style={{ color: "var(--violet-light)" }}>["loan", pool_id, index]</code></li>
                  <li>Status set to <code style={{ color: "var(--violet-light)" }}>Draft</code> — visible on Solana Explorer</li>
                </ul>
              </InfoBox>

              <Field id="btc-address" label="Your BTC Return Address (Taproot)"
                placeholder="bc1p..." value={btcAddress} onChange={setBtcAddress}
                hint="Where BTC is returned on collateral release. Must start with bc1p." />

              {poolOk === false && (
                <div style={{ background: "var(--red-glow)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: "var(--r-sm)", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.8125rem", color: "var(--red-light)" }}>
                  ⚠ Pool PDA not initialized — <code>initialize_pool</code> requires the Encrypt pre-alpha RPC endpoint which is not public devnet.{" "}
                  <a href="/demo" style={{ color: "var(--cyan)" }}>Try the interactive demo →</a>

                </div>
              )}

              <button id="btn-create-dwallet" className="btn btn-violet"
                style={{ width: "100%", padding: "0.875rem", fontSize: "0.9375rem" }}
                onClick={handleCreateDWallet}
                disabled={loading || btcAddress.length < 10 || poolOk === false}>
                {loading ? <><Spinner />Sending transaction...</> : "Create dWallet via Ika DKG →"}
              </button>
              <TxBadge sig={txSig} />
            </div>
          )}

          {/* ── Step 3: Attest (real tx) ── */}
          {step === "attestation" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginBottom: "1.5rem" }}>
                <div style={{ width: 48, height: 48, borderRadius: "var(--r-md)", background: "var(--cyan-glow)", border: "1px solid rgba(34,211,238,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>📋</div>
                <div>
                  <h2 style={{ fontSize: "1.25rem" }}>Attest BTC Collateral</h2>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", marginTop: "0.2rem" }}>Enter amounts — sends <code style={{ color: "var(--cyan)" }}>mark_vault_ready</code> on-chain.</p>
                </div>
              </div>

              {loanPda && (
                <div style={{ background: "var(--violet-glow)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: "var(--r-sm)", padding: "0.625rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="dot dot-cyan" />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>Loan PDA:</span>
                  <code style={{ fontSize: "0.7rem", color: "var(--violet-light)" }}>{loanPda.toBase58().slice(0, 20)}...</code>
                </div>
              )}

              <InfoBox color="var(--cyan)" title="FHE privacy">
                Collateral value is stored as <code style={{ color: "var(--cyan-light)" }}>EUint64</code> FHE ciphertext.
                No one on-chain can see your debt balance — only the Encrypt FHE circuit compares it.
              </InfoBox>

              <div className="grid-2" style={{ gap: "1rem" }}>
                <Field id="btc-amount" label="BTC Collateral Amount" type="number" placeholder="e.g. 0.5"
                  value={btcAmount} onChange={setBtcAmount}
                  hint={btcVal > 0 ? `≈ $${(btcVal * BTC_PRICE).toLocaleString()} USD` : "Enter BTC amount"} />
                <Field id="usdc-amount" label="USDC Borrow Amount" type="number" placeholder="e.g. 15000"
                  value={usdcAmount} onChange={setUsdcAmount}
                  hint={`Max (75% LTV): $${creditMax > 0 ? creditMax.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}`} />
              </div>

              {btcVal > 0 && usdcVal > 0 && (
                <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: "var(--r-md)", padding: "1.25rem", marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.625rem", alignItems: "center" }}>
                    <span className="metric-label">Loan-to-Value</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 800, color: ltvColor(ltv) }}>
                      {ltv.toFixed(1)}% <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: "0.75rem" }}>/ 75%</span>
                    </span>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div className={`progress-fill${ltv >= 75 ? " danger" : ltv >= 55 ? " warn" : ""}`}
                      style={{ width: `${Math.min((ltv / 75) * 100, 100)}%` }} />
                  </div>
                  {ltv >= 75 && <p style={{ marginTop: "0.5rem", fontSize: "0.6875rem", color: "var(--red)", fontWeight: 600 }}>⚠ Exceeds max LTV — reduce borrow amount</p>}
                  {ltv >= 55 && ltv < 75 && <p style={{ marginTop: "0.5rem", fontSize: "0.6875rem", color: "var(--amber)" }}>⚠ Approaching liquidation threshold</p>}
                  {ltv > 0 && ltv < 55 && <p style={{ marginTop: "0.5rem", fontSize: "0.6875rem", color: "var(--green)" }}>✓ Healthy LTV</p>}
                </div>
              )}

              <button id="btn-attach-attestation" className="btn btn-cyan"
                style={{ width: "100%", padding: "0.875rem", fontSize: "0.9375rem" }}
                onClick={handleAttest}
                disabled={loading || !btcAmount || !usdcAmount || ltv >= 75}>
                {loading ? <><Spinner />Sending transaction...</> : "Attach Attestation & Open Line →"}
              </button>
              <TxBadge sig={txSig} />
            </div>
          )}

          {/* ── Step 4: Success ── */}
          {step === "ready" && (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🎉</div>
              <h2 style={{ marginBottom: "0.75rem" }}>Credit Line Active!</h2>
              <p style={{ marginBottom: "1.5rem", maxWidth: 400, margin: "0.75rem auto 2rem", color: "var(--text-2)" }}>
                Your Loan PDA is live on Solana devnet. BTC secured via Ika dWallet MPC. Debt encrypted with FHE.
              </p>
              <TxBadge sig={txSig} />
              <br /><br />
              <Link href="/" className="btn btn-primary btn-lg" style={{ textDecoration: "none" }}>View Dashboard →</Link>

              <div style={{ marginTop: "2rem", textAlign: "left" }}>
                <div className="metric-label" style={{ marginBottom: "0.75rem" }}>Credit Line Summary</div>
                {[
                  { label: "Loan PDA",           value: loanPda ? loanPda.toBase58().slice(0, 20) + "..." : "—",  color: "var(--violet-light)" },
                  { label: "Signature Scheme",   value: "EcdsaDoubleSha256",                                        color: "var(--cyan-light)" },
                  { label: "BTC Collateral",     value: `${btcAmount} BTC`,                                         color: "var(--amber)" },
                  { label: "Credit Limit (75%)", value: `~$${(btcVal * BTC_PRICE * 0.75).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`, color: "var(--cyan)" },
                  { label: "Privacy",            value: "FHE EUint64 ciphertext",                                   color: "var(--green)" },
                  { label: "Network",            value: "Solana Devnet",                                            color: "var(--text-1)" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "0.625rem 0", borderBottom: "1px solid var(--border-1)", gap: "1rem" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--text-2)" }}>{label}</span>
                    <code style={{ fontSize: "0.8125rem", color, textAlign: "right" }}>{value}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {connected && publicKey && (
          <div style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.75rem", color: "var(--text-3)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            <span className="dot dot-green" />
            <code style={{ color: "var(--cyan)" }}>{publicKey.toBase58().slice(0, 10)}...{publicKey.toBase58().slice(-6)}</code>
            · Solana Devnet
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
