import Image from "next/image";

const productLinks = [
  { label: "地址筛查 KYA", href: "/screening" },
  { label: "交易筛查 KYT", href: "/kyt" },
  { label: "地址监控", href: "/monitoring" },
  { label: "TX 监控", href: "/tx-monitoring" },
  { label: "API 文档", href: "/docs" },
];

const engineLinks = [
  { label: "Width DAIA", href: "https://npc7.github.io/daia-site/" },
  { label: "Width.info 平台", href: "https://width.info" },
  { label: "Width.info API 文档", href: "https://width.info/api-reference" },
  { label: "申请 API Key", href: "https://width.info/api-keys" },
];

const communityLinks = [
  { label: "GitHub 仓库", href: "https://github.com/amlclaw/amlclaw.com" },
  { label: "贡献指南", href: "https://github.com/amlclaw/amlclaw.com/blob/main/CONTRIBUTING.md" },
  { label: "问题反馈", href: "https://github.com/amlclaw/amlclaw.com/issues" },
  { label: "更新日志", href: "https://github.com/amlclaw/amlclaw.com/blob/main/CHANGELOG.md" },
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
            由 Width DAIA 团队开源的加密货币 AML 合规工作台 —— 地址与交易筛查、持续监控、风险告警，自主部署，数据不出你的服务器。
          </div>
        </div>

        <div>
          <div className="landing-footer-heading">产品</div>
          {productLinks.map((l) => (
            <a key={l.label} href={l.href} className="landing-footer-link">
              {l.label}
            </a>
          ))}
        </div>

        <div>
          <div className="landing-footer-heading">底层引擎</div>
          {engineLinks.map((l) => (
            <a key={l.label} href={l.href} className="landing-footer-link" target="_blank" rel="noopener">
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
      </div>

      <div className="landing-footer-bottom">
        <span>&copy; {new Date().getFullYear()} AMLClaw · MIT 协议 · 由 Width DAIA 团队开源</span>
        <span>筛查能力由 Width.info KYA / KYT API 驱动</span>
      </div>

      <div className="landing-footer-legal">
        AMLClaw 是开源的合规工具，不构成法律意见，也不能替代专业合规顾问。
        使用者需自行确保其合规方案满足所在司法辖区的监管要求。
      </div>
    </footer>
  );
}
