"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function SetupBanner() {
  const pathname = usePathname();
  const [keyMissing, setKeyMissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (pathname === "/settings") return;

    const stored = sessionStorage.getItem("setup_banner_dismissed");
    if (stored === "true") {
      setDismissed(true);
      return;
    }

    // Check whether the width.info API key is configured
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.api?.widthApiKey) {
          setKeyMissing(true);
        }
      })
      .catch(() => {});
  }, [pathname]);

  if (!keyMissing || dismissed || pathname === "/settings") return null;

  return (
    <div className="setup-banner">
      <div className="setup-banner-content">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>
          Width.info API key not configured — screening will fail. Get a free key at{" "}
          <a href="https://width.info/api-keys" target="_blank" rel="noopener" style={{ color: "var(--primary-500)" }}>width.info</a>
          {" "}and set it in <Link href="/settings" style={{ color: "var(--primary-500)" }}>Settings</Link>.
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
