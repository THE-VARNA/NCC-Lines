"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { useState } from "react";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      id="main-nav"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(8, 11, 18, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #f7931a, #e8820f)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "0.9rem",
              color: "#000",
              boxShadow: "0 0 16px rgba(247,147,26,0.4)",
            }}
          >
            ₿
          </div>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "#f0f4ff", letterSpacing: "-0.02em" }}>
            NCC Lines
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          {[
            { href: "/", label: "Dashboard" },
            { href: "/borrow", label: "Borrow" },
            { href: "/pools", label: "Pools" },
            { href: "/proofs", label: "Proofs" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                color: "rgba(200, 210, 240, 0.7)",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 500,
                transition: "color 150ms",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#f0f4ff")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "rgba(200, 210, 240, 0.7)")}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Wallet button */}
        <WalletMultiButton />
      </div>
    </nav>
  );
}
