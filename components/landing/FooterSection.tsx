import Image from "next/image";

const productLinks = [
  { label: "Documents", href: "/documents" },
  { label: "Policies", href: "/policies" },
  { label: "Rules", href: "/rules" },
  { label: "Screening", href: "/screening" },
  { label: "Monitoring", href: "/monitoring" },
];

const resourceLinks = [
  { label: "GitHub Repository", href: "https://github.com/amlclaw/amlclaw-web" },
  { label: "FATF Guidelines", href: "#" },
  { label: "TrustIn API", href: "https://trustin.info" },
  { label: "Technical Documentation", href: "/tech-docs" },
];

const communityLinks = [
  { label: "GitHub", href: "https://github.com/amlclaw/amlclaw-web" },
  { label: "贡献指南", href: "https://github.com/amlclaw/amlclaw-web/blob/main/CONTRIBUTING.md" },
  { label: "Issue 反馈", href: "https://github.com/amlclaw/amlclaw-web/issues" },
  { label: "Changelog", href: "https://github.com/amlclaw/amlclaw-web/blob/main/CHANGELOG.md" },
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
            AML<span style={{ color: "var(--landing-gold)" }}>Claw</span>
          </div>
          <div className="landing-footer-tagline">
            你的 AI 合规团队。开源免费，私有部署，从法规解读到 7×24 链上监控，全程自动化、可审计。
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
          <div className="landing-footer-heading">开源社区</div>
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
