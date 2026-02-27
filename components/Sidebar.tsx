"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function Sidebar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    setTheme(stored === "light" ? "light" : "dark");
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    const next = (theme ?? "dark") === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") {
      document.documentElement.dataset.theme = "light";
      localStorage.setItem("theme", "light");
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem("theme");
    }
  };

  const links = [
    {
      href: "/documents",
      label: "Documents",
      active: pathname.startsWith("/documents"),
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      ),
    },
    {
      href: "/policies",
      label: "Policies",
      active: pathname.startsWith("/policies"),
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      href: "/rules",
      label: "Rules",
      active: pathname.startsWith("/rules"),
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      ),
    },
    {
      href: "/screening",
      label: "Screening",
      active: pathname.startsWith("/screening"),
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      href: "/monitoring",
      label: "Monitoring",
      active: pathname.startsWith("/monitoring"),
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
  ];

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="sidebar-brand">
        <Link href="/" className="sidebar-logo-link">
          <Image src="/logo.svg" alt="AMLClaw" width={28} height={28} />
          <span className="sidebar-logo-text">
            AML<span style={{ color: "var(--primary-500)" }}>Claw</span>
          </span>
          <span className="sidebar-version">v2.0</span>
        </Link>
      </div>

      {/* Nav Links */}
      <div className="sidebar-links">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`sidebar-link${link.active ? " active" : ""}`}
          >
            <span className="sidebar-link-icon">{link.icon}</span>
            <span className="sidebar-link-label">{link.label}</span>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        {theme !== null && (
          <button
            onClick={toggleTheme}
            className="sidebar-link"
            aria-label="Toggle theme"
          >
            <span className="sidebar-link-icon">
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </span>
            <span className="sidebar-link-label">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>
        )}
        <a
          href="https://github.com/amlclaw/amlclaw"
          target="_blank"
          rel="noopener"
          className="sidebar-link"
        >
          <span className="sidebar-link-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
            </svg>
          </span>
          <span className="sidebar-link-label">GitHub</span>
        </a>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="mobile-topbar">
        <Link href="/" className="sidebar-logo-link">
          <Image src="/logo.svg" alt="AMLClaw" width={24} height={24} />
          <span>
            AML<span style={{ color: "var(--primary-500)" }}>Claw</span>
          </span>
        </Link>
        <button
          className="btn-icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Sidebar Overlay (mobile) */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar Nav */}
      <nav className={`sidebar-nav${mobileOpen ? " open" : ""}`}>
        {sidebarContent}
      </nav>
    </>
  );
}
