"use client";

import { useEffect, useRef } from "react";

const stats = [
  { label: "MIT", sublabel: "开源协议" },
  { label: "KYA + KYT", sublabel: "双筛查引擎" },
  { label: "5 分钟", sublabel: "自主部署" },
];

export default function HeroSection() {
  const statsRef = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = statsRef.current;
    if (!el || animated.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !animated.current) {
          animated.current = true;
          observer.disconnect();
          el.querySelectorAll(".landing-hero-stat").forEach((stat, i) => {
            setTimeout(() => stat.classList.add("visible"), i * 200);
          });
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="landing-hero" id="hero">
      <svg className="landing-hero-bg-svg" viewBox="0 0 1200 800" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="200" cy="300" r="3" fill="rgba(138,180,248,0.15)" />
        <circle cx="400" cy="150" r="4" fill="rgba(138,180,248,0.12)" />
        <circle cx="600" cy="400" r="3" fill="rgba(138,180,248,0.1)" />
        <circle cx="800" cy="200" r="5" fill="rgba(138,180,248,0.12)" />
        <circle cx="1000" cy="350" r="3" fill="rgba(138,180,248,0.08)" />
        <circle cx="300" cy="500" r="4" fill="rgba(138,180,248,0.1)" />
        <circle cx="700" cy="600" r="3" fill="rgba(138,180,248,0.08)" />
        <circle cx="900" cy="500" r="4" fill="rgba(138,180,248,0.1)" />
        <circle cx="500" cy="250" r="3" fill="rgba(138,180,248,0.12)" />
        <circle cx="150" cy="600" r="3" fill="rgba(138,180,248,0.08)" />
        <circle cx="1050" cy="150" r="3" fill="rgba(138,180,248,0.1)" />
        <line x1="200" y1="300" x2="400" y2="150" stroke="rgba(138,180,248,0.06)" strokeWidth="1" />
        <line x1="400" y1="150" x2="600" y2="400" stroke="rgba(138,180,248,0.05)" strokeWidth="1" />
        <line x1="600" y1="400" x2="800" y2="200" stroke="rgba(138,180,248,0.06)" strokeWidth="1" />
        <line x1="800" y1="200" x2="1000" y2="350" stroke="rgba(138,180,248,0.05)" strokeWidth="1" />
        <line x1="200" y1="300" x2="300" y2="500" stroke="rgba(138,180,248,0.04)" strokeWidth="1" />
        <line x1="600" y1="400" x2="700" y2="600" stroke="rgba(138,180,248,0.04)" strokeWidth="1" />
        <line x1="800" y1="200" x2="900" y2="500" stroke="rgba(138,180,248,0.05)" strokeWidth="1" />
        <line x1="400" y1="150" x2="500" y2="250" stroke="rgba(138,180,248,0.06)" strokeWidth="1" />
        <line x1="500" y1="250" x2="600" y2="400" stroke="rgba(138,180,248,0.05)" strokeWidth="1" />
        <line x1="300" y1="500" x2="700" y2="600" stroke="rgba(138,180,248,0.04)" strokeWidth="1" />
        <line x1="900" y1="500" x2="1000" y2="350" stroke="rgba(138,180,248,0.05)" strokeWidth="1" />
        <line x1="1000" y1="350" x2="1050" y2="150" stroke="rgba(138,180,248,0.04)" strokeWidth="1" />
        <line x1="150" y1="600" x2="300" y2="500" stroke="rgba(138,180,248,0.04)" strokeWidth="1" />
      </svg>

      <div className="landing-hero-content">
        <h1>
          加密货币 AML 合规工作台
          <br />
          <span className="landing-hero-gold">开源 · 自主部署 · 5 分钟上手</span>
        </h1>

        <p className="landing-hero-sub">
          AMLClaw 用专业合规规则集筛查<strong>地址（KYA）</strong>与<strong>交易（KYT）</strong>，
          <br />
          并以<strong>地址监控</strong>和<strong>对手方监控</strong>持续盯防 ——
          <br />
          高风险资金往来与制裁 / 冻结标签变化，第一时间告警。
        </p>

        <p className="landing-hero-sub-en">
          由 Width DAIA 团队开源，底层基于 Width.info KYA / KYT API。
          <br />
          无需数据库、无需复杂配置、无厂商锁定，数据不出你的服务器（MIT 协议）。
        </p>

        <div className="landing-hero-actions">
          <a href="/screening" className="landing-hero-btn-primary">
            立即开始
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </a>
          <a
            href="https://github.com/amlclaw/amlclaw.com"
            target="_blank"
            rel="noopener"
            className="landing-hero-btn-secondary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
            </svg>
            查看源码
          </a>
        </div>
      </div>

      <div className="landing-hero-stats" ref={statsRef}>
        {stats.map((s) => (
          <div key={s.sublabel} className="landing-hero-stat">
            <span className="landing-hero-stat-number">{s.label}</span>
            <div className="landing-hero-stat-label">{s.sublabel}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
