"use client";

import { useScrollReveal } from "./useScrollReveal";

const steps = [
  {
    num: "01",
    title: "克隆并运行",
    code: "git clone https://github.com/amlclaw/amlclaw.com.git\ncd amlclaw.com && npm install && npm run dev",
    desc: "一条命令本地跑起来。",
  },
  {
    num: "02",
    title: "填入 Width.info 密钥",
    code: "设置 → API Keys → 粘贴 width.info 密钥 → 完成",
    desc: "在 width.info 免费申请，驱动 KYA / KYT 筛查与服务端规则集。",
  },
  {
    num: "03",
    title: "开始筛查",
    code: "筛查地址（KYA） → 筛查交易（KYT） → 加入持续监控",
    desc: "你的合规筛查工作台已就绪。",
  },
];

export default function QuickStartSection() {
  const ref = useScrollReveal();

  return (
    <section className="landing-section" id="quick-start" ref={ref}>
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          三步即可上手
        </h2>
        <p className="landing-section-desc" style={{ margin: "0 auto 0" }}>
          无需数据库、无需复杂配置，只要一个 width.info API 密钥。
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
          <strong style={{ color: "var(--landing-accent)" }}>需要哪些密钥？</strong>
          <br />
          <strong>Width.info API Key</strong>（必填）—— 驱动 KYA / KYT 筛查与服务端规则集；
          <strong> Etherscan / TronGrid Key</strong>（选填）—— 供地址监控拉取新交易，不填则走共享默认额度、可能限流。
          三个密钥都可在设置页一键 Test 验证连通性。
          <br />
          免费申请：{" "}
          <a href="https://width.info/api-keys" target="_blank" rel="noopener" style={{ color: "var(--landing-accent)", textDecoration: "underline" }}>
            width.info/api-keys
          </a>
        </div>
      </div>
    </section>
  );
}
