"use client";

import { useScrollReveal } from "./useScrollReveal";

export default function TrustBar() {
  const ref = useScrollReveal();

  return (
    <section className="landing-trustbar" id="trustbar" ref={ref}>
      <div className="landing-trustbar-inner landing-scroll-reveal">
        <p className="landing-trustbar-title">开源透明 · 私有部署 · 数据自主 · 社区驱动 · MIT License</p>
        <div className="landing-trustbar-badges">
          {["FATF", "MAS", "SFC", "VARA", "OFAC", "UN Sanctions"].map((f) => (
            <span key={f} className="landing-trustbar-badge">{f}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
