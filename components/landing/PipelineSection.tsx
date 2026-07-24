"use client";

import { useState, useEffect, useRef } from "react";

const steps = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: "KYA 地址筛查",
    desc: "多跳资金追溯 + 服务端合规规则引擎",
    detail: "对任意以太坊 / Tron 地址执行专业合规规则筛查 —— 制裁、恐怖融资、网络犯罪、赌博等类别。规则集在 Width.info 服务端运行，返回风险等级、分类敞口金额、命中规则明细，以及可交互的资金流向图与完整路径证据。用于开户准入与大额入金前置审查。",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="17" x2="17" y2="7" />
        <polyline points="7 7 17 7 17 17" />
      </svg>
    ),
    title: "KYT 交易筛查",
    desc: "交易级筛查 —— 可分别筛资金来源与去向",
    detail: "输入交易哈希，可筛查资金来源（in）、资金去向（out）或两端；每个方向使用各自独立的 KYT 规则集。结果包含 Chainalysis 风格告警、逐条规则命中证据，以及处置建议：拦截 / 人工复核 / 告警 / 持续观察。",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: "地址监控（持续）",
    desc: "监控该地址后续所有交易，逐笔做 KYT 查询",
    detail: "添加地址后，AMLClaw 通过 Etherscan / TronGrid 持续捕获它未来发生的每一笔稳定币转账。超过设定金额的新交易自动做 KYT 查询 —— 收款按 in 方向、付款按 out 方向 —— 及时发现该地址与高风险地址之间的资金往来。全量交易入台账一笔不漏，高风险命中立即触发 Webhook 告警。",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    title: "KYT 监控（持续）",
    desc: "持续监控交易对手方地址自身的标签变化",
    detail: "从任意 KYT 结果一键把交易的 from 或 to 地址加入监控。AMLClaw 按你设定的周期（每小时至每天）对该地址重新执行 KYA 复筛，跟踪风险趋势 —— 一旦对手方涉及 Sanctions（制裁）、Freeze（冻结）等高风险标签或风险等级升级，第一时间告警。",
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
          四大核心能力
        </h2>
        <p className="landing-section-desc" style={{ margin: "0 auto 0" }}>
          单次筛查 + 持续监控，覆盖准入、交易、事后盯防全流程。点击卡片查看详情。
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
