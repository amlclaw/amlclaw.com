/**
 * DeepSeek AI reviewer (server-side). OpenAI-compatible chat completions.
 * Reads the compact ReviewInput, asks the model for a compliance opinion, and
 * returns a structured verdict — with a deterministic flag floor so a genuine
 * self/direct high-risk interaction is never softened by the model.
 */
import { getSettings } from "./settings";
import { deterministicFlag, type ReviewInput, type AiReviewResult } from "./ai-review";

const SYSTEM_PROMPT =
  "你是一名加密资产反洗钱(AML)合规审查官。你会收到某地址或交易的机器筛查结果," +
  "包括一个 0–100 的资金占比风险分数、以及命中的风险路径。你的职责是给出独立的人工级复核意见。" +
  "特别注意:资金占比分数可能偏低(因为涉险资金占总流量比例小),但如果该地址【本身被标记为高风险】" +
  "或与制裁/冻结/黑客等高风险实体【有过直接(1跳)交互】,这在合规上仍是重大风险,不能因为分数低就放过。" +
  "请务必用中文、简洁、以合规官口吻输出。只输出一个 JSON 对象,不要额外文字,格式:" +
  '{"flag":"clear|caution|alert","headline":"一句话结论","reasons":["要点1","要点2"],"recommendation":"建议处置(放行/复核/加强尽调/拦截 + 理由)"}。' +
  "flag=alert 表示存在本身高风险或与高风险的直接交互;caution 表示仅有间接敞口;clear 表示无实质风险。";

function buildUserPrompt(input: ReviewInput): string {
  const lines: string[] = [];
  lines.push(`类型: ${input.type === "kya" ? "KYA 地址筛查" : "KYT 交易筛查"} · 链: ${input.chain}`);
  lines.push(`对象: ${input.subject}`);
  lines.push(`资金占比分数: ${input.score ?? "N/A"} / 100 · 系统处置: ${input.verdict ?? "N/A"}`);
  if (input.selfHit) lines.push(`⚠ 地址本身被标记为风险实体,严重度: ${input.selfHitLevel ?? "high"}`);
  if (input.subjectTags.length) lines.push(`对象自身标签: ${input.subjectTags.join("; ")}`);
  if (input.overview) {
    const o = input.overview;
    lines.push(`链上总量: 入 ${fmt(o.inTotal)} / 出 ${fmt(o.outTotal)} / 余额 ${fmt(o.balance)}`);
  }
  lines.push("");
  if (input.findings.length) {
    lines.push(`【本身/直接 高风险命中 ${input.findings.length} 条 —— 这些是分数可能低估的重点】:`);
    for (const f of input.findings.slice(0, 12)) {
      const kind = f.kind === "self" ? "自身命中(0跳)" : `直接交互(${f.hops}跳)`;
      lines.push(`- ${f.ruleName} [${f.category}/${f.severity}] · ${kind} · 对手方 ${f.opponent || "—"}${f.tags.length ? " · 标签: " + f.tags.join(", ") : ""} · 金额 ${fmt(f.amount)}`);
    }
  } else {
    lines.push("【本身/直接 高风险命中】: 无");
  }
  if (input.indirectSummary.length) {
    lines.push("");
    lines.push("【间接敞口(2跳以上)汇总】:");
    for (const s of input.indirectSummary.slice(0, 10)) {
      lines.push(`- ${s.category || "未分类"} / ${s.severity}: ${s.count} 条`);
    }
  }
  lines.push("");
  lines.push("请给出你的独立复核意见(JSON)。");
  return lines.join("\n");
}

function fmt(n?: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Extract the first JSON object from a model reply (handles ```json fences). */
function parseModelJson(content: string): Record<string, unknown> | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : content;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

const FLAG_RANK: Record<string, number> = { clear: 0, caution: 1, alert: 2 };

export async function runAiReview(input: ReviewInput): Promise<AiReviewResult> {
  const { deepseekApiKey, model, baseUrl } = getSettings().ai;
  if (!deepseekApiKey) {
    throw new Error("DeepSeek API key not configured. Set it in Settings → AI Reviewer.");
  }
  const useModel = model || "deepseek-chat";
  const body: Record<string, unknown> = {
    model: useModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
    temperature: 0.2,
    max_tokens: 1200,
    stream: false,
  };
  // json_object mode is supported by deepseek-chat; the reasoner reasons in prose first.
  if (!useModel.includes("reasoner")) body.response_format = { type: "json_object" };

  const url = `${(baseUrl || "https://api.deepseek.com").replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseekApiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`DeepSeek HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "";
  const parsed = parseModelJson(content);

  // Deterministic floor: never soften a genuine self/direct high-risk interaction.
  const floor = deterministicFlag(input);
  let flag = (parsed?.flag as string) || floor;
  if ((FLAG_RANK[floor] ?? 0) > (FLAG_RANK[flag] ?? 0)) flag = floor;

  if (!parsed) {
    return {
      flag: floor,
      headline: floor === "alert" ? "检测到本身高风险或与高风险的直接交互" : "AI 返回未能解析,见原文",
      reasons: [],
      recommendation: "",
      model: useModel,
      raw: content.slice(0, 4000),
    };
  }

  return {
    flag: (["clear", "caution", "alert"].includes(flag) ? flag : floor) as AiReviewResult["flag"],
    headline: String(parsed.headline ?? ""),
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map((r) => String(r)).slice(0, 8) : [],
    recommendation: String(parsed.recommendation ?? ""),
    model: useModel,
  };
}
