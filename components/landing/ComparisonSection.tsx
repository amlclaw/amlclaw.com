"use client";

import { useScrollReveal } from "./useScrollReveal";

const iconTraditional = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const iconAmlclaw = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const rows = [
  { aspect: "Cost", traditional: "6-figure compliance team", amlclaw: "Free, MIT License" },
  { aspect: "Deployment", traditional: "Procurement, integration, training — months", amlclaw: "npm run dev — 5 minutes" },
  { aspect: "Regulation Analysis", traditional: "Lawyers + compliance experts, 1-2 weeks", amlclaw: "AI Regulatory Researcher, minutes" },
  { aspect: "Rule Creation", traditional: "Manual drafting by experts, days", amlclaw: "AI Rule Engineer, auto-generated" },
  { aspect: "Address Screening", traditional: "Manual process, half a day per address", amlclaw: "AI Screening Expert, under 5 min" },
  { aspect: "Continuous Monitoring", traditional: "Spot checks, unsustainable", amlclaw: "AI Monitoring Guardian, 24/7 automated" },
  { aspect: "Data Security", traditional: "Data uploaded to third-party platforms", amlclaw: "Self-hosted, data never leaves your server" },
  { aspect: "Audit Trail", traditional: "Scattered across emails and docs", amlclaw: "Full audit log, tamper-proof" },
  { aspect: "Transparency", traditional: "Black-box scoring, no explanation", amlclaw: "Open source, every rule fully visible" },
];

export default function ComparisonSection() {
  const ref = useScrollReveal();

  return (
    <section className="landing-section" id="comparison" ref={ref}>
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          Hire a Team vs. Deploy AMLClaw
        </h2>
      </div>

      <div className="landing-comparison landing-scroll-reveal">
        <table>
          <thead>
            <tr>
              <th>Dimension</th>
              <th className="landing-comparison-th-trad">Traditional</th>
              <th className="landing-comparison-th-aml">AMLClaw (Open Source)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.aspect}>
                <td>{r.aspect}</td>
                <td className="landing-comparison-td-trad">
                  <span className="landing-comparison-icon">{iconTraditional}</span>
                  {r.traditional}
                </td>
                <td className="landing-comparison-td-aml">
                  <span className="landing-comparison-icon">{iconAmlclaw}</span>
                  {r.amlclaw}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="landing-comparison-summary">
        The future of compliance isn&apos;t hiring more people — it&apos;s deploying a better system.
      </p>
    </section>
  );
}
