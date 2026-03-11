"use client";

import { useEffect, useRef, useState } from "react";

const lines = [
  { time: "09:00", text: "Upload MAS PSN02 regulation document", status: "" },
  { time: "09:01", text: "AI generates compliance policy", status: "done" },
  { time: "09:02", text: "38 detection rules created", status: "done" },
  { time: "09:03", text: "Submit address → select 'Onboarding' scenario", status: "" },
  { time: "09:05", text: "Screening complete — Recommendation: Enhanced Due Diligence", status: "warn" },
  { time: "09:06", text: "Continuous monitoring configured — daily at 08:00", status: "done" },
];

export default function ScreenDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !triggered.current) {
          triggered.current = true;
          observer.disconnect();
          let count = 0;
          const interval = setInterval(() => {
            count++;
            setVisibleCount(count);
            if (count >= lines.length) clearInterval(interval);
          }, 800);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="landing-section" id="screen-demo" ref={sectionRef}>
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          Watch Your AI Team Work
        </h2>
      </div>

      <div className="landing-screendemo-terminal">
        <div className="landing-screendemo-header">
          <span className="landing-screendemo-dot landing-screendemo-dot-red" />
          <span className="landing-screendemo-dot landing-screendemo-dot-yellow" />
          <span className="landing-screendemo-dot landing-screendemo-dot-green" />
          <span className="landing-screendemo-title-bar">amlclaw-team@your-server ~ $</span>
        </div>
        <div className="landing-screendemo-body">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`landing-screendemo-line${i < visibleCount ? " landing-screendemo-line-visible" : ""}`}
            >
              <span className="landing-screendemo-time">{line.time}</span>
              <span className="landing-screendemo-text">{line.text}</span>
              {line.status === "done" && (
                <svg className="landing-screendemo-icon-done" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {line.status === "warn" && (
                <svg className="landing-screendemo-icon-warn" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>
          ))}
          {visibleCount >= lines.length && (
            <div className="landing-screendemo-cursor">_</div>
          )}
        </div>
      </div>

      <p className="landing-screendemo-compare">
        Traditional approach: <strong>4 weeks</strong>. AMLClaw: <strong>6 minutes</strong>.
      </p>
    </section>
  );
}
