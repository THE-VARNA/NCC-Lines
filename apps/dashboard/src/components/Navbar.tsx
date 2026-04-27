"use client";

import { ClientWalletButton } from "@/components/ClientWalletButton";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/borrow", label: "Borrow" },
  { href: "/pools", label: "Pools" },
  { href: "/proofs", label: "Proofs" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="z-nav"
      style={{
        background: scrolled ? "rgba(2,6,15,0.96)" : "rgba(2,6,15,0.72)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: scrolled
          ? "1px solid rgba(255,255,255,0.08)"
          : "1px solid rgba(255,255,255,0.04)",
        transition: "background 0.3s ease, border-color 0.3s ease",
      }}
    >
      <div className="container" style={{
        height: "var(--nav-h)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none", flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.0625rem", fontWeight: 900, color: "#000",
            boxShadow: "var(--shadow-amber)", flexShrink: 0,
          }}>₿</div>
          <div className="hide-mobile">
            <span style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "-0.025em", color: "var(--text-0)" }}>NCC</span>
            <span style={{ fontWeight: 400, fontSize: "0.9375rem", color: "var(--text-2)", marginLeft: 5 }}>Lines</span>
          </div>
        </Link>

        {/* Desktop nav links */}
        <div className="hide-mobile" style={{ display: "flex", gap: "0.125rem", alignItems: "center" }}>
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className="btn btn-ghost"
                style={{
                  color: active ? "var(--text-0)" : "var(--text-2)",
                  fontWeight: active ? 600 : 500,
                  fontSize: "0.875rem",
                  position: "relative",
                }}>
                {label}
                {active && (
                  <span style={{
                    position: "absolute", bottom: 2, left: "50%",
                    transform: "translateX(-50%)",
                    width: 16, height: 2,
                    background: "var(--amber)", borderRadius: 2,
                  }} />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexShrink: 0 }}>
          <ClientWalletButton />
          <button
            className="show-mobile-only"
            onClick={() => setOpen(!open)}
            style={{
              background: "none",
              border: "1px solid var(--border-2)",
              borderRadius: "var(--r-xs)",
              padding: "0.4rem 0.6rem",
              cursor: "pointer",
              color: "var(--text-1)",
              fontSize: "1rem",
              lineHeight: 1,
              transition: "background var(--t-sm)",
            }}
            aria-label="Toggle menu"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="show-mobile-only animate-in-fast" style={{
          borderTop: "1px solid var(--border-1)",
          background: "rgba(2,6,15,0.98)",
          padding: "0.625rem 1rem 1rem",
          display: "flex", flexDirection: "column", gap: "0.25rem",
        }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href}
              onClick={() => setOpen(false)}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "var(--r-sm)",
                color: pathname === href ? "var(--text-0)" : "var(--text-1)",
                textDecoration: "none",
                fontWeight: pathname === href ? 600 : 400,
                fontSize: "0.9375rem",
                background: pathname === href ? "var(--surface-2)" : "transparent",
                display: "block",
                transition: "background var(--t-sm)",
              }}
            >{label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}
