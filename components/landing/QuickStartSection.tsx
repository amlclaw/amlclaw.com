"use client";

import { useScrollReveal } from "./useScrollReveal";

const steps = [
  {
    num: "01",
    title: "Clone & Run",
    code: "git clone https://github.com/amlclaw/amlclaw.com.git\ncd amlclaw.com && npm install && npm run dev",
    desc: "One command to get it running locally.",
  },
  {
    num: "02",
    title: "Add Your AI Key",
    code: "Settings → AI Provider → paste your API key → done",
    desc: "Works with OpenAI, Anthropic, or any compatible provider.",
  },
  {
    num: "03",
    title: "Start Screening",
    code: "Upload regulations → Generate policies → Screen addresses",
    desc: "Your AI compliance team is live.",
  },
];

export default function QuickStartSection() {
  const ref = useScrollReveal();

  return (
    <section className="landing-section" id="quick-start" ref={ref}>
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          Up and Running in 3 Steps
        </h2>
        <p className="landing-section-desc" style={{ margin: "0 auto 0" }}>
          No database. No complex configuration. Just your AI API key.
        </p>
      </div>

      <div className="landing-scroll-reveal" style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px", margin: "56px auto 0" }}>
        {steps.map((step) => (
          <div
            key={step.num}
            style={{
              padding: "28px 32px",
              background: "var(--landing-surface-2)",
              border: "1px solid var(--landing-border)",
              borderRadius: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--landing-accent)",
                letterSpacing: "0.05em",
              }}>
                {step.num}
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--landing-text)" }}>
                {step.title}
              </span>
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
              fontSize: "0.8rem",
              color: "var(--landing-accent)",
              background: "rgba(0,0,0,0.2)",
              padding: "12px 16px",
              borderRadius: "4px",
              marginBottom: "8px",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6,
            }}>
              {step.code}
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--landing-text-secondary)" }}>
              {step.desc}
            </div>
          </div>
        ))}

        <div style={{
          textAlign: "center",
          padding: "20px",
          background: "var(--landing-accent-dim)",
          border: "1px solid var(--landing-accent-border)",
          borderRadius: "8px",
          fontSize: "0.875rem",
          color: "var(--landing-text-secondary)",
          lineHeight: 1.7,
        }}>
          <strong style={{ color: "var(--landing-accent)" }}>Want full blockchain data?</strong>
          <br />
          Add a free TrustIn API key in Settings → Address Data. Without it, screening works with desensitized (masked) data.
          <br />
          Get your free key at{" "}
          <a href="https://trustin.info" target="_blank" rel="noopener" style={{ color: "var(--landing-accent)", textDecoration: "underline" }}>
            trustin.info
          </a>
        </div>
      </div>
    </section>
  );
}
