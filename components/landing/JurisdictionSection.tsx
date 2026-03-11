"use client";

import { useScrollReveal } from "./useScrollReveal";

const jurisdictions = [
  {
    flag: "🇸🇬",
    name: "Singapore",
    body: "Monetary Authority of Singapore (MAS)",
    docs: "12 DPT compliance documents",
    preset: "singapore_mas.json",
  },
  {
    flag: "🇭🇰",
    name: "Hong Kong",
    body: "Securities & Futures Commission (SFC)",
    docs: "12 VASP licensing documents",
    preset: "hong_kong_sfc.json",
  },
  {
    flag: "🇦🇪",
    name: "Dubai",
    body: "Virtual Assets Regulatory Authority (VARA)",
    docs: "13 Rulebook documents",
    preset: "dubai_vara.json",
  },
];

const frameworks = [
  "FATF 40 Recommendations",
  "VA/VASP Guidance",
  "Travel Rule",
  "OFAC Sanctions",
  "UN Sanctions Lists",
];

export default function JurisdictionSection() {
  const ref = useScrollReveal();

  return (
    <section className="landing-section landing-section-divider" id="jurisdictions" ref={ref}>
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          Multi-Jurisdiction Compliance
        </h2>
        <p className="landing-section-desc" style={{ margin: "0 auto 0" }}>
          Pre-built rulesets aligned with the world&apos;s leading virtual asset
          regulatory frameworks — deployable immediately.
        </p>
      </div>

      <div className="landing-jurisdictions">
        {jurisdictions.map((j) => (
          <div key={j.name} className="landing-jurisdiction-card landing-scroll-reveal">
            <div className="landing-jurisdiction-flag">{j.flag}</div>
            <div className="landing-jurisdiction-name">{j.name}</div>
            <div className="landing-jurisdiction-body">{j.body}</div>
            <div className="landing-jurisdiction-meta">
              {j.docs}
              <br />
              Preset: <code style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.75rem", background: "var(--landing-surface-2)", padding: "2px 8px", borderRadius: 2, border: "1px solid var(--landing-border)" }}>{j.preset}</code>
            </div>
          </div>
        ))}
      </div>

      <div className="landing-jurisdiction-footer landing-scroll-reveal">
        <div className="landing-jurisdiction-footer-title">
          International Standards &amp; Frameworks
        </div>
        <div className="landing-jurisdiction-footer-frameworks">
          {frameworks.map((f) => (
            <span key={f} className="landing-framework-badge">
              {f}
            </span>
          ))}
        </div>
        <div className="landing-jurisdiction-footer-chains">
          <strong>Supported Blockchains:</strong> Tron · Ethereum · Bitcoin
        </div>
      </div>
    </section>
  );
}
