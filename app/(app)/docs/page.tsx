"use client";

/**
 * Built-in API documentation for AMLClaw's own REST API.
 * Bilingual (zh primary / en) — follows the sidebar language switcher.
 */
import { useI18n } from "@/lib/useI18n";

export default function ApiDocsPage() {
  const { locale } = useI18n();
  const zh = locale === "zh";
  // tiny bilingual helper
  const tr = (zhText: string, enText: string) => (zh ? zhText : enText);

  return (
    <div style={{ padding: "var(--sp-5) var(--sp-6)", maxWidth: 900 }}>
      <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--sp-1)" }}>
        {tr("API 文档", "API Reference")}
      </h1>
      <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginBottom: "var(--sp-5)" }}>
        {tr(
          "AMLClaw 自托管实例的 REST API。所有筛查由 width.info V3 引擎驱动，合规规则集在服务端运行。",
          "REST API of your self-hosted AMLClaw instance. All screening is powered by the width.info V3 engine — compliance rulesets run server-side."
        )}
      </p>

      {/* ── 认证 ── */}
      <Section title={tr("认证", "Authentication")}>
        <P>
          {tr(
            "默认开放访问。在 设置 → Security 配置 API Token 后，所有接口需携带请求头：",
            "Open access by default. Once an API token is set in Settings → Security, every endpoint requires the header:"
          )}
        </P>
        <Code>{`Authorization: Bearer <your-token>`}</Code>
        <P>
          {tr(
            "Base URL 即你的部署地址，例如 http://localhost:3000。",
            "The base URL is your deployment address, e.g. http://localhost:3000."
          )}
        </P>
      </Section>

      {/* ── 通用概念 ── */}
      <Section title={tr("通用概念", "Core Concepts")}>
        <Table
          head={[tr("概念", "Concept"), tr("说明", "Description")]}
          rows={[
            [tr("风险等级", "Risk levels"), "low → medium → high → critical"],
            [tr("处置动作", "Actions"), tr("block（拦截）/ review（人工复核）/ alert（告警）/ monitor（持续观察）", "block / review / alert / monitor")],
            ["ruleset_id", tr("服务端规则集 ID。0 = 内置默认（KYA 默认集；KYT 按方向用 KYT-IN / KYT-OUT 内置集）。规则集在 width.info 平台管理。", "Server-side ruleset id. 0 = builtin default (KYA default; KYT uses KYT-IN / KYT-OUT builtins per direction). Rulesets are managed on width.info.")],
            [tr("异步任务", "Async jobs"), tr("筛查接口立即返回 job_id，客户端每 3 秒轮询任务接口直到 status 为 completed 或 error。", "Screening endpoints return a job_id immediately; poll the job endpoint every ~3s until status is completed or error.")],
            [tr("支持链", "Chains"), "Ethereum · Tron"],
            [tr("支持代币", "Tokens"), tr("usdt / usdc（Tron 仅 usdt）", "usdt / usdc (Tron: usdt only)")],
          ]}
        />
      </Section>

      {/* ── KYA ── */}
      <Section title={tr("KYA 地址筛查", "KYA Address Screening")}>
        <Endpoint method="POST" path="/api/screening" desc={tr("提交地址筛查任务，立即返回 job_id。", "Submit an address screening job; returns job_id immediately.")} />
        <Table
          head={[tr("参数", "Param"), tr("类型", "Type"), tr("默认", "Default"), tr("说明", "Description")]}
          rows={[
            ["chain", "string", "Tron", tr("Ethereum | Tron", "Ethereum | Tron")],
            ["address", "string", tr("必填", "required"), tr("要筛查的钱包地址", "Wallet address to screen")],
            ["token", "string", "usdt", "usdt | usdc"],
            ["ruleset_id", "number", "0", tr("服务端规则集 ID，0 = 默认", "Server-side ruleset id, 0 = default")],
            ["inflow_hops", "number", "3", tr("入金追溯层数 0–5", "Inflow tracing depth 0–5")],
            ["outflow_hops", "number", "3", tr("出金追溯层数 0–5", "Outflow tracing depth 0–5")],
            ["max_nodes", "number", "200", tr("每层最大扩展节点数", "Max nodes expanded per hop")],
            ["max_opponent_paths", "number", "50", tr("最大对手方路径数", "Max opponent paths to evaluate")],
            ["min_amount", "number", "1", tr("最小转账金额（代币单位）", "Minimum transfer amount (token units)")],
            ["is_penetrate_contract", "boolean", "false", tr("是否穿透合约地址", "Trace through contract addresses")],
            ["min_timestamp", "number", "0", tr("起始时间（Unix 毫秒），0 = 不限", "Start time (Unix ms), 0 = no limit")],
            ["max_timestamp", "number", tr("当前时间", "now"), tr("结束时间（Unix 毫秒）", "End time (Unix ms)")],
          ]}
        />
        <Code>{`curl -X POST $BASE/api/screening \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chain": "Tron",
    "address": "TGE94jU39ithtHbrYAQJRTcvv785riPLdy",
    "inflow_hops": 3, "outflow_hops": 3
  }'
# → { "job_id": "471e04f0" }`}</Code>

        <Endpoint method="GET" path="/api/screening/{jobId}" desc={tr("轮询任务状态与结果。", "Poll job status and result.")} />
        <P>{tr("status = running | completed | error。completed 时 result 字段包含：", "status = running | completed | error. When completed, result contains:")}</P>
        <Table
          head={[tr("字段", "Field"), tr("说明", "Description")]}
          rows={[
            ["risk / riskScore", tr("综合风险等级与 0–100 分值", "Overall risk level and 0–100 score")],
            ["riskReason", tr("最高风险命中的人类可读说明", "Human-readable summary of the top finding")],
            ["addressIdentifications[]", tr("地址自身身份命中（如地址本身被制裁）", "Identity-level findings (e.g. the address itself is sanctioned)")],
            ["exposures[]", tr("按类别/方向聚合的风险敞口金额", "Aggregated exposure amounts by category and direction")],
            ["hits[]", tr("逐条规则命中：ruleCode、category、riskLevel、action、hops、opponentAddress、pathNodes（完整路径节点，含标签与金额）", "Per-rule hits: ruleCode, category, riskLevel, action, hops, opponentAddress, pathNodes (full path with tags & amounts)")],
            ["inflowRiskRate / outflowRiskRate", tr("被污染入金/出金占比（0–1）", "Tainted inflow / outflow ratio (0–1)")],
            ["totalPaths / hitPaths", tr("分析路径总数 / 命中路径数", "Paths analyzed / paths that hit rules")],
            ["rulesetId", tr("实际使用的规则集 ID", "The ruleset id actually used")],
          ]}
        />
      </Section>

      {/* ── KYT ── */}
      <Section title={tr("KYT 交易筛查", "KYT Transaction Screening")}>
        <Endpoint method="POST" path="/api/kyt" desc={tr("提交交易哈希筛查任务，立即返回 job_id。", "Submit a transaction screening job; returns job_id immediately.")} />
        <P>
          {tr(
            "与 KYA 相同的追溯参数之外，KYT 特有：",
            "In addition to the same tracing params as KYA, KYT adds:"
          )}
        </P>
        <Table
          head={[tr("参数", "Param"), tr("类型", "Type"), tr("默认", "Default"), tr("说明", "Description")]}
          rows={[
            ["tx_id", "string", tr("必填", "required"), tr("交易哈希", "Transaction hash")],
            ["direction", "string", "both", tr("in = 资金来源（KYT-IN）；out = 资金去向（KYT-OUT）；both = 两端并筛", "in = source of funds (KYT-IN); out = destination (KYT-OUT); both = both endpoints")],
            ["in_ruleset_id", "number", "0", tr("in 方向规则集，0 = KYT-IN 内置", "Ruleset for the in side, 0 = KYT-IN builtin")],
            ["out_ruleset_id", "number", "0", tr("out 方向规则集，0 = KYT-OUT 内置", "Ruleset for the out side, 0 = KYT-OUT builtin")],
          ]}
        />
        <Endpoint method="GET" path="/api/kyt/{jobId}" desc={tr("轮询任务状态与结果。", "Poll job status and result.")} />
        <P>{tr("result 除 hits 外还包含 Chainalysis 风格的 alerts：", "Besides hits, the result carries Chainalysis-style alerts:")}</P>
        <Table
          head={[tr("字段", "Field"), tr("说明", "Description")]}
          rows={[
            ["alerts[].alertLevel", "low | medium | high | critical"],
            ["alerts[].category", tr("告警类别（如 Sanctions / Cybercrime）", "Alert category (e.g. Sanctions / Cybercrime)")],
            ["alerts[].exposureType", tr("DIRECT（≤1 跳）或 INDIRECT（>1 跳）", "DIRECT (≤1 hop) or INDIRECT (>1 hop)")],
            ["alerts[].alertAmount", tr("告警关联金额（代币单位）", "Amount associated with the alert (token units)")],
            ["alerts[].categoryId", tr("触发的规则代码", "Rule code that produced the alert")],
            ["alerts[].opponentAddress / action", tr("风险对手方地址 / 建议动作", "Risk counterparty address / recommended action")],
          ]}
        />
      </Section>

      {/* ── History ── */}
      <Section title={tr("筛查历史", "Screening History")}>
        <Endpoint method="GET" path="/api/screening/history?type=kya|kyt" desc={tr("按类型列出历史索引（最多 200 条，新→旧）。", "List history index by type (max 200, newest first).")} />
        <Code>{`[ { "job_id": "471e04f0", "type": "kya", "chain": "Tron",
    "subject": "TGE94j...", "risk_level": "critical",
    "hits_count": 10, "completed_at": "...", "source": "manual" } ]`}</Code>
      </Section>

      {/* ── Monitors ── */}
      <Section title={tr("监控", "Monitoring")}>
        <P>
          {tr(
            "两种监控类型都只看未来动作：address 监控地址新增转账并逐笔 KYT（收款 = in，付款 = out）；kyt 监控某笔交易的 from/to 对手方，周期性 KYA 并在风险升级时告警。",
            "Both monitor types watch FUTURE activity: 'address' KYT-screens the address's new transfers (receive = in, send = out); 'kyt' periodically KYA-screens a tx's from/to counterparty and alerts on risk escalation."
          )}
        </P>

        <Endpoint method="GET" path="/api/monitors?type=address|kyt" desc={tr("列出监控任务。", "List monitors.")} />
        <Endpoint method="POST" path="/api/monitors" desc={tr("创建监控任务。", "Create a monitor.")} />
        <P>{tr("地址监控（type = address）：", "Address monitor (type = address):")}</P>
        <Code>{`{ "type": "address", "chain": "Tron",
  "address": "T...", "min_amount": 1,
  "schedule_preset": "every_4h" }
// ${zh ? "游标自创建时刻起 — 不扫描历史交易" : "cursor starts at creation time — history is never scanned"}`}</Code>
        <P>{tr("KYT 监控（type = kyt）：", "KYT monitor (type = kyt):")}</P>
        <Code>{`{ "type": "kyt", "chain": "Tron",
  "tx_id": "398dd973...", "watch_side": "from",
  "schedule_preset": "every_24h" }
// ${zh ? "自动解析该交易的 from/to 地址" : "resolves the tx's from/to address automatically"}`}</Code>
        <Table
          head={[tr("参数", "Param"), tr("说明", "Description")]}
          rows={[
            ["schedule_preset", "every_1h | every_4h | every_8h | every_12h | every_24h"],
            ["tokens", tr("地址监控代币过滤，默认 ETH = USDT+USDC，Tron = USDT", "Address-monitor token filter; defaults ETH = USDT+USDC, Tron = USDT")],
            ["min_amount", tr("地址监控：小于该金额的转账不筛查", "Address monitor: transfers below this amount are skipped")],
            ["in_ruleset_id / out_ruleset_id", tr("地址监控逐笔 KYT 的方向规则集", "Per-direction rulesets for the address monitor's KYT screens")],
            ["kya_ruleset_id", tr("KYT 监控周期 KYA 的规则集", "Ruleset for the KYT monitor's periodic KYA")],
          ]}
        />
        <Endpoint method="PUT" path="/api/monitors/{id}" desc={tr("更新（启停 enabled、调度、阈值等）。", "Update (enabled, schedule, thresholds…).")} />
        <Endpoint method="DELETE" path="/api/monitors/{id}" desc={tr("删除任务（运行记录保留以备审计）。", "Delete (run records kept for audit).")} />
        <Endpoint method="POST" path="/api/monitors/{id}/run" desc={tr("立即手动执行一轮。", "Trigger a manual run now.")} />
        <Endpoint method="GET" path="/api/monitors/{id}/history" desc={tr("查看运行记录：每轮的新交易数 / 已筛查 / 跳过 / 最高风险，逐条结果含 job_id 可回查完整报告。", "Run records: per-run new/screened/skipped counts, highest risk; each result links a job_id to the full report.")} />
      </Section>

      {/* ── Webhook ── */}
      <Section title={tr("Webhook 通知", "Webhook Notifications")}>
        <P>
          {tr(
            "在 设置 → Notifications 配置 URL 后，高风险（high/critical）筛查结果与监控风险升级会 POST 以下负载：",
            "With a URL configured in Settings → Notifications, high/critical results and monitor risk escalations POST this payload:"
          )}
        </P>
        <Code>{`{ "event": "screening.high_risk" | "monitor.high_risk" | "monitor.risk_escalated",
  "timestamp": "2026-07-22T08:00:00Z",
  "data": { "chain": "...", "risk": "critical", "job_id": "..." } }`}</Code>
      </Section>

      {/* ── Settings ── */}
      <Section title={tr("设置", "Settings")}>
        <Endpoint method="GET" path="/api/settings" desc={tr("读取配置（密钥脱敏返回）。", "Read settings (secrets masked).")} />
        <Endpoint method="PUT" path="/api/settings" desc={tr("局部更新，按 section 深合并；以 * 开头的脱敏值不会覆盖真实密钥。", "Partial deep-merge update per section; masked values starting with * never overwrite real secrets.")} />
        <Table
          head={["Section", tr("内容", "Contents")]}
          rows={[
            ["api", tr("widthApiKey（必填）、widthBaseUrl、etherscanApiKey、trongridApiKey", "widthApiKey (required), widthBaseUrl, etherscanApiKey, trongridApiKey")],
            ["screening", tr("追溯默认值：hops、max_nodes(200)、max_opponent_paths(50)、min_amount、默认规则集 ID", "Tracing defaults: hops, max_nodes (200), max_opponent_paths (50), min_amount, default ruleset ids")],
            ["monitoring", tr("默认调度、单轮筛查上限（maxTxPerRun）、默认最小金额", "Default schedule, per-run screening cap (maxTxPerRun), default min amount")],
            ["notifications / security / app", tr("Webhook、Bearer Token、品牌与主题", "Webhook, Bearer token, branding & theme")],
          ]}
        />
      </Section>

      <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: "var(--sp-6)", paddingTop: "var(--sp-4)", borderTop: "1px solid var(--border-subtle)" }}>
        {tr(
          "上游引擎参数与本页一一对应，上游文档见 ",
          "Upstream engine parameters map 1:1 to this page — see "
        )}
        <a href="https://width.info/api-reference" target="_blank" rel="noopener" style={{ color: "var(--primary-500)" }}>
          width.info/api-reference
        </a>
      </div>
    </div>
  );
}

