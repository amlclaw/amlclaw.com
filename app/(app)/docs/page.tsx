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

      {/* ── 关于 AMLClaw ── */}
      <Section title={tr("关于 AMLClaw", "About AMLClaw")}>
        <P>
          {tr(
            "AMLClaw 是 Width DAIA 团队开源的加密货币 AML 合规工具。底层使用 Width.info 的 KYA（地址筛查）与 KYT（交易筛查）API，在此之上包装成符合支付行业业务形态的产品能力：入金/出金筛查、持续性监控、风险告警、交易台账与证据链报告。",
            "AMLClaw is an open-source crypto AML compliance tool by the Width DAIA team. It builds on Width.info's KYA (address screening) and KYT (transaction screening) APIs, packaging them into payment-industry workflows: deposit/withdrawal screening, continuous monitoring, risk alerting, transaction ledgers and evidence-chain reports."
          )}
        </P>
        <P>
          {tr(
            "两类持续性监控的业务含义：",
            "What the two kinds of continuous monitoring mean in business terms:"
          )}
        </P>
        <Table
          head={[tr("模块", "Module"), tr("业务语义", "Business semantics")]}
          rows={[
            [tr("地址监控（KYA 对象的持续监控）", "Address Monitoring (continuous KYA subject)"), tr(
              "监控该地址后续发生的所有交易，对每一笔新交易做 KYT 查询 —— 及时发现该地址与高风险地址之间的资金往来（收款 = in 方向，付款 = out 方向）。",
              "Watch every future transaction of the address and run a KYT query per tx — promptly surfacing fund flows between this address and high-risk counterparties (receiving = in, sending = out)."
            )],
            [tr("TX 监控（交易对手的持续监控）", "TX Monitoring (continuous counterparty watch)"), tr(
              "持续监控某笔交易 from 或 to 地址自身的标签变化（周期性 KYA 复筛）—— 一旦对手方地址被打上 Sanctions（制裁）、Freeze（冻结）等高风险标签，第一时间告警。",
              "Continuously watch the from/to address's OWN label changes (periodic KYA re-screens) — the moment the counterparty gets tagged Sanctions, Freeze or similar, you're alerted immediately."
            )],
          ]}
        />
      </Section>

      {/* ── 接入 ── */}
      <Section title={tr("接入", "Access")}>
        <P>
          {tr(
            "AMLClaw 是开源自托管的 Width API 应用 Demo，本地 REST 接口默认开放访问、不做鉴权 —— 部署在你自己的服务器上，按需自行加网关或反向代理保护。Base URL 即你的部署地址，例如 http://localhost:3000。真正需要密钥的是底层的 Width.info API（见下方「上游引擎」一节）。",
            "AMLClaw is an open-source, self-hosted demo app for the Width API. Its local REST endpoints are open by default — deploy it on your own server and add a gateway / reverse proxy if you need access control. The base URL is your deployment address, e.g. http://localhost:3000. The key that actually matters is the upstream Width.info API key (see the 'Upstream Engine' section below)."
          )}
        </P>
      </Section>

      {/* ── 通用概念 ── */}
      <Section title={tr("通用概念", "Core Concepts")}>
        <Table
          head={[tr("概念", "Concept"), tr("说明", "Description")]}
          rows={[
            [tr("风险等级", "Risk levels"), tr(
              "核心信号是 risk（等级），由你的规则集决定：low → medium → high → critical。riskScore 只是等级的固定映射（low=10 / medium=60 / high=80 / critical=90），无独立含义，仅一处例外有用：riskScore=0 表示无任何规则命中（干净），可与「low 级规则命中」（=10）区分",
              "The core signal is risk (the level), determined by your ruleset: low → medium → high → critical. riskScore is just a fixed mapping of the level (low=10 / medium=60 / high=80 / critical=90) with no meaning of its own — except that 0 means NO rule triggered at all (clean), distinguishing it from a low-severity hit (=10)"
            )],
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
            ["min_amount", "number", "10", tr("最小转账金额（代币单位）", "Minimum transfer amount (token units)")],
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
            ["risk / riskScore", tr("综合风险等级（核心信号）；riskScore 为等级固定映射仅作参考，0 = 无命中", "Overall risk level (the core signal); riskScore is a fixed mapping for reference only, 0 = no hits")],
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
            "两种监控类型都只看未来动作：address 监控地址后续所有新增转账并逐笔 KYT（收款 = in，付款 = out），及时发现与高风险地址的资金往来；kyt 持续监控某笔交易 from/to 对手方地址自身的标签变化（周期性 KYA），涉及 Sanctions / Freeze 等高风险标签或风险升级时第一时间告警。",
            "Both monitor types watch FUTURE activity: 'address' KYT-screens every new transfer of the address (receive = in, send = out), surfacing fund flows with high-risk counterparties; 'kyt' continuously watches a tx's from/to address for label changes (periodic KYA) and alerts immediately on Sanctions / Freeze tags or risk escalation."
          )}
        </P>
        <P>
          {tr(
            "请求节奏：所有监控任务共享一条全局串行队列 —— 同一时刻只有一个任务在执行；任务内部逐笔筛查也是严格顺序的（等上一笔返回 → 间隔 2 秒 → 下一笔），不会并发挤占筛查 API。",
            "Request pacing: all monitor runs share one global sequential lane — only one task executes at a time; within a run each tx is screened strictly in order (await previous response → 2s pause → next), never hammering the screening API concurrently."
          )}
        </P>
        <P>
          {tr(
            "追溯深度：监控场景的 KYT / KYA 调用固定使用 1 跳（inflow_hops = outflow_hops = 1）—— 监控关心的是对象自身标签与直接对手方，1 跳几秒出结果，也更省配额；需要深度追溯时在单次筛查页手动调大跳数。服务重启后，错过的定时轮次会在启动时自动补跑一次。",
            "Trace depth: monitoring KYT / KYA calls are fixed at 1 hop (inflow_hops = outflow_hops = 1) — monitoring cares about the subject's own labels and direct counterparties; 1 hop returns in seconds and costs less. Use the single-screening pages when you need a deeper trace. Scheduled cycles missed while the app was down are caught up once on startup."
          )}
        </P>
        <P>
          {tr(
            "时间窗（滚动）：监控筛查使用 [上次检测时间 → 当前时间] 作为时间范围（min_timestamp / max_timestamp），首次运行从「加入监控的时刻」起算 —— 只追溯上次扫描以来的新活动。留空 min_timestamp 会让引擎从创世块追溯、越跑越慢；滚动窗让每轮保持快速稳定。",
            "Rolling time window: monitoring screens use [last run → now] as the range (min_timestamp / max_timestamp); the first run starts from when the monitor was added — tracing only activity since the previous scan. Leaving min_timestamp empty would trace from genesis and grow slower each cycle; the rolling window keeps every run fast and steady."
          )}
        </P>

        <Endpoint method="GET" path="/api/monitors?type=address|kyt" desc={tr("列出监控任务。", "List monitors.")} />
        <Endpoint method="POST" path="/api/monitors" desc={tr("创建监控任务。", "Create a monitor.")} />
        <P>{tr("地址监控（type = address）：", "Address monitor (type = address):")}</P>
        <Code>{`{ "type": "address", "chain": "Tron",
  "address": "T...", "min_amount": 1,
  "schedule_preset": "every_4h" }
// ${zh ? "游标自创建时刻起 — 不扫描历史交易" : "cursor starts at creation time — history is never scanned"}`}</Code>
        <P>{tr("TX 监控（type = kyt）：", "TX monitor (type = kyt):")}</P>
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
            ["kya_ruleset_id", tr("TX 监控周期 KYA 的规则集", "Ruleset for the TX monitor's periodic KYA")],
          ]}
        />
        <Endpoint method="PUT" path="/api/monitors/{id}" desc={tr("更新（启停 enabled、调度、阈值等）。", "Update (enabled, schedule, thresholds…).")} />
        <Endpoint method="DELETE" path="/api/monitors/{id}" desc={tr("删除任务（运行记录保留以备审计）。", "Delete (run records kept for audit).")} />
        <Endpoint method="POST" path="/api/monitors/{id}/run" desc={tr("立即手动执行一轮。", "Trigger a manual run now.")} />
        <Endpoint method="GET" path="/api/monitors/{id}/history" desc={tr("查看运行记录：每轮的新交易数 / 已筛查 / 跳过 / 最高风险，逐条结果含 job_id 可回查完整报告。", "Run records: per-run new/screened/skipped counts, highest risk; each result links a job_id to the full report.")} />
        <Endpoint method="GET" path="/api/monitors/{id}/txs" desc={tr("地址监控的交易台账（区块浏览器式列表）：每笔捕获的转账及其 KYT 状态（pending/screened/error/failed）、风险等级与 job_id。筛查失败的交易保留在台账中，后续运行自动重试（最多 3 次）。", "Address monitor's transaction ledger (explorer-style list): every captured transfer with its KYT state (pending/screened/error/failed), risk level and job_id. Failed screens stay in the ledger and are retried on later runs (max 3 attempts).")} />
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
            ["notifications", tr("高风险告警 Webhook URL 与开关", "High-risk alert webhook URL and toggle")],
          ]}
        />
      </Section>

      {/* ── 上游 API：Width.info ── */}
      <Section title={tr("上游引擎：Width.info API", "Upstream Engine: Width.info API")}>
        <P>
          {tr(
            "AMLClaw 的所有筛查能力由 Width.info（TrustIn AML 合规平台）提供。你也可以绕过 AMLClaw 直接调用它的 API —— 参数与本页的筛查接口一一对应。",
            "All of AMLClaw's screening power comes from Width.info (the TrustIn AML compliance platform). You can also call its API directly, bypassing AMLClaw — parameters map 1:1 to the screening endpoints on this page."
          )}
        </P>
        <Table
          head={[tr("项", "Item"), tr("值", "Value")]}
          rows={[
            [tr("文档 / 平台", "Docs / Platform"), <a key="d" href="https://width.info/api-reference" target="_blank" rel="noopener" style={{ color: "var(--primary-500)" }}>width.info/api-reference</a>],
            ["API Base URL", <code key="b" style={{ fontFamily: "var(--mono)" }}>https://api.trustin.bond</code>],
            [tr("鉴权", "Auth"), tr("URL 参数 ?apikey=<key>，或 Authorization: Bearer <JWT>。免费 key 在 width.info/api-keys 获取", "Query param ?apikey=<key>, or Authorization: Bearer <JWT>. Free key at width.info/api-keys")],
            [tr("规则集管理", "Ruleset management"), tr("width.info 平台 → Compliance → Rulesets：查看/创建/编辑规则集，列表中的 ID 即接口的 ruleset_id。内置默认（0）覆盖面宽，生产建议自建规则集并引用其 ID", "width.info → Compliance → Rulesets: view/create/edit rulesets; the listed ID is the API's ruleset_id. Builtin (0) is broad — create your own for production")],
          ]}
        />

        <P style={{ fontWeight: 600 }}>{tr("V3 筛查（AMLClaw 使用的核心端点）", "V3 Screening (the endpoints AMLClaw uses)")}</P>
        <Endpoint method="POST" path="https://api.trustin.bond/api/v3/screen/kya" desc={tr("地址筛查（Chainalysis 对齐 + 扩展）。sync 模式直接返回完整结果；async 返回 job_id。AMLClaw 的 /api/screening 就是它的封装。", "Address screening (Chainalysis-aligned + extensions). sync returns the full result; async returns a job_id. AMLClaw's /api/screening wraps this.")} />
        <Endpoint method="POST" path="https://api.trustin.bond/api/v3/screen/kyt" desc={tr("交易筛查。screen_direction 选 in（资金来源）/ out（资金去向）/ both；in_ruleset_id / out_ruleset_id 每方向独立规则集。AMLClaw 的 /api/kyt 就是它的封装。", "Transaction screening. screen_direction in / out / both; per-direction in_ruleset_id / out_ruleset_id. AMLClaw's /api/kyt wraps this.")} />
        <Endpoint method="GET" path="https://api.trustin.bond/api/v3/screen/result/{jobId}" desc={tr("async 模式的轮询接口（需带 type=kya|kyt 及原始参数）。AMLClaw 使用 sync 模式，不经过此接口。", "Polling endpoint for async mode (pass type=kya|kyt plus the original params). AMLClaw uses sync mode and skips this.")} />
        <Code>{`curl -X POST 'https://api.trustin.bond/api/v3/screen/kya?apikey=<KEY>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chain_name": "Tron", "address": "T...", "token": "usdt",
    "inflow_hops": 3, "outflow_hops": 3,
    "max_nodes_per_hop": 200, "max_opponent_paths": 50,
    "min_amount": 10, "ruleset_id": 0, "scenario": "all",
    "mode": "sync"
  }'
# → { "code": 0, "data": { "risk": "critical", "hits": [...], ... } }`}</Code>

        <P>
          {tr(
            "词汇对齐：风险等级 low/medium/high/critical；处置动作 block/review/alert/monitor；hits[].pathNodes 为完整路径节点（含标签与金额），deep=0 是风险实体。",
            "Vocabulary: risk levels low/medium/high/critical; actions block/review/alert/monitor; hits[].pathNodes are full path nodes (with tags & amounts), deep=0 = the risk entity."
          )}
        </P>
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

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "var(--sp-2) 0", ...style }}>{children}</p>;
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
