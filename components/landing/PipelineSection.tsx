"use client";

import { useState, useEffect, useRef } from "react";

const steps = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: "KYA Address Screening",
    desc: "Multi-hop fund tracing with a server-side compliance ruleset engine",
    detail: "Screen any Ethereum or Tron address against professional compliance rulesets — Sanctions, Terrorism Financing, Cybercrime, Gambling and more. Rulesets run server-side on width.info; you get risk scores, exposure breakdowns, rule hits, and full path evidence with an interactive fund-flow graph.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    ),
    title: "KYT Transaction Screening",
    desc: "Chainalysis-aligned tx screening — in, out, or both directions",
    detail: "Paste a transaction hash and screen its source of funds (in), destination (out), or both. Each direction uses its own dedicated KYT ruleset. Results include Chainalysis-compatible alerts, per-rule hit evidence, and recommended actions: block, review, alert, or monitor.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "Address Monitoring",
    desc: "Watch future transactions — every new transfer is KYT-screened",
    detail: "Add an address and AMLClaw watches its FUTURE stablecoin transfers via Etherscan and TronGrid. Every new USDT/USDC transfer above your threshold is automatically KYT-screened — incoming funds as 'in', outgoing as 'out'. High-risk hits fire webhook alerts instantly.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    title: "KYT Counterparty Monitoring",
    desc: "Track a tx's from/to address with periodic KYA re-screening",
    detail: "From any KYT result, put the transaction's from or to address under monitoring. AMLClaw re-runs a KYA screen on your schedule (hourly to daily), tracks the risk trend, and alerts the moment the counterparty's risk level escalates.",
  },
];

export default function PipelineSection() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const stepEls = container.querySelectorAll(".landing-pipeline-step");
          const connEls = container.querySelectorAll(".landing-pipeline-connector");
          stepEls.forEach((el, i) => {
            setTimeout(() => el.classList.add("visible"), i * 300);
          });
          connEls.forEach((el, i) => {
            setTimeout(() => el.classList.add("visible"), i * 300 + 150);
          });
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="landing-section" id="pipeline">
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          Five AI Agents. One Compliance Team.
        </h2>
        <p className="landing-section-desc" style={{ margin: "0 auto 0" }}>
          Each agent handles a distinct role. Fully automated, every step auditable.
        </p>
      </div>

      <div className="landing-pipeline" ref={containerRef}>
        {steps.map((step, i) => (
          <div key={i} className="landing-pipeline-item">
            <div
              className={`landing-pipeline-step${expanded === i ? " landing-pipeline-step-active" : ""}`}
              onClick={() => setExpanded(expanded === i ? null : i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpanded(expanded === i ? null : i);
                }
              }}
            >
              <div className="landing-pipeline-icon">{step.icon}</div>
              <div className="landing-pipeline-num">0{i + 1}</div>
              <div className="landing-pipeline-title">{step.title}</div>
              <div className="landing-pipeline-desc">{step.desc}</div>
              <div className={`landing-pipeline-detail${expanded === i ? " landing-pipeline-detail-open" : ""}`}>
                <p>{step.detail}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="landing-pipeline-connector">
                <div className="landing-pipeline-line-fill" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
