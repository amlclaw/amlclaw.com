"use client";

import { useState, useEffect } from "react";

interface PageGuideProps {
  pageKey: string;
  title: string;
  description: string;
  tips: string[];
}

export default function PageGuide({ pageKey, title, description, tips }: PageGuideProps) {
  const storageKey = `guide_dismissed_${pageKey}`;
  const [collapsed, setCollapsed] = useState(true); // default collapsed until hydration

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    setCollapsed(dismissed === "true");
  }, [storageKey]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (next) {
      localStorage.setItem(storageKey, "true");
    } else {
      localStorage.removeItem(storageKey);
    }
  };

  return (
    <div className="page-guide">
      <button className="page-guide-toggle" onClick={toggle}>
        <span className="page-guide-toggle-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </span>
        <span className="page-guide-toggle-title">{title}</span>
        <span className={`page-guide-chevron${collapsed ? "" : " open"}`}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </button>
      {!collapsed && (
        <div className="page-guide-body">
          <p className="page-guide-desc">{description}</p>
          <ul className="page-guide-tips">
            {tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
