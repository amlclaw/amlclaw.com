"use client";

import { useScrollReveal } from "./useScrollReveal";

const iconTraditional = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const iconAmlclaw = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const rows = [
  { aspect: "成本", traditional: "年薪百万级合规团队", amlclaw: "免费，MIT License" },
  { aspect: "部署", traditional: "采购、对接、培训，数月", amlclaw: "docker-compose up，5 分钟" },
  { aspect: "读懂法规", traditional: "律师 + 合规专家，1-2 周", amlclaw: "AI 法规研究员，分钟级" },
  { aspect: "编写规则", traditional: "合规专家手写，数天", amlclaw: "AI 规则工程师，自动转译" },
  { aspect: "筛查地址", traditional: "手动操作，半天一个", amlclaw: "AI 筛查专家，<5 分钟" },
  { aspect: "持续监控", traditional: "人工抽查，难以为继", amlclaw: "AI 监控卫士，7×24 自动" },
  { aspect: "数据安全", traditional: "数据上传到第三方平台", amlclaw: "私有部署，数据不出服务器" },
  { aspect: "可审计性", traditional: "散落在邮件和文档中", amlclaw: "全链路审计日志，不可篡改" },
  { aspect: "透明度", traditional: "黑箱评分，不知道为什么", amlclaw: "开源代码，规则完全可见" },
];

export default function ComparisonSection() {
  const ref = useScrollReveal();

  return (
    <section className="landing-section" id="comparison" ref={ref}>
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          雇一个团队 vs 部署 AMLClaw
        </h2>
      </div>

      <div className="landing-comparison landing-scroll-reveal">
        <table>
          <thead>
            <tr>
              <th>维度</th>
              <th className="landing-comparison-th-trad">传统方式</th>
              <th className="landing-comparison-th-aml">AMLClaw（开源）</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.aspect}>
                <td>{r.aspect}</td>
                <td className="landing-comparison-td-trad">
                  <span className="landing-comparison-icon">{iconTraditional}</span>
                  {r.traditional}
                </td>
                <td className="landing-comparison-td-aml">
                  <span className="landing-comparison-icon">{iconAmlclaw}</span>
                  {r.amlclaw}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="landing-comparison-summary">
        合规的终局，不是雇更多的人，而是部署更好的系统。
      </p>
    </section>
  );
}
