"use client";

import { useState, useEffect, useRef } from "react";

const steps = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    title: "Regulatory Researcher",
    desc: "Reads 40+ international regulations and builds your compliance knowledge base",
    detail: "The AI Regulatory Researcher automatically reads and interprets regulatory documents from MAS, SFC, VARA, and 40+ other frameworks. It extracts key requirements and builds a structured compliance knowledge base. Upload your own regulation documents too.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "Policy Analyst",
    desc: "Interprets regulations and generates structured compliance policies",
    detail: "The AI Policy Analyst breaks down regulatory requirements clause by clause and generates structured compliance policy documents covering KYC/CDD, transaction monitoring, suspicious activity reporting, and more. Fully editable by humans.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    title: "Rule Engineer",
    desc: "Converts policies into executable JSON detection rules",
    detail: "The AI Rule Engineer automatically translates policy clauses into machine-executable JSON rule sets. Fine-tune thresholds, conditions, and parameters with a visual editor. Every rule traces back to its source regulation.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    title: "Screening Expert",
    desc: "On-chain tracing and risk assessment across 5 screening scenarios",
    detail: "The AI Screening Expert performs multi-hop on-chain tracing, extracts risk paths and entity labels, and runs scenario-based risk assessments. Generates complete evidence-chain reports for onboarding, transactions, periodic reviews, and more.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    title: "Monitoring Guardian",
    desc: "24/7 automated re-screening and real-time alerts",
    detail: "The AI Monitoring Guardian runs scheduled batch screenings via cron jobs — hourly to daily. Risk level changes automatically trigger webhook alerts. Full audit trail, 24/7 protection, zero manual effort.",
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
