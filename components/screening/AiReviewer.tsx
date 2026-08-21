"use client";

import { useMemo, useState } from "react";
import { shortenAddr } from "@/lib/utils";
import { extractReviewInput, deterministicFlag, type AiReviewResult } from "@/lib/ai-review";

const FLAG_UI: Record<string, { label: string; color: string; icon: string }> = {
  alert: { label: "高风险直接关联", color: "var(--danger)", icon: "⚠" },
  caution: { label: "存在间接敞口", color: "var(--risk-medium)", icon: "◐" },
  clear: { label: "无实质风险", color: "var(--success)", icon: "✓" },
};

const KIND_LABEL: Record<string, string> = { self: "自身命中", direct: "直接交互", indirect: "间接" };

export default function AiReviewer({ type, result }: { type: "kya" | "kyt"; result: Record<string, unknown> }) {
  const input = useMemo(() => extractReviewInput(type, result), [type, result]);
  const detFlag = useMemo(() => deterministicFlag(input), [input]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [review, setReview] = useState<AiReviewResult | null>(null);
  const [error, setError] = useState<string>("");

  const run = async () => {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.detail || "AI review failed");
      setReview(json.review as AiReviewResult);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI review failed");
      setState("error");
    }
  };

  const shownFlag = review ? review.flag : detFlag;
  const ui = FLAG_UI[shownFlag] || FLAG_UI.clear;

  return (
    <div className="report-section">
      <div className="report-section-header">AI Reviewer · AI 智能复核</div>
      <div style={{ background: "var(--surface-1)", border: `1px solid ${ui.color}55`, borderRadius: "var(--radius-md)", padding: "var(--sp-4)" }}>
        {/* headline row */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap", marginBottom: "var(--sp-3)" }}>
          <span style={{ fontSize: "1.4rem", color: ui.color }}>{ui.icon}</span>
          <span className="badge" style={{ background: `color-mix(in srgb, ${ui.color} 15%, transparent)`, color: ui.color, border: `1px solid ${ui.color}55`, fontWeight: 800 }}>
            {ui.label}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            分数 {input.score ?? "N/A"} · 处置 {input.verdict ?? "N/A"}
          </span>
          {state !== "loading" && (
            <button
              className="btn btn-sm btn-primary"
              style={{ marginLeft: "auto" }}
              onClick={run}
            >
              {state === "done" ? "重新复核" : "运行 AI 复核"}
            </button>
          )}
          {state === "loading" && (
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
              <span className="spinner" /> DeepSeek 分析中…
            </span>
          )}
        </div>

        {/* deterministic evidence — shown immediately, independent of the LLM */}
        {input.findings.length > 0 && (
          <div className="report-alert report-alert-danger" style={{ marginBottom: "var(--sp-3)", fontSize: "var(--text-xs)" }}>
            <b>确定性证据:</b> 该{type === "kya" ? "地址" : "交易对手方"}
            {input.selfHit ? "本身被标记为风险实体,并" : ""}
            与 {input.findings.length} 个高风险实体存在自身命中 / 直接交互 —— 即使占比分数偏低,合规上仍需重点关注。
          </div>
        )}
        {input.findings.length > 0 && (
          <table className="data-table" style={{ fontSize: "var(--text-xs)", marginBottom: "var(--sp-3)" }}>
            <thead>
              <tr><th>规则</th><th>类别/severity</th><th>关系</th><th>对手方</th><th>标签</th></tr>
            </thead>
            <tbody>
              {input.findings.slice(0, 8).map((f, i) => (
                <tr key={i}>
                  <td>{f.ruleName}</td>
                  <td><span className={`risk-pill ${f.severity === "critical" ? "pill-critical" : "pill-high"}`}>{f.category} · {f.severity}</span></td>
                  <td style={{ color: f.kind === "self" ? "var(--danger)" : "var(--risk-high)", fontWeight: 700 }}>{KIND_LABEL[f.kind]}{f.kind !== "self" ? `(${f.hops}跳)` : ""}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: "0.65rem" }}>{f.opponent ? shortenAddr(f.opponent) : "—"}</td>
                  <td style={{ color: "var(--text-tertiary)" }}>{f.tags.join("; ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {input.findings.length === 0 && state === "idle" && (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: "var(--sp-2)" }}>
            未检测到自身/直接高风险命中。点击「运行 AI 复核」让 DeepSeek 对间接敞口给出独立意见。
          </div>
        )}

        {/* AI narrative */}
        {state === "error" && (
          <div className="report-alert" style={{ fontSize: "var(--text-xs)", color: "var(--danger)" }}>
            {error.includes("not configured")
              ? <>DeepSeek 未配置 —— 请在 <b>设置 → AI Reviewer</b> 填写 API Key。</>
              : <>AI 复核失败:{error}</>}
          </div>
        )}
        {review && state === "done" && (
          <div style={{ borderTop: "1px dashed var(--border-subtle)", paddingTop: "var(--sp-3)" }}>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, marginBottom: "var(--sp-2)" }}>
              {review.headline}
            </div>
            {review.reasons.length > 0 && (
              <ul style={{ margin: "0 0 var(--sp-3) 0", paddingLeft: "1.1rem", fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                {review.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
            {review.recommendation && (
              <div style={{ fontSize: "var(--text-xs)", background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px" }}>
                <b style={{ color: ui.color }}>建议处置:</b> {review.recommendation}
              </div>
            )}
            {review.raw && (
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.65rem", color: "var(--text-tertiary)", marginTop: "var(--sp-2)" }}>{review.raw}</pre>
            )}
            <div style={{ fontSize: "0.6rem", color: "var(--text-tertiary)", marginTop: "var(--sp-2)" }}>
              由 {review.model || "DeepSeek"} 生成 · AI 意见仅供参考,最终以合规官判断为准
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
