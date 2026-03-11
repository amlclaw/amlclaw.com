"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function SetupBanner() {
  const pathname = usePathname();
  const [needs, setNeeds] = useState<{ ai: boolean; blockchain: boolean } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show on settings page itself
    if (pathname === "/settings") return;

    const stored = sessionStorage.getItem("setup_banner_dismissed");
    if (stored === "true") {
      setDismissed(true);
      return;
    }

    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        const activeProvider = s.ai?.activeProvider || "claude";
        const aiKey = s.ai?.providers?.[activeProvider]?.apiKey || "";
        // Keys are masked (****xxxx) when set, empty when not
        const aiMissing = !aiKey || aiKey === "";
        // TrustIn key is optional — screening works without it (desensitized mode)
        if (aiMissing) {
          setNeeds({ ai: aiMissing, blockchain: false });
        }
      })
      .catch(() => {});
  }, [pathname]);

  if (!needs || dismissed || pathname === "/settings") return null;

  const parts: string[] = [];
  if (needs.ai) parts.push("AI provider API key");
  if (needs.blockchain) parts.push("TrustIn API key");

  return (
    <div className="setup-banner">
      <div className="setup-banner-content">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>
          Setup required: configure your {parts.join(" and ")} to get started.
        </span>
        <Link href="/settings" className="btn btn-sm btn-primary" style={{ marginLeft: "auto" }}>
          Go to Settings
        </Link>
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
