"use client";

import { ClientWalletButton } from "@/components/ClientWalletButton";
import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <nav
      className="z-nav"
      style={{
        background: scrolled
          ? "rgba(2,6,15,0.97)"
          : "rgba(2,6,15,0.6)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        boxShadow: scrolled ? "0 1px 40px rgba(0,0,0,0.4)" : "none",
        transition: "background 0.4s ease, box-shadow 0.4s ease",
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
          <motion.div
            whileHover={{ scale: 1.08, rotate: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.0625rem", fontWeight: 900, color: "#000",
              boxShadow: "0 0 20px rgba(245,158,11,0.4)", flexShrink: 0,
            }}>₿</motion.div>
          <div className="hide-mobile">
            <span style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "-0.03em", color: "var(--text-0)" }}>NCC</span>
            <span style={{ fontWeight: 400, fontSize: "0.9375rem", color: "var(--text-2)", marginLeft: 5 }}>Lines</span>
          </div>
        </Link>

        {/* Desktop nav — pill-style active indicator */}
        <div className="hide-mobile" style={{ display: "flex", gap: "0.25rem", alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "var(--r-full)", padding: "0.25rem" }}>
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} style={{ position: "relative", textDecoration: "none" }}>
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.08))",
                      border: "1px solid rgba(245,158,11,0.25)",
                      borderRadius: "var(--r-full)",
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <motion.span
                  style={{
                    display: "block",
                    position: "relative", zIndex: 1,
                    padding: "0.375rem 0.875rem",
                    fontSize: "0.875rem",
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--amber)" : "var(--text-2)",
                    borderRadius: "var(--r-full)",
                    whiteSpace: "nowrap",
                  }}
                  whileHover={{ color: active ? "var(--amber)" : "var(--text-1)" }}
                  transition={{ duration: 0.15 }}
                >
                  {label}
                </motion.span>
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
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "var(--r-xs)",
              padding: "0.4rem 0.6rem",
              cursor: "pointer",
              color: "var(--text-1)",
              fontSize: "1rem",
              lineHeight: 1,
            }}
            aria-label="Toggle menu"
          >
            <motion.span
              animate={{ rotate: open ? 45 : 0, scale: open ? 1.2 : 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              style={{ display: "inline-block" }}
            >
              {open ? "✕" : "☰"}
            </motion.span>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="show-mobile-only"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(2,6,15,0.98)",
              backdropFilter: "blur(20px)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "0.75rem 1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {NAV_LINKS.map(({ href, label }, i) => (
                <motion.div
                  key={href}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                >
                  <Link href={href}
                    onClick={() => setOpen(false)}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--r-sm)",
                      color: pathname === href ? "var(--amber)" : "var(--text-1)",
                      textDecoration: "none",
                      fontWeight: pathname === href ? 700 : 400,
                      fontSize: "0.9375rem",
                      background: pathname === href ? "rgba(245,158,11,0.08)" : "transparent",
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      borderLeft: pathname === href ? "2px solid var(--amber)" : "2px solid transparent",
                    }}
                  >
                    {label}
                    {pathname === href && (
                      <motion.span
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--amber)", marginLeft: "auto" }}
                      />
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
