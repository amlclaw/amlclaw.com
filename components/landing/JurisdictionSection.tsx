"use client";

import { useScrollReveal } from "./useScrollReveal";

/** 风险覆盖 —— 与 Width DAIA 的情报与制裁库口径一致 */
const coverage = [
  {
    icon: "⛔",
    name: "制裁名单",
    body: "Sanctions",
    meta: "OFAC · UN · EU · UK 等自建制裁实体库，命中即建议拦截",
  },
  {
    icon: "🧊",
    name: "冻结与执法",
    body: "Freeze / Law Enforcement",
    meta: "被执法机关冻结、查封的地址，标签变化持续跟踪",
  },
  {
    icon: "🕳️",
    name: "网络犯罪与黑灰产",
    body: "Cybercrime / Black-Grey",
    meta: "黑客盗币、勒索、诈骗、暗网、赌博等资金来源",
  },
  {
    icon: "🌀",
    name: "混币与匿名化",
    body: "Mixer / Anonymizer",
    meta: "混币器、跨链桥等切断资金溯源的服务",
  },
];

const entities = [
  "交易所",
  "托管钱包",
  "DeFi 协议",
  "支付服务商",
  "OTC / 场外",
  "矿池",
];

export default function JurisdictionSection() {
  const ref = useScrollReveal();

  return (
    <section className="landing-section landing-section-divider" id="jurisdictions" ref={ref}>
      <div className="landing-scroll-reveal" style={{ textAlign: "center" }}>
        <h2 className="landing-section-title" style={{ margin: "0 auto 16px" }}>
          风险覆盖与情报标签
        </h2>
        <p className="landing-section-desc" style={{ margin: "0 auto 0" }}>
          底层情报由 Width DAIA 的链上情报引擎与自建制裁库提供，标签持续更新 ——
          筛查时按你选用的规则集判定命中与处置动作。
        </p>
      </div>

      <div className="landing-jurisdictions">
        {coverage.map((c) => (
          <div key={c.name} className="landing-jurisdiction-card landing-scroll-reveal">
            <div className="landing-jurisdiction-flag">{c.icon}</div>
            <div className="landing-jurisdiction-name">{c.name}</div>
            <div className="landing-jurisdiction-body">{c.body}</div>
            <div className="landing-jurisdiction-meta">{c.meta}</div>
          </div>
        ))}
      </div>

      <div className="landing-jurisdiction-footer landing-scroll-reveal">
        <div className="landing-jurisdiction-footer-title">
          实体识别标签
        </div>
        <div className="landing-jurisdiction-footer-frameworks">
          {entities.map((e) => (
            <span key={e} className="landing-framework-badge">
              {e}
            </span>
          ))}
        </div>
        <div className="landing-jurisdiction-footer-chains">
          <strong>支持公链：</strong>Tron · Ethereum（USDT / USDC）
        </div>
      </div>
    </section>
  );
}
