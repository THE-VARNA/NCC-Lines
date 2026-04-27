"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";

/**
 * ClientWalletButton — renders WalletMultiButton only after hydration.
 * Prevents server/client HTML mismatch from the wallet adapter injecting
 * browser-extension icons during SSR vs client render.
 */
export function ClientWalletButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        style={{
          height: 40,
          padding: "0 1.25rem",
          borderRadius: "var(--r-sm)",
          background: "linear-gradient(135deg, var(--amber), var(--amber-dark))",
          color: "#000",
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fontSize: "0.875rem",
          border: "none",
          cursor: "pointer",
          opacity: 0.85,
        }}
        disabled
      >
        Select Wallet
      </button>
    );
  }

  return <WalletMultiButton />;
}
