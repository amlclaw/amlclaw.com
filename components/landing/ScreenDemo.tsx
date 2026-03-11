"use client";

import { useEffect, useRef, useState } from "react";

const lines = [
  { time: "09:00", text: "选择 MAS PSN02 法规文件", status: "" },
  { time: "09:01", text: "AI 生成合规政策", status: "done" },
  { time: "09:02", text: "38 条检测规则生成完毕", status: "done" },
  { time: "09:03", text: "提交客户地址，选择「开户」场景", status: "" },
  { time: "09:05", text: "筛查完成 — 建议：增强尽调", status: "warn" },
  { time: "09:06", text: "持续监控已配置，每日 08:00 自动运行", status: "done" },
];

export default function ScreenDemo() {
  const [visibleCount, setVisibleCount] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !triggered.current) {
          triggered.current = true;
          observer.disconnect();
          let count = 0;
          const interval = setInterval(() => {
            count++;
            setVisibleCount(count);
            if (count >= lines.length) clearInterval(interval);
          }, 800);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="landing-section" id="screen-demo" ref={sectionRef}>
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          看看你的 AI 团队如何工作
        </h2>
      </div>

      <div className="landing-screendemo-terminal">
        <div className="landing-screendemo-header">
          <span className="landing-screendemo-dot landing-screendemo-dot-red" />
          <span className="landing-screendemo-dot landing-screendemo-dot-yellow" />
          <span className="landing-screendemo-dot landing-screendemo-dot-green" />
          <span className="landing-screendemo-title-bar">amlclaw-team@your-server ~ $</span>
        </div>
        <div className="landing-screendemo-body">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`landing-screendemo-line${i < visibleCount ? " landing-screendemo-line-visible" : ""}`}
            >
              <span className="landing-screendemo-time">{line.time}</span>
              <span className="landing-screendemo-text">{line.text}</span>
              {line.status === "done" && (
                <svg className="landing-screendemo-icon-done" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {line.status === "warn" && (
                <svg className="landing-screendemo-icon-warn" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>
          ))}
          {visibleCount >= lines.length && (
            <div className="landing-screendemo-cursor">_</div>
          )}
        </div>
      </div>

      <p className="landing-screendemo-compare">
        传统方式需要 <strong>4 周</strong>，AMLClaw 只要 <strong>6 分钟</strong>。
      </p>
    </section>
  );
}
