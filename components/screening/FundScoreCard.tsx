"use client";

/**
 * Fund-attribution risk score card ("资金占比评分") — shown on KYA and KYT
 * reports. The score & component breakdown come straight from the width.info
 * engine (`result.score`); this card only renders them.
 */
import type { FundScore } from "@/lib/risk-score";
import type { ScoreOverview } from "@/lib/width-api";

export const VERDICT_UI: Record<string, { label: string; zh: string; color: string }> = {
  accept: { label: "Accept", zh: "放行", color: "var(--success)" },
  review: { label: "Review", zh: "人工复核", color: "var(--risk-medium)" },
  edd: { label: "Enhanced DD", zh: "加强尽调", color: "var(--risk-high)" },
  block: { label: "Block", zh: "拒绝", color: "var(--danger)" },
};

/** Compact score+verdict pill for report headers — the user-facing judgment. */
export function ScoreVerdictBadge({ fundScore }: { fundScore: FundScore }) {
  const v = fundScore.verdict ? VERDICT_UI[fundScore.verdict] : null;
  const color = v?.color || "var(--text-tertiary)";
  return (
    <div style={{
      textAlign: "center", padding: "var(--sp-2) var(--sp-4)", borderRadius: "var(--radius-md)",
      border: `1.5px solid ${color}`, background: `color-mix(in srgb, ${color} 8%, transparent)`, minWidth: 110,
    }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color, lineHeight: 1.1 }}>
        {fundScore.score != null ? fundScore.score : "—"}
        <span style={{ fontSize: "0.65rem", fontWeight: 400, color: "var(--text-tertiary)" }}>/100</span>
      </div>
      <div style={{ fontSize: "0.65rem", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {v ? `${v.label} · ${v.zh}` : "Score N/A"}
      </div>
    </div>
  );
}

/** Section divider introducing the evidence zone below the verdict. */
export function PathAnalysisDivider() {
  return (
    <div style={{ margin: "var(--sp-6) 0 var(--sp-4)", paddingTop: "var(--sp-4)", borderTop: "2px solid var(--border-default)" }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 800, letterSpacing: "0.02em" }}>
        Fund Path Analysis · 资金路径分析
        <span className="badge" style={{ marginLeft: "var(--sp-2)", fontWeight: 600, color: "var(--text-tertiary)" }}>证据区</span>
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
        以下为规则口径的路径证据,回答「有没有风险连接」——其中可能出现 critical 等级的路径;
        <b style={{ color: "var(--text-secondary)" }}>处置判定以上方资金占比评分为准</b>(回答「有多少钱有问题」)。
      </div>
    </div>
  );
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const pct = (r: number) => `${(r * 100).toFixed(2)}%`;

const HOP_LABEL: Record<string, string> = { direct: "0-1 跳", hop2: "2 跳", hop3: "3 跳" };
const SEV_COLOR: Record<string, string> = {
  critical: "var(--danger)",
  high: "var(--risk-high)",
  medium: "var(--risk-medium)",
  low: "var(--success)",
};

function ScoreBar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 10, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
      <div style={{ width: `${Math.min(ratio * 100, 100)}%`, height: "100%", background: color, borderRadius: 5, transition: "width .4s" }} />
    </div>
  );
}

function ComponentRow({ label, amount, denom, ratio, weight, color }: {
  label: string; amount: number; denom: number | null; ratio: number; weight: number; color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", fontSize: "var(--text-xs)", padding: "5px 0" }}>
      <span style={{ width: 190, color: "var(--text-secondary)", flexShrink: 0 }}>{label}</span>
      <ScoreBar ratio={ratio} color={color} />
      <span style={{ width: 250, textAlign: "right", fontFamily: "var(--mono)", color: "var(--text-secondary)", flexShrink: 0 }}>
        {fmt(amount)} {denom != null ? `/ ${fmt(denom)}` : ""} · {pct(ratio)} × {weight} ={" "}
        <b style={{ color: "var(--text-primary)" }}>{(ratio * weight).toFixed(1)}</b>
      </span>
    </div>
  );
}

