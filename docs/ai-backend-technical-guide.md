# AMLClaw Web — 后端 AI 处理技术文档

> 本文档详细说明 AMLClaw Web 五步业务流水线（Documents → Policies → Rules → Screening → Monitoring）中，后端 AI 与核心引擎在每一步骤的具体处理逻辑、数据流转、关键代码位置，方便新成员快速上手。

---

## 目录

1. [整体架构概览](#1-整体架构概览)
2. [Step 1: Documents — 监管文档管理](#2-step-1-documents--监管文档管理)
3. [Step 2: Policies — AI 生成合规政策](#3-step-2-policies--ai-生成合规政策)
4. [Step 3: Rules — AI 生成规则集](#4-step-3-rules--ai-生成规则集)
5. [Step 4: Screening — 地址风险筛查](#5-step-4-screening--地址风险筛查)
6. [Step 5: Monitoring — 持续监控调度](#6-step-5-monitoring--持续监控调度)
7. [AI 引擎：多供应商 SDK](#7-ai-引擎多供应商-sdk)
8. [存储层](#8-存储层)
9. [关键数据结构](#9-关键数据结构)

---

## 1. 整体架构概览

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Documents   │───>│   Policies   │───>│    Rules     │───>│  Screening   │───>│  Monitoring  │
│  (人工+上传)  │    │  (AI 生成)    │    │ (AI 生成)    │    │ (API+引擎)    │    │  (Cron调度)   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
      │                   │                   │                   │                   │
      │ 存储: 静态JSON      │ SSE流式输出        │ SSE流式输出        │ 异步轮询           │ node-cron
      │ + 文件上传          │ AI SDK (多供应商) │ AI SDK (多供应商) │ TrustIn API       │ 批量筛查
      ▼                   ▼                   ▼                   ▼                   ▼
   data/uploads/      data/policies/     data/rulesets/     data/history/      data/monitors/
```

### 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| AI 引擎 | 多供应商 SDK: Claude (`@anthropic-ai/sdk`) / DeepSeek (OpenAI-compatible) / Gemini (`@google/genai`) |
| 配置管理 | `data/settings.json` — 通过 Settings 页面配置 API Key、供应商、默认参数 |
| 区块链数据 | TrustIn KYA v2 API |
| 定时任务 | node-cron (进程内单例) |
| 存储 | 文件系统 (Node.js `fs`)，无数据库 |

### AI 单任务锁

系统使用 **文件锁** (`data/.ai-lock.json`) 确保同一时刻只有一个 AI 任务在运行。

> **代码位置**: `lib/ai.ts`

---

## 2. Step 1: Documents — 监管文档管理

### 这一步做什么

管理 AML 监管参考文档（FATF 指南、各辖区法规等）。这一步 **没有 AI 参与**，是纯粹的文档存储和检索。

### 数据来源

1. **内置文档** — `data/documents.json` 定义元数据，实际内容在 `references/` 目录下
2. **用户上传** — `.md` / `.txt` 文件上传至 `data/uploads/`

### API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/documents` | 列出全部文档（内置 + 上传） |
| POST | `/api/documents/upload` | 上传新文档（FormData） |
| GET | `/api/documents/[docId]/content` | 读取文档原文 |

### 处理流程

```
用户上传 .md/.txt 文件
    │
    ├── 1. 解析 FormData，验证扩展名 (.md / .txt)
    ├── 2. 生成唯一 ID: `upload_${Date.now()}_${random}`
    ├── 3. 写入文件: data/uploads/{id}.{ext}
    └── 4. 更新元数据索引: data/uploads/_meta.json
```

> **代码位置**: `app/api/documents/upload/route.ts`

---

## 3. Step 2: Policies — AI 生成合规政策

### 这一步做什么

用户选择若干监管文档，AI 阅读后生成一份结构化的 AML 合规政策文档（Markdown 格式）。

### AI 处理详情

**Prompt 模板**: `prompts/generate-policy.md`

**输入变量**:
- `{{JURISDICTION}}` — 目标辖区（如 Singapore, Hong Kong, Dubai）
- `{{DOCUMENTS}}` — 所有选中文档的完整内容，以 `---` 分隔拼接

**AI 被要求输出的结构**:
1. Executive Summary（执行摘要）
2. Regulatory Scope & Applicability（监管范围）
3. Risk Appetite & Sanctions Policy（风险偏好与制裁政策）
4. Customer Due Diligence (CDD) & KYC
5. Transaction Monitoring — Inflow (Deposit)
6. Transaction Monitoring — Outflow (Withdrawal)
7. Travel Rule Compliance
8. Ongoing Monitoring & Reporting
9. Record Keeping
10. Escalation Matrix

### API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/policies` | 创建政策记录（status: "generating"） |
| POST | `/api/policies/generate` | 触发 AI 生成（返回 SSE 流） |
| GET | `/api/policies/[policyId]` | 获取政策内容 |

### 处理流程

```
前端 POST /api/policies/generate
  │  Body: { policyId, documentIds, jurisdiction }
  │
  ├── 1. 检查 AI 锁 (isAIBusy())，忙则返回 409
  │
  ├── 2. 根据 documentIds 加载每个文档的原文内容
  │      ├── 内置文档: references/{path}
  │      └── 上传文档: data/uploads/{path}
  │
  ├── 3. 加载 prompt 模板 (prompts/generate-policy.md)
  │      插入变量: JURISDICTION, DOCUMENTS
  │
  ├── 4. 调用 spawnAI()
  │      命令: claude -p "<prompt>" --output-format stream-json --verbose
  │
  ├── 5. SSE 流式返回
  │      ├── onData: 每收到一个 text chunk → `data: {"text":"..."}\n\n`
  │      ├── onComplete: 最终输出 → 保存到 data/policies/{policyId}.md
  │      │                         更新状态为 "ready"
  │      │                         发送 `event: done`
  │      └── onError: 更新状态为 "error"，发送 `event: error`
  │
  └── 6. 前端 AIStreamPanel 组件实时渲染 Markdown
```

### SSE 数据格式

```
data: {"text":"# AML Compliance Policy\n\n"}    ← 流式 chunk
data: {"text":"## 1. Executive Summary\n"}       ← 持续推送
...
event: done
data: {"id":"policy_1709654321_abc123"}          ← 生成完成
```

> **代码位置**:
> - API 路由: `app/api/policies/generate/route.ts`
> - Prompt 模板: `prompts/generate-policy.md`
> - AI 引擎: `lib/ai.ts` → `spawnAI()`
> - 存储: `lib/storage.ts` → `updatePolicy()`

---

## 4. Step 3: Rules — AI 生成规则集

### 这一步做什么

AI 读取 Step 2 生成的合规政策，将自然语言的政策描述转换为 **结构化 JSON 规则数组**，可直接用于 Step 4 的自动化筛查。

### AI 处理详情

**Prompt 模板**: `prompts/generate-rules.md`

**输入变量**:
- `{{POLICIES}}` — 合规政策的完整 Markdown 内容
- `{{SCHEMA}}` — 规则 JSON Schema (`data/schema/rule_schema.json`)
- `{{LABELS}}` — TrustIn AML 标签分类法 (`references/Trustin AML labels.md`)

**AI 被要求**:
1. 识别政策中的具体条件、阈值、风险等级、要求的动作
2. 为每条规则分配类别: `Deposit` / `Withdrawal` / `CDD` / `Ongoing Monitoring`
3. 使用合法的 graph 参数路径（如 `path.node.tags.primary_category`）
4. 仅使用 TrustIn 标签分类法中的合法标签值
5. **只输出纯 JSON 数组，不含 markdown 围栏或解释文字**

### API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/rulesets/generate` | 触发 AI 规则生成（返回 SSE 流） |
| GET | `/api/rulesets` | 列出所有规则集（内置 + 自定义） |
| GET | `/api/rulesets/[rulesetId]` | 获取规则集详情 |
| POST | `/api/rulesets/[rulesetId]/rules` | 手动添加单条规则 |

### 处理流程

```
前端 POST /api/rulesets/generate
  │  Body: { policyId, name?, jurisdiction? }
  │
  ├── 1. 检查 AI 锁
  │
  ├── 2. 加载对应 Policy 的 Markdown 内容
  │
  ├── 3. 加载 Rule Schema + TrustIn 标签分类法
  │
  ├── 4. 加载 prompt 模板 (prompts/generate-rules.md)
  │      插入变量: POLICIES, SCHEMA, LABELS
  │
  ├── 5. 调用 spawnAI()，SSE 流式返回
  │
  ├── 6. onComplete 时解析 AI 输出
  │      ├── 策略1: 直接 JSON.parse() 尝试
  │      ├── 策略2: 去除 markdown 围栏，用正则提取 JSON 数组
  │      └── 解析失败 → 返回错误
  │
  ├── 7. 保存规则集
  │      ├── 文件: data/rulesets/{rulesetId}.json
  │      └── 元数据: data/rulesets/_meta.json
  │
  └── 8. 发送 `event: done` + 规则数量
```

### 单条规则结构示例

```json
{
  "rule_id": "DEP-001",
  "category": "Deposit",
  "name": "Reject Direct Sanctioned Inflow",
  "risk_level": "Severe",
  "action": "Freeze",
  "direction": "inflow",
  "max_hops": 2,
  "conditions": [
    {
      "parameter": "path.node.tags.primary_category",
      "operator": "IN",
      "value": ["Sanctioned Entity", "Terrorist Financing"]
    }
  ]
}
```

### 内置规则集

系统预置 3 个辖区规则集（只读），位于 `data/defaults/`：
- `singapore_mas.json` — 新加坡 MAS DPT
- `hong_kong_sfc.json` — 香港 SFC VASP
- `dubai_vara.json` — 迪拜 VARA

> **代码位置**:
> - API 路由: `app/api/rulesets/generate/route.ts`
> - Prompt 模板: `prompts/generate-rules.md`
> - Schema 加载: `lib/prompts.ts` → `loadRuleSchema()`, `loadLabels()`

---

## 5. Step 4: Screening — 地址风险筛查

### 这一步做什么

对指定区块链地址进行 AML 筛查：调用 TrustIn KYA API 获取资金流图谱，然后用规则引擎对图谱中的每个节点进行规则匹配，输出风险实体列表。

### **这一步没有 AI 参与**

Screening 是纯算法处理，不调用 Claude。核心是两个引擎：

1. **TrustIn API 封装** (`lib/trustin-api.ts`) — 获取链上资金流图谱
2. **风险路径提取引擎** (`lib/extract-risk-paths.ts`) — 基于规则过滤

### API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/screening` | 提交筛查任务，返回 jobId |
| GET | `/api/screening/[jobId]` | 轮询查询筛查状态/结果 |
| GET | `/api/screening/[jobId]/export` | 导出筛查报告 |
| GET | `/api/screening/history` | 历史记录列表 |

### 处理流程

```
前端 POST /api/screening
  │  Body: { chain, address, scenario, ruleset_id, inflow_hops, outflow_hops, max_nodes }
  │
  ├── 1. 参数校验 + 加载规则集
  │
  ├── 2. 生成 jobId，写入内存 screeningJobs[jobId]
  │      status: "running"
  │
  ├── 3. 立即返回 { job_id: "..." }（非阻塞）
  │
  └── 4. 后台异步执行 runScreening()
         │
         ├── Step A: 调用 TrustIn KYA API
         │   ├── POST submit_task → 获取 taskId
         │   ├── 轮询 get_status（每 2 秒，最多 30 次）
         │   └── POST get_result → 获取完整图谱数据
         │
         ├── Step B: 风险路径提取 extractRiskPaths()
         │   ├── (a) 按 scenario 过滤规则类别
         │   │       deposit → 只用 Deposit 类规则
         │   │       withdrawal → 只用 Withdrawal 类规则
         │   │       all → 使用全部规则
         │   │
         │   ├── (b) 按 scenario 过滤路径方向
         │   │       withdrawal → 只分析 outflow 路径
         │   │       其他 → 分析所有方向
         │   │
         │   ├── (c) Target 自身标签评估
         │   │       评估目标地址自身是否有标签匹配规则
         │   │       （如地址本身被标记为 Sanctioned Entity）
         │   │
         │   ├── (d) 路径节点遍历
         │   │       对图谱中每条路径的每个节点:
         │   │       ├── 跳过目标地址自身
         │   │       ├── 计算真实跳数 (trueDeep)
         │   │       ├── 选取最高优先级标签
         │   │       ├── 检查规则方向+跳数约束
         │   │       └── 逐条规则匹配 conditions (AND 逻辑)
         │   │
         │   ├── (e) 合并去重
         │   │       同一地址多次出现 → 合并 matched_rules, 取 min_deep
         │   │       每个实体最多保留 3 条 evidence_paths
         │   │
         │   └── (f) 排序 + 汇总
         │           按风险等级排序: Severe > High > Medium > Low
         │           生成 summary: 最高风险、触发规则数等
         │
         ├── Step C: 保存结果
         │   ├── 更新 screeningJobs[jobId]
         │   └── 持久化到 data/history/{jobId}.json
         │
         └── 前端每 3 秒 GET /api/screening/{jobId} 轮询
```

### TrustIn KYA API 调用细节

```
1. POST submit_task
   Payload: { chain_name, address, inflow_hops, outflow_hops, max_nodes_per_hop }
   → 返回 task_id

2. POST get_status (轮询)
   Payload: { task_id }
   → "finished" 时进入下一步

3. POST get_result
   Payload: { task_id, token: "usdt" }
   → 返回完整图谱 (paths[], tags[], nodes)
```

> **代码位置**:
> - API 路由: `app/api/screening/route.ts`
> - TrustIn 封装: `lib/trustin-api.ts` → `kyaProDetect()`
> - 规则引擎: `lib/extract-risk-paths.ts` → `extractRiskPaths()`

### 规则匹配引擎核心逻辑

```typescript
// 对每个节点，逐条规则检查：
for (const rule of filteredRules) {
  // 1. 方向检查: rule.direction 与路径 direction 匹配?
  // 2. 跳数检查: nodeDeep 在 [rule.min_hops, rule.max_hops] 范围内?
  // 3. 条件匹配: 所有 conditions 均满足 (AND 逻辑)?
  //    - "IN": 节点标签值在给定列表中
  //    - "==": 精确匹配
  //    - "!=": 不等于
  //    - "NOT_IN": 不在列表中
}
```

---

## 6. Step 5: Monitoring — 持续监控调度

### 这一步做什么

对一组地址设置定时自动筛查，使用 node-cron 在进程内调度。每次运行对地址列表中的每个地址执行一次完整的 Screening 流程。

### **这一步没有 AI 参与**

Monitoring 复用 Step 4 的 TrustIn API + 规则引擎，只是加了定时调度层。

### API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/monitors` | 创建监控任务 |
| GET | `/api/monitors` | 列出所有监控任务 |
| GET | `/api/monitors/[monitorId]` | 获取任务详情 |
| PATCH | `/api/monitors/[monitorId]` | 更新任务（启停、修改频率） |
| POST | `/api/monitors/[monitorId]/run` | 手动触发一次运行 |
| GET | `/api/monitors/[monitorId]/history` | 获取运行历史 |

### 处理流程

```
创建监控任务 POST /api/monitors
  │  Body: { addresses[], scenario, ruleset_id, schedule, inflow_hops, ... }
  │
  ├── 1. 保存任务: data/monitors/{id}.json
  ├── 2. 创建运行目录: data/monitors/{id}/runs/
  ├── 3. 若 enabled=true，注册 cron 任务
  └── 4. 返回任务对象

定时触发 / 手动触发
  │
  └── executeMonitorTask(taskId, trigger)
       │
       ├── 1. 防重入检查 (runningTasks Set)
       │
       ├── 2. 加载任务配置 + 规则集
       │
       ├── 3. 对每个地址串行执行:
       │      ├── kyaProDetect() → 获取图谱
       │      ├── extractRiskPaths() → 规则匹配
       │      └── saveHistoryEntry() → 写入筛查历史
       │         (source: "monitor", 含 monitor_task_id + monitor_run_id)
       │
       ├── 4. 汇总运行结果
       │      ├── total_addresses: 总地址数
       │      ├── completed: 成功数
       │      ├── flagged: 有风险实体的地址数
       │      └── highest_risk: 本次最高风险等级
       │
       ├── 5. 保存运行记录: data/monitors/{id}/runs/{runId}.json
       │
       └── 6. 更新任务: last_run_at, next_run_at, last_result_summary
```

### 调度频率预设

| Key | Cron 表达式 | 说明 |
|-----|------------|------|
| `every_1h` | `0 * * * *` | 每小时 |
| `every_4h` | `0 */4 * * *` | 每 4 小时 |
| `every_8h` | `0 */8 * * *` | 每 8 小时 |
| `every_12h` | `0 */12 * * *` | 每 12 小时 |
| `every_24h` | `0 0 * * *` | 每天零点 |

> **代码位置**:
> - 调度器: `lib/scheduler.ts`
> - API 路由: `app/api/monitors/[monitorId]/run/route.ts`

---

## 7. AI 引擎：多供应商 SDK

### 核心文件: `lib/ai.ts`

系统支持三个 AI 供应商，用户通过 Settings 页面（`/settings`）选择活跃供应商并配置 API Key：

| 供应商 | SDK | 适配器文件 |
|--------|-----|-----------|
| Claude (Anthropic) | `@anthropic-ai/sdk` | `lib/ai-providers/claude.ts` |
| DeepSeek | `openai` (OpenAI-compatible) | `lib/ai-providers/deepseek.ts` |
| Gemini (Google) | `@google/genai` | `lib/ai-providers/gemini.ts` |

### 执行机制

```
spawnAI(opts) 被调用
    │
    ├── 1. 获取文件锁 (data/.ai-lock.json)
    │      记录: { id, type, startedAt, provider }
    │
    ├── 2. 从 settings.json 读取活跃供应商 + API Key
    │      getActiveAIConfig() → { provider, config }
    │
    ├── 3. 分发到对应适配器
    │      getStreamFunction(provider) → streamClaude / streamDeepSeek / streamGemini
    │
    ├── 4. 适配器内部使用各自 SDK 的流式 API
    │      每收到一个 text chunk → callbacks.onData(chunk)
    │      全部完成后 → callbacks.onComplete(fullText)
    │
    └── 5. 释放文件锁
```

### 配置管理: `lib/settings.ts`

Settings 存储在 `data/settings.json`，包含：
- AI 供应商选择 + 各供应商 API Key / Model / Base URL
- TrustIn API Key + Base URL
- Screening / Monitoring 默认参数
- 应用品牌（名称、报告头、主题）

API 端点：
- `GET /api/settings` — 读取设置（API Key 脱敏显示）
- `PUT /api/settings` — 更新设置
- `POST /api/settings/test-connection` — 测试 API Key 有效性

### Prompt 模板系统: `lib/prompts.ts`

```
prompts/
├── generate-policy.md   ← Documents → Policy
├── generate-rules.md    ← Policy → Rules JSON
├── refine-rules.md      ← 用户指令修改现有规则 (预留)
└── explain.md           ← 解释 AML 内容 (预留)
```

加载方式：`loadPrompt("generate-policy", { JURISDICTION: "Singapore", DOCUMENTS: "..." })`

使用 `{{VAR}}` 占位符，全局替换。

### 辅助数据加载

| 函数 | 来源 | 用途 |
|------|------|------|
| `loadRuleSchema()` | `data/schema/rule_schema.json` | 告诉 AI 规则的合法结构 |
| `loadLabels()` | `references/Trustin AML labels.md` | 告诉 AI 合法的标签值 |

---

## 8. 存储层

### 核心文件: `lib/storage.ts`

纯文件系统存储，无数据库。写操作会先 `ensureDir()` 确保目录存在，读失败时回退到内存 Map（serverless 兼容）。

### 存储布局

```
data/
├── settings.json                     ← 用户配置 (API Keys, 默认参数, 品牌)
├── .ai-lock.json                     ← AI 任务锁
├── documents.json                    ← 内置文档元数据
├── schema/
│   └── rule_schema.json              ← 规则 JSON Schema
├── defaults/                         ← 内置规则集 (只读)
│   ├── singapore_mas.json
│   ├── hong_kong_sfc.json
│   └── dubai_vara.json
├── uploads/                          ← 用户上传文档
│   ├── _meta.json                    ← 上传索引
│   └── upload_*.md
├── policies/                         ← AI 生成的政策
│   ├── _index.json                   ← 政策元数据索引
│   └── policy_*.md                   ← 政策内容
├── rulesets/                          ← AI 生成的自定义规则集
│   ├── _meta.json                    ← 规则集元数据索引
│   └── custom_ai_*.json              ← 规则数组
├── history/                          ← 筛查历史
│   ├── index.json                    ← 历史索引 (最多100条)
│   └── {jobId}.json                  ← 完整筛查结果
└── monitors/                         ← 持续监控
    ├── _index.json                   ← 监控任务索引
    ├── {monitorId}.json              ← 任务配置
    └── {monitorId}/runs/             ← 运行记录
        └── {runId}.json
```

---

## 9. 关键数据结构

### Policy 元数据

```typescript
interface PolicyMeta {
  id: string;                    // "policy_1709654321_abc123"
  name: string;                  // "Singapore MAS Compliance Policy"
  jurisdiction: string;          // "Singapore"
  status: "generating" | "ready" | "error";
  source_documents: string[];    // ["fatf-001", "upload_xxx"]
  created_at: string;
  updated_at: string;
}
```

### Rule 结构

```typescript
interface Rule {
  rule_id: string;               // "DEP-001"
  category: string;              // "Deposit" | "Withdrawal" | "CDD" | "Ongoing Monitoring"
  name: string;                  // "Reject Direct Sanctioned Inflow"
  risk_level: string;            // "Low" | "Medium" | "High" | "Severe"
  action: string;                // "Allow" | "Warning" | "Review" | "EDD" | "Reject" | "Freeze"
  direction?: string;            // "inflow" | "outflow"
  min_hops?: number;
  max_hops?: number;
  conditions?: RuleCondition[];
}

interface RuleCondition {
  parameter: string;             // "path.node.tags.primary_category"
  operator: string;              // "IN" | "==" | "!=" | "NOT_IN"
  value: unknown;                // ["Sanctioned Entity"] or "High"
}
```

### Risk Entity（筛查结果）

```typescript
interface RiskEntity {
  address: string;               // 风险地址
  min_deep: number;              // 最近跳数
  tag: {
    primary_category: string;    // "Illicit"
    secondary_category: string;  // "Sanctioned Entity"
    risk_level: string;          // "High"
    // ...
  };
  matched_rules: string[];       // ["DEP-001", "DEP-003"]
  evidence_paths: EvidencePath[];// 最多 3 条证据路径
  occurrences: number;           // 出现次数
}
```

### Scenario 与规则过滤映射

| Scenario | 使用的规则类别 | 分析的路径方向 | 典型用途 |
|----------|--------------|--------------|---------|
| `deposit` | Deposit | 全部 | 入金来源风险分析 |
| `withdrawal` | Withdrawal | 仅 outflow | 出金目的地筛查 |
| `onboarding` | Deposit | 全部 | KYC 开户审查 |
| `cdd` | CDD | 全部 | 交易阈值触发 |
| `monitoring` | Ongoing Monitoring | 全部 | 结构化交易检测 |
| `all` | 全部 | 全部 | 综合全面扫描 |

---

## 总结：哪些步骤用了 AI，哪些没有

| 步骤 | AI 参与? | 处理方式 |
|------|---------|---------|
| 1. Documents | **否** | 文件存储/检索 |
| 2. Policies | **是** — AI SDK (多供应商) | SSE 流式生成 Markdown 政策文档 |
| 3. Rules | **是** — AI SDK (多供应商) | SSE 流式生成 JSON 规则数组 |
| 4. Screening | **否** | TrustIn API + 规则引擎 (纯算法) |
| 5. Monitoring | **否** | node-cron 调度 + 复用 Step 4 |

AI 仅在 Step 2 和 Step 3 介入，负责 **文档理解和结构化转换**。Step 4/5 的风险判断完全基于确定性的规则匹配算法，不涉及 LLM 推理。

---

## 10. 横切关注点

### 审计日志 (`lib/audit-log.ts`)

Append-only JSONL 事件日志，位于 `data/audit/log.jsonl`。上限 10,000 条事件。

覆盖的事件类型：
- `screening.started` / `screening.completed` / `screening.error` / `screening.exported`
- `ruleset.created` / `policy.created`
- `monitor.run_started` / `monitor.run_completed`
- `settings.updated`
- `webhook.delivered` / `webhook.failed`

API 端点：`GET /api/audit?limit=50&offset=0&action=screening`

前端查看页面：`/audit`（分页表格 + 事件类型过滤器）

### Webhook 通知 (`lib/webhook.ts`)

当筛查或监控发现 Severe/High 风险时，向配置的 URL 发送 HTTP POST 通知。

Payload 格式：
```json
{
  "event": "screening.high_risk",
  "timestamp": "2026-03-07T...",
  "data": { "job_id": "...", "address": "...", "risk_level": "Severe", ... }
}
```

在 Settings > Notifications 中配置：启用/禁用、Webhook URL、是否仅告警高风险。

### API 认证 (`lib/auth.ts`)

Bearer Token 认证，适用于自托管场景。

- 在 Settings > Security 中设置 API Token
- 设置后所有 API 请求需携带 `Authorization: Bearer <token>` 头
- Token 为空 = 开放访问（向后兼容）

### 国际化 (`lib/i18n.ts`)

轻量级 en/zh 双语支持（~150 个翻译 key），无外部依赖。

- 自动检测浏览器语言，持久化到 `localStorage("locale")`
- React Hook: `useI18n()` → `{ locale, setLocale, t }`
- Sidebar 底部有语言切换按钮

### 批量筛查 (`/api/screening/batch`)

POST 端点，接受 `{ addresses: [{chain, address}], scenario, ruleset_id }`，最多 100 个地址。串行执行，每个地址独立保存为筛查历史。通过 GET `?id=batch_xxx` 轮询进度。

### Dashboard (`/dashboard`)

概览页面：总筛查数、周活跃度、风险分布图表、最近筛查列表、活跃监控数量、系统状态（API 连接性、调度器状态）。

API 端点：`GET /api/dashboard`
