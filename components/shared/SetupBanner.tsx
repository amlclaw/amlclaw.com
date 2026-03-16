"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export default function SetupBanner() {
  const pathname = usePathname();
  const [cliMissing, setCliMissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (pathname === "/settings") return;

    const stored = sessionStorage.getItem("setup_banner_dismissed");
    if (stored === "true") {
      setDismissed(true);
      return;
    }

    // Check if Claude Code is available by testing connection
    fetch("/api/settings/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setCliMissing(true);
        }
      })
      .catch(() => {});
  }, [pathname]);

  if (!cliMissing || dismissed || pathname === "/settings") return null;

  return (
    <div className="setup-banner">
      <div className="setup-banner-content">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>
          Claude Code not detected. Please install Claude Code CLI and run <code style={{ fontFamily: "var(--mono)", fontSize: "inherit", background: "var(--surface-3)", padding: "1px 4px", borderRadius: 3 }}>claude login</code> to get started.
        </span>
        <button
          className="btn-icon"
          onClick={() => {
            setDismissed(true);
            sessionStorage.setItem("setup_banner_dismissed", "true");
          }}
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
