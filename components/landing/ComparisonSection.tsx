"use client";

import { useScrollReveal } from "./useScrollReveal";

const iconTraditional = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const iconAmlclaw = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const rows = [
  { aspect: "成本", traditional: "商业合规系统年费六位数起", amlclaw: "开源免费（MIT），只付 API 用量" },
  { aspect: "部署", traditional: "采购、集成、培训 —— 数月", amlclaw: "npm run dev —— 5 分钟" },
  { aspect: "地址筛查 KYA", traditional: "人工查链、跨表比对，半天一个", amlclaw: "多跳追溯 + 规则判定，分钟级出报告" },
  { aspect: "交易筛查 KYT", traditional: "只看单笔金额，看不到资金来源", amlclaw: "按 in / out 方向分别筛，各自规则集" },
  { aspect: "持续监控", traditional: "人工抽查，做不持久", amlclaw: "新交易逐笔 KYT + 对手方标签盯防，7×24 自动" },
  { aspect: "规则策略", traditional: "黑盒评分，不知道为什么高风险", amlclaw: "规则集自定义，命中哪条、几跳、多少钱全透明" },
  { aspect: "证据留存", traditional: "截图散落在邮件和表格里", amlclaw: "全量交易台账 + 完整资金路径证据链" },
  { aspect: "数据安全", traditional: "客户数据上传第三方平台", amlclaw: "自主部署，数据不出你的服务器" },
];

export default function ComparisonSection() {
  const ref = useScrollReveal();

  return (
    <section className="landing-section" id="comparison" ref={ref}>
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          自建合规团队 vs. 部署 AMLClaw
        </h2>
      </div>

      <div className="landing-comparison landing-scroll-reveal">
        <table>
          <thead>
            <tr>
              <th>对比维度</th>
              <th className="landing-comparison-th-trad">传统做法</th>
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
        合规的未来不是堆人力，而是把可复核、可追溯的系统跑起来。
      </p>
    </section>
  );
}
