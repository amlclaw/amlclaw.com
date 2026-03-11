import Image from "next/image";

const productLinks = [
  { label: "Documents", href: "/documents" },
  { label: "Policies", href: "/policies" },
  { label: "Rules", href: "/rules" },
  { label: "Screening", href: "/screening" },
  { label: "Monitoring", href: "/monitoring" },
];

const resourceLinks = [
  { label: "GitHub Repository", href: "https://github.com/amlclaw/amlclaw.com" },
  { label: "FATF Guidelines", href: "#" },
  { label: "TrustIn API", href: "https://trustin.info" },
  { label: "Documentation", href: "/tech-docs" },
];

const communityLinks = [
  { label: "GitHub", href: "https://github.com/amlclaw/amlclaw.com" },
  { label: "Contributing Guide", href: "https://github.com/amlclaw/amlclaw.com/blob/main/CONTRIBUTING.md" },
  { label: "Report Issues", href: "https://github.com/amlclaw/amlclaw.com/issues" },
  { label: "Changelog", href: "https://github.com/amlclaw/amlclaw.com/blob/main/CHANGELOG.md" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "Compliance Notice", href: "#" },
];

export default function FooterSection() {
  return (
    <footer className="landing-footer" id="footer">
      <div className="landing-footer-grid">
        <div>
          <div className="landing-footer-brand">
            <Image src="/logo.svg" alt="AMLClaw" width={24} height={24} />
            AML<span style={{ color: "var(--landing-accent)" }}>Claw</span>
          </div>
          <div className="landing-footer-tagline">
            Your AI compliance team. Open source, self-hosted, fully automated — from regulatory interpretation to 24/7 on-chain monitoring.
          </div>
        </div>

        <div>
          <div className="landing-footer-heading">Platform</div>
          {productLinks.map((l) => (
            <a key={l.label} href={l.href} className="landing-footer-link">
              {l.label}
            </a>
          ))}
        </div>

        <div>
          <div className="landing-footer-heading">Resources</div>
          {resourceLinks.map((l) => (
            <a key={l.label} href={l.href} className="landing-footer-link" target={l.href.startsWith("http") ? "_blank" : undefined} rel={l.href.startsWith("http") ? "noopener" : undefined}>
              {l.label}
            </a>
          ))}
        </div>

        <div>
          <div className="landing-footer-heading">Community</div>
          {communityLinks.map((l) => (
            <a key={l.label} href={l.href} className="landing-footer-link" target="_blank" rel="noopener">
              {l.label}
            </a>
          ))}
        </div>

        <div>
          <div className="landing-footer-heading">Legal</div>
          {legalLinks.map((l) => (
            <a key={l.label} href={l.href} className="landing-footer-link">
              {l.label}
            </a>
          ))}
        </div>
      </div>

      <div className="landing-footer-bottom">
        <span>&copy; {new Date().getFullYear()} AMLClaw. All rights reserved.</span>
        <span>Open Source · Self-Hosted · MIT License</span>
      </div>

      <div className="landing-footer-legal">
        AMLClaw is an open-source compliance automation tool. It does not constitute legal advice
        and should not be relied upon as a substitute for professional compliance counsel.
        Users are responsible for ensuring their compliance programs meet applicable regulatory
        requirements in their respective jurisdictions.
      </div>
    </footer>
  );
}
