"use client";

import { useScrollReveal } from "./useScrollReveal";

export default function CTASection() {
  const ref = useScrollReveal();

  return (
    <section className="landing-cta" id="cta" ref={ref}>
      <div className="landing-scroll-reveal">
        <h2 className="landing-cta-title">部署你的 AI 合规团队</h2>
        <p className="landing-cta-desc">
          开源免费 · 私有部署 · MIT License · 无需注册
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/documents" className="landing-cta-btn">
            docker-compose up
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </a>
          <a
            href="https://github.com/amlclaw/amlclaw-web"
            target="_blank"
            rel="noopener"
            className="landing-cta-btn"
            style={{ background: "transparent", border: "1px solid var(--landing-gold)", color: "var(--landing-gold)" }}
          >
            查看源码
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
            </svg>
          </a>
        </div>
        <div className="landing-cta-trust">
          全球开发者共建 · 代码完全透明 · 数据完全自主
        </div>
      </div>
    </section>
  );
}
