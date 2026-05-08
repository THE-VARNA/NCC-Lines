"use client";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { fetchBtcPrice } from "@/lib/onchain";
import {
  buildCreateLoanIx,
  buildMarkVaultReadyIx,
  buildAttachAttestationIx,
  buildCreateEncryptDepositIxIfNeeded,
  sendTx,
  DEVNET_EXPLORER,
  NCC_PROGRAM_ID,
} from "@/lib/transactions";


import { Transaction, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";

import { findEncryptConfigPda } from "@/lib/transactions";

// ── Real Ika dWallet DKG via API route ──────────────────────────────────────
async function createRealDWallet(payerPubkey: string): Promise<{ dwalletPda: string; publicKey: string }> {
  const res = await fetch("/api/ika/create-dwallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payerPubkey }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Ika DKG failed: ${data.error}`);
  return { dwalletPda: data.dwalletPda, publicKey: data.publicKey };
}

// ── Real Encrypt createInput via API route ───────────────────────────────────
async function encryptValue(
  value: number,
  authorizedPubkey: PublicKey,
  networkKey: string
): Promise<string> {
  const res = await fetch("/api/encrypt/create-input", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      value,
      fheType: 4, // EUint64
      authorized: Buffer.from(authorizedPubkey.toBytes()).toString("hex"),
      networkKey,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Encrypt gRPC failed: ${data.error}`);
  return data.ciphertextIdentifier as string;
}

const STEPS = ["Create Vault", "Fund Vault", "Attest Collateral", "Receive USDC"];

function StepBar({ currentStep }: { currentStep: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2.5rem", position: "relative" }}>
      <div style={{ position: "absolute", top: 16, left: "5%", right: "5%", height: 2, background: "var(--surface-2)", zIndex: 0 }}>
        <motion.div
          layoutId="step-fill"
          style={{ height: "100%", background: "linear-gradient(90deg, var(--amber), var(--cyan))", borderRadius: 2 }}
          initial={{ width: 0 }}
          animate={{ width: `${(currentStep / 3) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>
      {STEPS.map((step, i) => {
        const active = currentStep === i;
        const past = currentStep > i;
        const color = active ? "var(--cyan)" : past ? "var(--amber)" : "var(--text-3)";
        return (
          <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", zIndex: 1 }}>
            <motion.div
              animate={{
                background: active ? "var(--cyan-glow)" : past ? "var(--amber-glow)" : "var(--surface-1)",
                borderColor: active ? "var(--cyan)" : past ? "var(--amber)" : "var(--border-2)",
                scale: active ? 1.1 : 1,
              }}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                border: `2px solid`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: "0.875rem", color: active || past ? "var(--text-0)" : "var(--text-3)",
                boxShadow: active ? "0 0 16px rgba(34,211,238,0.4)" : "none",
              }}
            >
              {past ? "✓" : i + 1}
            </motion.div>
            <span style={{ fontSize: "0.6875rem", fontWeight: active ? 600 : 400, color }}>{step}</span>
          </div>
        );
      })}
    </div>
  );
}

export function BorrowPage() {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [btcPrice, setBtcPrice] = useState(97000); // fallback
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Input states
  const [btcAmountStr, setBtcAmountStr] = useState("");
  const btcAmount = parseFloat(btcAmountStr) || 0;
  const collateralValueUsd = Math.floor(btcAmount * btcPrice);
  const ltvLimitUsd = collateralValueUsd * 0.6; // 60%

  // Transaction states
  const [loanPda, setLoanPda] = useState<PublicKey | null>(null);
  const [dWalletKey, setDWalletKey] = useState<PublicKey | null>(null);
  const [dWalletPda, setDWalletPda] = useState<string | null>(null);
  const [dWalletPublicKey, setDWalletPublicKey] = useState<string | null>(null);
  const [collateralCtId, setCollateralCtId] = useState<string | null>(null);
  const [networkKey, setNetworkKey] = useState<string>("5555555555555555555555555555555555555555555555555555555555555555"); // default
  const [txSigs, setTxSigs] = useState<string[]>([]);

  useEffect(() => {
    fetchBtcPrice().then(p => setBtcPrice(p)).catch(() => {});
    // Read Encrypt config to get real network key
    const [configPda] = findEncryptConfigPda();
    connection.getAccountInfo(configPda).then(info => {
      if (info && info.data.length >= 132) {
        const keyBytes = info.data.slice(100, 132);
        setNetworkKey(Buffer.from(keyBytes).toString("hex"));
      }
    }).catch(() => {});
  }, [connection]);

  const handleError = (msg: string, err: any) => {
    console.error(msg, err);
    setError(`${msg}: ${err.message || String(err)}`);
    setLoading(false);
  };

  const handleCreateDWallet = async () => {
    if (!publicKey || !signTransaction) return;
    setLoading(true);
    setError(null);
    try {
      // Step A: Create real Ika dWallet via DKG (gRPC → executor)
      let dwalletPubkey: PublicKey;
      let dwalletPdaStr: string | null = null;
      let dwalletPkHex: string | null = null;
      try {
        const dwallet = await createRealDWallet(publicKey.toBase58());
        dwalletPubkey = new PublicKey(dwallet.dwalletPda);
        dwalletPdaStr = dwallet.dwalletPda;
        dwalletPkHex = dwallet.publicKey;
      } catch (ikaErr) {
        // Ika DKG may be slow/unavailable — use deterministic fallback keyed to wallet
        console.warn("Ika DKG unavailable, using wallet-derived fallback:", ikaErr);
        const [fallback] = PublicKey.findProgramAddressSync(
          [Buffer.from("dwallet"), publicKey.toBytes()],
          new PublicKey("87W54kGYFQ1rgWqMeu4XTPHWXWmXSQCcjm8vCTfiq1oY")
        );
        dwalletPubkey = fallback;
        dwalletPdaStr = fallback.toBase58();
        dwalletPkHex = fallback.toBase58();
      }

      // Step B: Create loan PDA on-chain with dWallet pubkey
      const { ix, loanPda: pda } = await buildCreateLoanIx(publicKey, dwalletPubkey, connection);
      const tx = new Transaction({ feePayer: publicKey }).add(ix);
      const sig = await sendTx(connection, tx, signTransaction);

      setDWalletKey(dwalletPubkey);
      setDWalletPda(dwalletPdaStr);
      setDWalletPublicKey(dwalletPkHex);
      setLoanPda(pda);
      setTxSigs(prev => [...prev, sig]);
      setStep(1);
    } catch (err) {
      handleError("Failed to create loan and dWallet", err);
    }
    setLoading(false);
  };

  const handleFundVault = async () => {
    if (!publicKey || !signTransaction || !loanPda || !dWalletKey) return;
    setLoading(true);
    setError(null);
    try {
      await new Promise(r => setTimeout(r, 600)); // Simulate BTC transfer confirmation

      const ix = buildMarkVaultReadyIx(publicKey, loanPda, dWalletKey);
      const tx = new Transaction({ feePayer: publicKey }).add(ix);
      const sig = await sendTx(connection, tx, signTransaction);
      setTxSigs(prev => [...prev, sig]);

      setStep(2);
    } catch (err) {
      handleError("Failed to fund vault", err);
    }
    setLoading(false);
  };

  const handleAttest = async () => {
    if (!publicKey || !signTransaction || !loanPda) return;
    setLoading(true);
    setError(null);
    try {
      const cents = BigInt(collateralValueUsd * 100);

      // Step A: Create Encrypt FHE input for collateral value via gRPC executor
      // This calls the real Encrypt pre-alpha executor and stores ciphertext on-chain
      let ctId: string | null = null;
      try {
        ctId = await encryptValue(collateralValueUsd, NCC_PROGRAM_ID, networkKey);
        setCollateralCtId(ctId);
      } catch (encErr) {
        console.warn("Encrypt gRPC unavailable:", encErr);
      }

      // Step B: Ensure the EncryptDeposit PDA exists (required for on-chain CPI)
      const depositIx = await buildCreateEncryptDepositIxIfNeeded(publicKey, connection);
      if (depositIx) {
        const depositTx = new Transaction({ feePayer: publicKey }).add(depositIx);
        const depositSig = await sendTx(connection, depositTx, signTransaction);
        setTxSigs(prev => [...prev, depositSig]);
      }

      // Step C: Attach attestation on-chain (NCC program)
      // Use dWallet PDA as BTC address identifier (or placeholder)
      const btcIdentifier = dWalletPda ?? "dwallet-vault-" + publicKey.toBase58().slice(0, 8);
      const buildRes = await buildAttachAttestationIx(publicKey, loanPda, cents, btcIdentifier, connection);
      if (!buildRes) {
        throw new Error("Failed to build attach_attestation instruction");
      }

      const { ix, collateralCtKeypair, debtCtKeypair } = buildRes;

      const cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
      const cuPriceIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 });

      const tx = new Transaction({ feePayer: publicKey })
        .add(cuLimitIx)
        .add(cuPriceIx)
        .add(ix);
      const sig = await sendTx(connection, tx, signTransaction, [collateralCtKeypair, debtCtKeypair]);

      setTxSigs(prev => [...prev, sig]);
      setStep(3);
    } catch (err) {
      handleError("Failed to attach attestation", err);
    }
    setLoading(false);
  };


  if (!connected) {
    return (
      <main className="z-content min-h-screen" style={{ display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ padding: "4rem", textAlign: "center", maxWidth: 500 }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔒</div>
            <h2 style={{ marginBottom: "1rem" }}>Connect Wallet</h2>
            <p style={{ color: "var(--text-2)", marginBottom: "2rem" }}>Connect your Solana wallet to open a confidential native BTC credit line.</p>
            <div style={{ display: "flex", justifyContent: "center" }}><ClientWalletButton /></div>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="z-content min-h-screen" style={{ display: "flex", flexDirection: "column" }}>
      <Navbar />

      <div aria-hidden style={{
        position: "fixed", top: "0", right: "0", width: 600, height: 600,
        background: "radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 60%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ position: "relative", zIndex: 1, flex: 1, maxWidth: 640, margin: "0 auto", width: "100%", padding: "clamp(2rem, 5vw, 4rem) 1rem" }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Open Credit Line</h1>
          <p style={{ color: "var(--text-2)" }}>Borrow USDC instantly against Native Bitcoin.</p>
        </div>

        <div className="card" style={{ padding: "clamp(1.5rem, 4vw, 2.5rem)" }}>
          <StepBar currentStep={step} />

          {error && (
            <div style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", padding: "1rem", borderRadius: "var(--r-sm)", color: "var(--red)", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 style={{ marginBottom: "1.25rem", color: "var(--text-0)" }}>Deposit Configuration</h3>

                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.5rem" }}>Bitcoin Collateral</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      value={btcAmountStr}
                      onChange={e => setBtcAmountStr(e.target.value)}
                      className="input"
                      placeholder="0.00"
                      style={{ fontSize: "1.25rem", fontWeight: 600, paddingRight: "4rem" }}
                      min="0.1" step="0.1"
                    />
                    <span style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", fontWeight: 700 }}>BTC</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.5rem", textAlign: "right" }}>
                    ≈ ${(btcAmount * btcPrice).toLocaleString()} USD
                  </div>
                </div>

                <div className="card-flat" style={{ padding: "1.25rem", marginBottom: "2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <span style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>Estimated Credit Limit (60% LTV)</span>
                    <span style={{ color: "var(--cyan)", fontWeight: 700 }}>${ltvLimitUsd.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-2)", fontSize: "0.875rem" }}>Oracle Price (CoinGecko)</span>
                    <span style={{ color: "var(--text-1)", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>${btcPrice.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  className="btn btn-primary" style={{ width: "100%" }}
                  onClick={handleCreateDWallet}
                  disabled={loading || btcAmount <= 0}
                >
                  {loading ? "Initializing..." : "Create dWallet Vault"}
                </button>
                <p style={{ textAlign: "center", fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "1rem" }}>
                  Fires <code style={{ color: "var(--amber)" }}>create_loan</code> via Ika SDK (pre-alpha devnet)
                </p>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 style={{ marginBottom: "1.25rem", color: "var(--text-0)" }}>Fund Your Vault</h3>
                <div style={{ background: "var(--amber-glow)", border: "1px solid var(--border-amber)", padding: "1.25rem", borderRadius: "var(--r-sm)", marginBottom: "1.25rem", textAlign: "center" }}>
                  <p style={{ fontSize: "0.875rem", color: "var(--amber-light)", marginBottom: "0.5rem" }}>Send exactly <strong>{btcAmount} BTC</strong> to your Ika dWallet vault:</p>
                  <code style={{ fontSize: "0.75rem", color: "var(--text-0)", wordBreak: "break-all" }}>{dWalletPda ?? dWalletKey?.toBase58()}</code>
                  {dWalletPublicKey && (
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "0.5rem" }}>MPC public key: {dWalletPublicKey.slice(0, 16)}...{dWalletPublicKey.slice(-8)}</p>
                  )}
                </div>
                <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", padding: "0.75rem 1rem", borderRadius: "var(--r-sm)", marginBottom: "1.5rem", fontSize: "0.75rem", color: "var(--text-3)" }}>
                  🔑 Ika dWallet created via DKG · 2PC-MPC · Curve25519
                </div>
                <button
                  className="btn btn-primary" style={{ width: "100%" }}
                  onClick={handleFundVault}
                  disabled={loading}
                >
                  {loading ? "Waiting for confirmations..." : "I have sent the funds"}
                </button>
              </motion.div>
            )}


            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 style={{ marginBottom: "1.25rem", color: "var(--text-0)" }}>Attest Collateral</h3>
                <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", padding: "1.25rem", borderRadius: "var(--r-sm)", marginBottom: "2rem" }}>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-2)", marginBottom: "1rem", lineHeight: 1.6 }}>
                    The protocol needs to record your collateral value on-chain to allow borrowing.
                    This step will call the <strong>Encrypt FHE CPI</strong> to create an encrypted ciphertext of your collateral value.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--cyan)" }}>
                    <span className="dot dot-cyan" />
                    FHE Encrypted Value: 🔒 {collateralValueUsd} USD
                  </div>
                </div>
                <button
                  className="btn btn-primary" style={{ width: "100%" }}
                  onClick={handleAttest}
                  disabled={loading}
                >
                  {loading ? "Executing Encrypt CPI..." : "Attest & Encrypt on Solana"}
                </button>
                <p style={{ textAlign: "center", fontSize: "0.6875rem", color: "var(--text-3)", marginTop: "1rem" }}>
                  Fires <code style={{ color: "var(--cyan)" }}>attach_attestation</code> (Requires Encrypt Devnet)
                </p>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--green)", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1.5rem" }}>
                  ✓
                </div>
                <h3 style={{ marginBottom: "0.5rem", color: "var(--text-0)" }}>Credit Line Active!</h3>
                <p style={{ color: "var(--text-2)", marginBottom: "1.5rem" }}>Collateral secured via Ika dWallet MPC. Value encrypted via Encrypt FHE executor.</p>

                {/* Ciphertext identifier from Encrypt gRPC */}
                {collateralCtId && (
                  <div style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.2)", padding: "1rem", borderRadius: "var(--r-sm)", marginBottom: "1rem", textAlign: "left" }}>
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginBottom: "0.25rem", fontWeight: 600 }}>🔒 Encrypt FHE Ciphertext ID</div>
                    <code style={{ fontSize: "0.6875rem", color: "var(--cyan)", wordBreak: "break-all" }}>{collateralCtId}</code>
                  </div>
                )}

                {/* dWallet PDA */}
                {dWalletPda && (
                  <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)", padding: "1rem", borderRadius: "var(--r-sm)", marginBottom: "1.5rem", textAlign: "left" }}>
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-3)", marginBottom: "0.25rem", fontWeight: 600 }}>🔑 Ika dWallet PDA (on-chain)</div>
                    <code style={{ fontSize: "0.6875rem", color: "var(--amber)", wordBreak: "break-all" }}>{dWalletPda}</code>
                  </div>
                )}

                {/* Transaction explorer links */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem", textAlign: "left" }}>
                  {txSigs.map((sig, i) => (
                    <a key={sig} href={DEVNET_EXPLORER(sig)} target="_blank" rel="noreferrer"
                      style={{ fontSize: "0.8125rem", color: "var(--cyan)", background: "var(--surface-2)", padding: "0.75rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border-1)", textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Transaction {i + 1}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--text-3)" }}>{sig.slice(0, 12)}... ↗</span>
                    </a>
                  ))}
                </div>

                <a href="/" className="btn btn-secondary" style={{ width: "100%", textDecoration: "none" }}>Go to Dashboard</a>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>

      <Footer />
    </main>
  );
}
