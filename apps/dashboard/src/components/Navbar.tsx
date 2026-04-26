"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/borrow", label: "Borrow" },
  { href: "/pools", label: "Pools" },
  { href: "/proofs", label: "Proofs" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="z-nav"
      style={{
        background: "rgba(6, 8, 16, 0.88)",
        backdropFilter: "var(--blur-md)",
        WebkitBackdropFilter: "var(--blur-md)",
        borderBottom: "1px solid var(--border-0)",
      }}
    >
      <div className="container" style={{ height: "var(--nav-h)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none", flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg, var(--amber), #c96e08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem", fontWeight: 900, color: "#000",
            boxShadow: "var(--shadow-amber)",
            flexShrink: 0,
          }}>₿</div>
          <div className="hide-mobile">
            <span style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "-0.02em", color: "var(--text-0)" }}>NCC</span>
            <span style={{ fontWeight: 400, fontSize: "0.9375rem", color: "var(--text-2)", marginLeft: 4 }}>Lines</span>
          </div>
        </Link>

        {/* Desktop nav links */}
        <div className="hide-mobile" style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="btn btn-ghost"
              style={{ color: "var(--text-1)", transition: "color var(--t-sm)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-0)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-1)")}
            >{label}</Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          <div suppressHydrationWarning>
            <WalletMultiButton />
          </div>
          {/* Mobile hamburger */}
          <button
            className="show-mobile-only"
            onClick={() => setOpen(!open)}
            style={{ background: "none", border: "1px solid var(--border-1)", borderRadius: "var(--r-sm)", padding: "0.375rem 0.5rem", cursor: "pointer", color: "var(--text-1)" }}
            aria-label="Toggle menu"
          >☰</button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="show-mobile-only animate-in-fast" style={{
          borderTop: "1px solid var(--border-0)",
          background: "rgba(6,8,16,0.98)",
          padding: "0.75rem 1rem",
          display: "flex", flexDirection: "column", gap: "0.25rem",
        }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              style={{ padding: "0.625rem 0.75rem", borderRadius: "var(--r-sm)", color: "var(--text-1)", textDecoration: "none", fontWeight: 500, fontSize: "0.9375rem" }}
            >{label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}
