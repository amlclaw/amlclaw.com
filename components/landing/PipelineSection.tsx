"use client";

import { useState, useEffect, useRef } from "react";

const steps = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    title: "法规研究员",
    desc: "阅读 40+ 国际法规，建立合规知识库",
    detail: "AI 法规研究员自动阅读并理解新加坡 MAS、香港 SFC、迪拜 VARA 等 40+ 国际法规文件，提取关键监管要求，建立结构化的合规知识库。支持上传自定义法规文档。",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: "政策分析师",
    desc: "AI 解读法规，生成结构化合规政策",
    detail: "AI 政策分析师逐条解读监管要求，自动生成结构化合规政策文档。涵盖 KYC/CDD、交易监控、可疑交易报告等核心领域，支持人工审核修改。",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    title: "规则工程师",
    desc: "将政策转译为可执行的 JSON 检测规则",
    detail: "AI 规则工程师将政策条款自动转译为机器可执行的 JSON 规则集。支持可视化编辑器微调阈值、条件和参数，每条规则可溯源至原始法规条款。",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    title: "筛查专家",
    desc: "链上溯源，5 大场景一键筛查出报告",
    detail: "AI 筛查专家基于 TrustIn KYA API 进行多跳链上溯源，自动提取风险路径和实体标签。结合规则集进行场景化风险评估，生成完整证据链报告，覆盖开户、交易、定期审查等 5 大场景。",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    title: "监控卫士",
    desc: "7×24 不间断，自动复查自动告警",
    detail: "AI 监控卫士通过 Cron 定时任务自动执行批量筛查，支持每小时到每日多种频率。风险等级变化自动触发 Webhook 告警通知，全程审计日志记录，7×24 不间断守护。",
  },
];

export default function PipelineSection() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const stepEls = container.querySelectorAll(".landing-pipeline-step");
          const connEls = container.querySelectorAll(".landing-pipeline-connector");
          stepEls.forEach((el, i) => {
            setTimeout(() => el.classList.add("visible"), i * 300);
          });
          connEls.forEach((el, i) => {
            setTimeout(() => el.classList.add("visible"), i * 300 + 150);
          });
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="landing-section" id="pipeline">
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          五个 AI 角色，组成你的合规团队
        </h2>
        <p className="landing-section-desc" style={{ margin: "0 auto 0" }}>
          每个角色各司其职，全程自动化，每一步可审计
        </p>
      </div>

      <div className="landing-pipeline" ref={containerRef}>
        {steps.map((step, i) => (
          <div key={i} className="landing-pipeline-item">
            <div
              className={`landing-pipeline-step${expanded === i ? " landing-pipeline-step-active" : ""}`}
              onClick={() => setExpanded(expanded === i ? null : i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpanded(expanded === i ? null : i);
                }
              }}
            >
              <div className="landing-pipeline-icon">{step.icon}</div>
              <div className="landing-pipeline-num">0{i + 1}</div>
              <div className="landing-pipeline-title">{step.title}</div>
              <div className="landing-pipeline-desc">{step.desc}</div>
              <div className={`landing-pipeline-detail${expanded === i ? " landing-pipeline-detail-open" : ""}`}>
                <p>{step.detail}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="landing-pipeline-connector">
                <div className="landing-pipeline-line-fill" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