export default function FundScoreCard({ fundScore, chainStats, mode }: {
  fundScore: FundScore;
  chainStats?: ScoreOverview | null;
  mode: "kya" | "kyt";
}) {
  const fs = fundScore;
  const v = fs.verdict ? VERDICT_UI[fs.verdict] : null;
  const scoreColor = v?.color || "var(--text-tertiary)";

  return (
    <div className="report-section">
      <div className="report-section-header">
        Verdict · 处置判定(资金占比评分)
      </div>
      <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--sp-4)" }}>
        {/* score headline */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", marginBottom: "var(--sp-3)", flexWrap: "wrap" }}>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
            {fs.score != null ? fs.score : "—"}
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 400 }}> /100</span>
          </div>
          {v && (
            <span className="badge" style={{ background: `color-mix(in srgb, ${v.color} 15%, transparent)`, color: v.color, border: `1px solid color-mix(in srgb, ${v.color} 40%, transparent)`, fontWeight: 700 }}>
              {v.label} · {v.zh}
            </span>
          )}
          {fs.selfHit && (
            <span className="badge" style={{ background: `color-mix(in srgb, ${SEV_COLOR[fs.selfHitLevel || "critical"] || "var(--danger)"} 15%, transparent)`, color: SEV_COLOR[fs.selfHitLevel || "critical"] || "var(--danger)", fontWeight: 700 }}>
              SELFHIT · {(fs.selfHitLevel || "critical").toUpperCase()} — 地址本身被标记,得分 = SELFHIT 基准 × 严重度乘数
            </span>
          )}
          {fs.counterpartyFlagged && (
            <span className="badge" style={{ background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", fontWeight: 700 }}>
              对手方本身被标记 — 全额计入直接桶
            </span>
          )}
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {fs.hitPaths} hit paths → {fs.riskyEdges} deduped edges
          </span>
        </div>

        {fs.score == null && !fs.selfHit && (
          <div className="report-alert" style={{ marginBottom: "var(--sp-3)", fontSize: "var(--text-xs)" }}>
            width 引擎未返回资金占比评分(分母不可用)——下方仅展示去重后的风险金额。
          </div>
        )}

        {/* component breakdown — rule-engine cells (direction × hop bucket × severity) */}
        {!fs.selfHit && fs.components && fs.components.length > 0 && (
          <div style={{ marginBottom: "var(--sp-3)" }}>
            {fs.components.map((c, i) => {
              const label = `${c.direction === "in" ? "入金" : "出金"} · ${HOP_LABEL[c.hopBucket] || c.hopBucket} · ${c.severity}`;
              const capped = c.rawAmount != null && c.rawAmount > c.amount;
              if (c.amount <= 0 && capped) {
                // Fully crowded out by higher-priority cells — money counted once.
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", fontSize: "var(--text-xs)", padding: "5px 0", opacity: 0.55 }}>
                    <span style={{ width: 190, color: "var(--text-tertiary)", flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 10, background: "var(--surface-2)", borderRadius: 5, border: "1px dashed var(--border-default)" }} />
                    <span style={{ width: 250, textAlign: "right", fontFamily: "var(--mono)", color: "var(--text-tertiary)", flexShrink: 0 }}>
                      归因 {fmt(c.rawAmount!)} → 计入 0(与更高优先格资金重叠)
                    </span>
                  </div>
                );
              }
              return (
                <div key={i}>
                  <ComponentRow
                    label={label}
                    amount={c.amount}
                    denom={c.direction === "in" ? fs.totalIn : fs.totalOut}
                    ratio={c.ratio}
                    weight={Math.round(c.base * c.weight * 100) / 100}
                    color={SEV_COLOR[c.severity] || "var(--risk-medium)"}
                  />
                  {capped && (
                    <div style={{ fontSize: "0.65rem", color: "var(--text-tertiary)", paddingLeft: 190, marginTop: -2 }}>
                      该格原始归因 {fmt(c.rawAmount!)},按「钱只算一次」封顶计入 {fmt(c.amount)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!fs.selfHit && fs.components && fs.components.length === 0 && fs.score != null && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--success)", marginBottom: "var(--sp-3)" }}>
            无任何风险资金归因 — 0 分。
          </div>
        )}
        {/* legacy entries (pre rule-engine) — fixed three-row layout */}
        {!fs.selfHit && !fs.components && (
          <div style={{ marginBottom: "var(--sp-3)" }}>
            <ComponentRow label="r₁ Direct (≤1 hop) risky inflow" amount={fs.directAmount} denom={fs.totalIn} ratio={fs.r1} weight={80} color="var(--danger)" />
            <ComponentRow label="r₂ Indirect (2+ hop) risky inflow" amount={fs.indirectAmount} denom={fs.totalIn} ratio={fs.r2} weight={40} color="var(--risk-high)" />
            <ComponentRow label="r_out Risky outflow" amount={fs.outflowAmount} denom={fs.totalOut} ratio={fs.rOut} weight={10} color="var(--risk-medium)" />
          </div>
        )}

        {/* chain stats context (KYA) — from the width engine's scoreOverview */}
        {mode === "kya" && chainStats && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", borderTop: "1px dashed var(--border-subtle)", paddingTop: "var(--sp-2)", marginBottom: "var(--sp-2)", display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
            <span>In: <b style={{ color: "var(--text-secondary)" }}>{chainStats.inCount} txs / {fmt(chainStats.inTotal)} {chainStats.token}</b></span>
            <span>Out: <b style={{ color: "var(--text-secondary)" }}>{chainStats.outCount} txs / {fmt(chainStats.outTotal)} {chainStats.token}</b></span>
            {chainStats.balance != null && <span>Balance: <b style={{ color: "var(--text-secondary)" }}>{fmt(chainStats.balance)} {chainStats.token}</b></span>}
            {chainStats.truncated && <span style={{ color: "var(--risk-medium)" }}>⚠ 总量按最近 {chainStats.inCount + chainStats.outCount} 笔截断,占比偏保守</span>}
          </div>
        )}
        {mode === "kyt" && fs.totalIn != null && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", borderTop: "1px dashed var(--border-subtle)", paddingTop: "var(--sp-2)", marginBottom: "var(--sp-2)" }}>
            分母 = width 引擎的资金总量(totalIn <b style={{ color: "var(--text-secondary)" }}>{fmt(fs.totalIn)}</b> / totalOut {fs.totalOut != null ? fmt(fs.totalOut) : "—"})
          </div>
        )}

        {/* formula, in plain language */}
        <details>
          <summary style={{ cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--primary-500)", fontWeight: 600 }}>
            评分公式说明(点击展开)
          </summary>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.8, paddingTop: "var(--sp-2)" }}>
            <p style={{ marginBottom: 6 }}>
              <b>评分由 width.info 引擎服务端计算,规则集在 width 侧配置。</b>
              多条风险路径命中同一笔资金只计一次(按「与目标相接的边」金额去重);
              同一笔钱同时命中多类风险时,按 <b>SELFHIT &gt; 直接(≤1跳) &gt; 间接(2跳以上)</b> 的严重度优先只归入一个桶,各桶资金互不重叠。
            </p>
            <p style={{ marginBottom: 6 }}>
              <b>引擎公式:</b>每格贡献 =
              <code style={{ margin: "0 4px" }}>基数(方向×跳数桶) × 严重度乘数(规则等级) × 资金占比</code>
              ,总分为各格之和(封顶 100)。基数和乘数由 width 服务端评分规则集(scoring ruleset)决定,可通过
              <code style={{ margin: "0 4px" }}>scoring_ruleset_id</code> 切换;SELFHIT(地址本身被制裁/冻结)直接覆盖为高分
              {mode === "kyt" && ";KYT 场景分母为本笔资金的总量,打款方本身被标记时全额计入直接桶"}。
            </p>
            <p style={{ margin: 0 }}>
              <b>分数段:</b>
              <span style={{ color: "var(--success)" }}> 0–20 放行</span> ·
              <span style={{ color: "var(--risk-medium)" }}> 20–50 人工复核</span> ·
              <span style={{ color: "var(--risk-high)" }}> 50–80 加强尽调</span> ·
              <span style={{ color: "var(--danger)" }}> 80–100 拒绝</span>。
              规则等级回答「有没有风险连接」,资金占比评分回答「有多少钱有问题」——两者互补,处置以评分为主。
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
