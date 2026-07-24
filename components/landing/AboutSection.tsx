"use client";

import { useScrollReveal } from "./useScrollReveal";

/**
 * 首页核心说明：平台是什么、谁做的、两类持续监控的业务语义。
 * 面向中国用户，中文优先。
 */
export default function AboutSection() {
  const ref = useScrollReveal();

  return (
    <section className="landing-section" id="about" ref={ref}>
      <div className="landing-scroll-reveal">
        <h2 className="landing-section-title">这是一个什么平台？</h2>
        <p className="landing-section-desc">
          AMLClaw 是 <strong style={{ color: "var(--landing-text)" }}>Width DAIA 团队开源</strong>的加密货币 AML 合规工具。
          底层使用 Width.info 的 <strong style={{ color: "var(--landing-text)" }}>KYA</strong>（地址筛查）与{" "}
          <strong style={{ color: "var(--landing-text)" }}>KYT</strong>（交易筛查）API，
          在此之上包装成<strong style={{ color: "var(--landing-text)" }}>符合支付行业业务形态</strong>的产品能力 ——
          入金 / 出金筛查、持续性监控、风险告警、交易台账与证据链报告，开箱即用、自主部署、数据不出服务器。
        </p>
      </div>

      {/* 四大能力 */}
      <div className="landing-about-grid landing-scroll-reveal">
        <div className="landing-about-card">
          <div className="landing-about-tag">单次筛查</div>
          <h3 className="landing-about-title">KYA 地址筛查</h3>
          <p className="landing-about-text">
            输入一个地址，多跳追溯资金来源与去向，按你的合规规则集判定风险等级，输出命中规则、敞口金额与完整资金路径证据。
            用于开户准入、大额入金前置审查。
          </p>
        </div>
        <div className="landing-about-card">
          <div className="landing-about-tag">单次筛查</div>
          <h3 className="landing-about-title">KYT 交易筛查</h3>
          <p className="landing-about-text">
            输入一笔交易哈希，可选筛查<strong>资金来源（in）</strong>、<strong>资金去向（out）</strong>或两端，
            每个方向使用各自的规则集，输出 Chainalysis 风格告警与处置建议（拦截 / 复核 / 告警 / 观察）。
          </p>
        </div>
        <div className="landing-about-card landing-about-card-accent">
          <div className="landing-about-tag">持续监控</div>
          <h3 className="landing-about-title">地址监控</h3>
          <p className="landing-about-text">
            监控这个地址<strong>后续所有的交易</strong>，对每一笔新交易做 KYT 查询 ——
            <strong> 及时发现该地址与高风险地址之间的资金往来</strong>（收款算 in 方向、付款算 out 方向）。
            全量交易入台账，一笔不漏，可按风险等级与时间区间筛选统计。
          </p>
        </div>
        <div className="landing-about-card landing-about-card-accent">
          <div className="landing-about-tag">持续监控</div>
          <h3 className="landing-about-title">KYT 监控</h3>
          <p className="landing-about-text">
            持续监控某笔交易 <strong>from 或 to 地址本身的标签变化</strong>（周期性 KYA 复筛）——
            一旦对手方地址涉及 <strong style={{ color: "var(--landing-accent)" }}>Sanctions（制裁）</strong> 或{" "}
            <strong style={{ color: "var(--landing-accent)" }}>Freeze（冻结）</strong> 等高风险标签，
            <strong>我们要第一时间知道</strong>，风险等级升级立即告警。
          </p>
        </div>
      </div>

      <p className="landing-about-note landing-scroll-reveal">
        规则集在 Width.info 服务端运行 —— 内置默认规则覆盖面较宽，生产环境可自建规则集并在筛查与监控中引用其 ID。
      </p>
    </section>
  );
}
