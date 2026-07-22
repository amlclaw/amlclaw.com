# AMLClaw v3 改版设计 — width.info V3 API 迁移

**日期**: 2026-07-22
**状态**: 已批准（用户确认 4 项决策 + 整体设计）

## 背景

规则引擎已迁移到 width.info 服务端（ruleset_id + compliance detection）。本地的
Documents → Policies → Rules 管线、Cases、SAR、审计日志全部废弃。产品聚焦：
**KYA 地址筛查 + KYT 交易筛查 + 两类前瞻性监控**。

## 已确认决策

| 决策 | 结论 |
|---|---|
| Dashboard | 保留并简化（双筛查统计 + 双监控状态 + 最近告警） |
| AI Copilot / AI Provider 设置 | 全部删除 |
| KYT 监控节奏 | 定时周期跑（沿用 cron 预设 1h/4h/8h/12h/24h） |
| Landing 页 | 本次一起改（五层管线 → KYA/KYT + 双监控叙事） |
| API 模式 | V3 sync 模式，后端后台调用，前端沿用本地 jobId 轮询 |

## 新导航（6 项）

Dashboard | 地址筛查 KYA | 交易筛查 KYT | 地址监控 | KYT 监控 | 设置

## API 层

`lib/width-api.ts` 替换 `lib/trustin-api.ts`：

- Base `https://width.info`，鉴权 `?apikey=`（settings 配置）
- `kyaScreen()` → `POST /api/v3/screen/kya`（sync）
- `kytScreen()` → `POST /api/v3/screen/kyt`（sync，`screen_direction=in/out/both`，
  `in_ruleset_id`/`out_ruleset_id` 默认 0 = KYT-IN/KYT-OUT 内置规则集）

响应关键字段（v3，Chainalysis 对齐 + 扩展）：
`risk / riskScore / riskReason / addressIdentifications / exposures / hits[]
(ruleCode, category, riskLevel, action, pathFlow, hops, opponentAddress, maxAmount,
pathNodes) / alerts[]（仅 KYT）/ rulesTriggered / totalPaths / hitPaths /
inflow|outflowRiskAmount|Rate`

## 页面

### 地址筛查（KYA）
输入：链（Ethereum/Tron）、地址、scenario、高级（hops/max_nodes/min_amount/ruleset_id 默认 0）。
结果：风险徽章 + riskReason + addressIdentifications + exposures 汇总 + hits 表 +
FlowGraph 证据图（hits[].pathNodes 构建）+ MD 导出 + History。
按钮 **Go on Monitoring** → 加入地址监控。

### 交易筛查（KYT，新增）
输入：链、tx hash、方向 both/in/out、token、每方向 ruleset_id。
结果：alerts + hits + 证据图 + History。
按钮 **Monitor from / Monitor to** → 加入 KYT 监控。

### 地址监控（监控未来交易）
- 创建：链 + 地址 + token（ETH: USDT+USDC；Tron: 仅 USDT）+ 最小金额（默认 1）+ 周期
- 每周期：etherscan v2 / trongrid 拉**新增**交易（游标 = last block/timestamp）→
  金额过滤 → 逐笔 KYT：**监控地址是收款方 → in，付款方 → out**
- 单轮筛查上限默认 20 笔，超出记 skipped
- high/critical → webhook 告警

### KYT 监控（监控交易对手方）
- 创建：链 + tx hash + 监控侧 from/to → 解析被监控地址
- 每周期对该地址跑 KYA，记录风险趋势；等级上升 → 告警

### Dashboard（简化）
KYA/KYT 筛查统计、监控任务状态、最近高风险告警、API 连通性。

## 设置

| 保留 | 删除 |
|---|---|
| API Keys：width.info apikey、etherscan key、trongrid key（空 = 内置默认 + 限流提示） | AI Provider tab |
| 筛查默认值（hops/nodes/min_amount）、监控默认周期 | 默认 ruleset/scenario 下拉（改数字 ruleset_id，默认 0） |
| webhook 通知、Bearer token、应用品牌 | Demo mode |

## 删除清单

- 页面：`documents/ policies/ rules/ cases/ sar/ audit/ docs/`
- API 路由：`documents policies rulesets cases sar audit ai copilot schema metrics`
- lib：`ai.ts ai-providers/ ai-agent.ts prompts.ts case-storage.ts sar-*.ts
  audit-log.ts validate-rules.ts extract-risk-paths.ts mcp-tools.ts`（含调用点清理）
- components：`documents/ policies/ rules/ copilot/`
- i18n 词条清理；CLAUDE.md / README 重写

## 实施顺序

1. **P1**：width-api 客户端 + 设置 + KYA/KYT 筛查页 + 模块删除 → build/lint/test + 浏览器实测
2. **P2**：地址监控 + KYT 监控
3. **P3**：Dashboard 简化 + Landing 改版 + 文档

## 安全注意

- apikey 只存 `data/settings.json`（已确认未被 git 追踪、在 .gitignore 中）
- 开源仓库，任何 key 不得进入提交历史