/* ── layout helpers ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "var(--sp-4)", marginBottom: "var(--sp-4)" }}>
      <div style={{ fontWeight: 700, fontSize: "var(--text-md)", marginBottom: "var(--sp-3)" }}>{title}</div>
      {children}
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color = method === "GET" ? "var(--success)" : method === "DELETE" ? "var(--danger)" : "var(--primary-500)";
  return (
    <div style={{ margin: "var(--sp-3) 0 var(--sp-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "var(--text-xs)", color, border: `1px solid ${color}`, borderRadius: 4, padding: "1px 8px" }}>
          {method}
        </span>
        <code style={{ fontFamily: "var(--mono)", fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{path}</code>
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>{desc}</div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "var(--sp-2) 0" }}>{children}</p>;
}

function Code({ children }: { children: string }) {
  return (
    <pre style={{
      fontFamily: "var(--mono)", fontSize: "0.7rem", lineHeight: 1.6,
      background: "var(--surface-1)", border: "1px solid var(--border-default)",
      borderRadius: "var(--radius)", padding: "var(--sp-3)", overflowX: "auto",
      margin: "var(--sp-2) 0", color: "var(--text-secondary)", whiteSpace: "pre",
    }}>
      {children}
    </pre>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto", margin: "var(--sp-2) 0" }}>
      <table className="data-table" style={{ fontSize: "var(--text-xs)" }}>
        <thead>
          <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={j === 0 ? { fontFamily: "var(--mono)", whiteSpace: "nowrap" } : undefined}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
