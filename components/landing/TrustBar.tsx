"use client";

import { useScrollReveal } from "./useScrollReveal";

export default function TrustBar() {
  const ref = useScrollReveal();

  return (
    <section className="landing-trustbar" id="trustbar" ref={ref}>
      <div className="landing-trustbar-inner landing-scroll-reveal">
        <p className="landing-trustbar-title">开源 · 自主部署 · 数据主权 · 社区驱动 · MIT 协议</p>
        <div className="landing-trustbar-badges">
          {["制裁名单", "恐怖融资", "网络犯罪", "暗网", "混币器", "赌博", "冻结/执法"].map((f) => (
            <span key={f} className="landing-trustbar-badge">{f}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
