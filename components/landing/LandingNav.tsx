"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const navLinks = [
  { href: "#pipeline", label: "How It Works" },
  { href: "#features", label: "Capabilities" },
  { href: "#comparison", label: "Compare" },
  { href: "#jurisdictions", label: "Coverage" },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`landing-nav${scrolled ? " scrolled" : ""}`}>
      <a href="#" className="landing-nav-logo">
        <Image src="/logo.svg" alt="AMLClaw" width={28} height={28} />
        <span>
          AML<span style={{ color: "var(--landing-gold)" }}>Claw</span>
        </span>
      </a>

      <div className="landing-nav-links">
        {navLinks.map((l) => (
          <a key={l.href} href={l.href} className="landing-nav-link">
            {l.label}
          </a>
        ))}
        <a
          href="https://github.com/amlclaw/amlclaw-web"
          target="_blank"
          rel="noopener"
          className="landing-nav-link"
          style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
          </svg>
          GitHub ⭐
        </a>
        <a href="/documents" className="landing-nav-cta">
          进入平台
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>

      <button
        className="landing-nav-mobile-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {mobileOpen ? (
            <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
          ) : (
            <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
          )}
        </svg>
      </button>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 0,
            right: 0,
            background: "var(--landing-navy-light)",
            borderBottom: "1px solid var(--landing-border)",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 99,
          }}
        >
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="landing-nav-link"
              onClick={() => setMobileOpen(false)}
              style={{ padding: "8px 0" }}
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://github.com/amlclaw/amlclaw-web"
            target="_blank"
            rel="noopener"
            className="landing-nav-link"
            onClick={() => setMobileOpen(false)}
            style={{ padding: "8px 0" }}
          >
            GitHub ⭐
          </a>
          <a href="/documents" className="landing-nav-cta" style={{ justifyContent: "center", marginTop: 4 }}>
            进入平台 →
          </a>
        </div>
      )}
    </nav>
  );
}
