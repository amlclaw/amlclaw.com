# Dashboard — 功能规格文档

> **目的**: 让新 agent 从零重新实现 Dashboard 页面。本文档描述所有功能需求、数据来源、UI 布局和交互规范。
>
> **前置阅读**: `CLAUDE.md`（项目架构）+ `docs/UI_STYLE_GUIDE.md`（UI 规范）

---

## 1. 页面概览

Dashboard 是登录后的首页（`/dashboard`），提供 AML 合规运营的全局概览。一屏内展示关键指标、风险分布、最近筛查记录和系统健康状态。

**路径**: `app/(app)/dashboard/page.tsx`
**CSS**: `app/dashboard.css`（`dashboard-` 前缀）
**数据源**: 两个 API 并行请求

---

## 2. 数据 API

### 2.1 GET /api/dashboard

**文件**: `app/api/dashboard/route.ts`

返回业务层面的统计数据。

```typescript
{
  stats: {
    total_screenings: number;       // 历史筛查总数（从 history/index.json）
    screenings_this_week: number;   // 近 7 天筛查数
    policies_count: number;         // 已生成的合规政策数
    rulesets_count: number;         // 规则集总数（内置 + 自定义）
    monitors_active: number;        // 启用中的监控任务数
    monitors_running: number;       // 正在运行的监控任务数
    monitored_addresses: number;    // 所有监控任务的地址总数
  };
  risk_distribution: {              // 近 7 天风险等级分布
    Severe: number;
    High: number;
    Medium: number;
    Low: number;
  };
  recent_screenings: Array<{        // 最近 10 条筛查记录
    job_id: string;
    chain: string;                  // "Tron" | "Ethereum" | "Bitcoin"
    address: string;                // 完整链上地址
    scenario: string;               // "deposit" | "withdrawal" | "cdd" | "monitoring" | "all"
    ruleset: string;
    risk_level: string;             // "Severe" | "High" | "Medium" | "Low"
    risk_entities_count: number;
    completed_at: string;           // ISO 8601
  }>;
  api_status: {
    ai_configured: boolean;         // 当前 AI provider 是否配了 API key
    ai_provider: string;            // "claude" | "deepseek" | "gemini"
    trustin_configured: boolean;    // TrustIn API key 是否配置
    scheduler_active: boolean;      // node-cron 调度器是否初始化
    scheduler_jobs: number;         // 活跃 cron job 数
  };
}
```

**数据来源**:
- `loadHistoryIndex()` → `data/history/index.json`
- `loadMonitorIndex()` → `data/monitors/_index.json`
- `loadAllPolicies()` → `data/policies/_index.json`
- `getAllRulesets()` → `data/defaults/*.json` + `data/rulesets/_meta.json`
- `getSchedulerStatus()` → `lib/scheduler.ts` 内存状态
- `getSettings()` → `data/settings.json`

### 2.2 GET /api/metrics

**文件**: `app/api/metrics/route.ts` → `lib/metrics.ts`

返回运维层面的系统指标（从审计日志计算）。

```typescript
{
  system: {
    start_time: string;            // 进程启动时间 ISO 8601
    uptime_seconds: number;
    last_screening_at: string | null;
  };
  screening: {
    total: number;
    successful: number;            // 从 audit log 统计
    failed: number;
    avg_latency_ms: number;        // 筛查平均耗时（start→complete）
    today: number;
    this_week: number;
  };
  ai: {
    total_calls: number;           // AI 生成调用总数
    successful: number;
    failed: number;
    by_provider: Record<string, {  // 按 provider 分组
      total: number;
      successful: number;
      failed: number;
    }>;
  };
  monitors: {
    total: number;
    active: number;
    paused: number;
    total_addresses: number;
  };
  connections: {
    ai_configured: boolean;
    ai_provider: string;
    trustin_configured: boolean;
    scheduler_active: boolean;
  };
}
```

---

## 3. 页面布局

```
┌──────────────────────────────────────────────────────┐
│  Dashboard                                           │
│  Overview of your AML compliance operations          │
├──────────────────────────────────────────────────────┤
│  ⚠️ API Status Alert (条件渲染)                      │
├──────────────────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │Total│ │Week │ │Poli-│ │Rule │ │Moni-│ │Addr-│  │
│  │Scrn │ │     │ │cies │ │Sets │ │tors │ │esses│  │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘  │
│  Stats Grid (6 cards, auto-fill, minmax 160px)       │
├────────────────────┬─────────────────────────────────┤
│  Risk Distribution │  Recent Screenings              │
│  (7 days)          │  (最近 8 条, 可点击跳转)        │
│                    │                                 │
│  Severe  ████░░ 3  │  🔴 Txyz...abc  Tron    2m ago │
│  High    ██░░░░ 1  │  🟡 T123...def  ETH     5m ago │
│  Medium  ███░░░ 2  │  🟢 bc1q...ghi  BTC    12m ago │
│  Low     █████░ 5  │  ...                           │
│                    │  [View All →]                   │
├────────────────────┴─────────────────────────────────┤
│  System Health                              Uptime   │
│  ● AI Engine: claude — Connected                     │
│  ● TrustIn API: Connected                            │
│  ● Screenings (Total/Week/Today): 128 / 11 / 3      │
│  ● Avg Screening Latency: 12.3s                      │
│  ● Active Monitors: 3 active / 1 paused             │
│  ● Last Screening: 2 minutes ago                     │
├──────────────────────────────────────────────────────┤
│  System Status                                       │
│  ● AI Provider: claude                               │
│  ● TrustIn API: Connected                            │
│  ● Scheduler: Active (3 jobs)                        │
│  ● Running Monitors: 2                               │
└──────────────────────────────────────────────────────┘
```

---

## 4. 功能模块详细规格

### 4.1 API Status Alert（条件渲染）

**显示条件**: AI 或 TrustIn API key 未配置时
**样式**: `dashboard-alert`（黄色警告条）
**内容**: 提示文案 + "Go to Settings" 链接（`/settings`）
**三种情况**:
- 都没配: "AI provider and TrustIn API keys not configured."
- 只缺 AI: "AI provider API key not configured."
- 只缺 TrustIn: "TrustIn API key not configured."

### 4.2 Stats Grid（6 张统计卡片）

| 卡片 | 数据字段 | 图标 | 可点击跳转 |
|------|----------|------|-----------|
| Total Screenings | `stats.total_screenings` | 🔍 search | `/screening` |
| This Week | `stats.screenings_this_week` | 📅 calendar | — |
| Policies | `stats.policies_count` | 📄 doc | `/policies` |
| Rule Sets | `stats.rulesets_count` | ✅ rules | `/rules` |
| Active Monitors | `stats.monitors_active` | ⏰ monitor | `/monitoring` |
| Monitored Addresses | `stats.monitored_addresses` | 👤 address | — |

**布局**: CSS Grid, `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))`
**卡片规格**:
- 大数字: `text-2xl`, `font-weight: 700`, `font-family: mono`
- 标签: `text-xs`, `color: text-tertiary`
- 图标: 20x20 SVG, `opacity: 0.5`, 右上角
- 有 `href` 的卡片整体可点击（`<Link>` 包裹）

### 4.3 Risk Distribution（风险分布图）

**数据**: `risk_distribution` — 近 7 天的 Severe/High/Medium/Low 计数
**可视化**: 水平进度条
- 每个等级一行：标签（彩色）+ 计数 + 进度条
- 进度条高度 6px, 圆角 3px
- 背景 `surface-3`, 填充色用 `--risk-{level}` 变量
- 宽度按百分比 `(count / total) * 100%`, 带 `transition: width 0.6s ease`
**空状态**: "No screenings this week"（居中灰字）

### 4.4 Recent Screenings（最近筛查）

**数据**: `recent_screenings` 取前 8 条
**每行**:
- Risk pill（对应颜色的小标签）
- 地址（缩写，用 `shortenAddr()`，mono 字体）
- 链名（灰色小字）
- 时间（相对时间，用 `formatTime()`）
**交互**:
- 每行可点击，跳转 `/screening?job={job_id}`
- hover 高度: `background: var(--surface-3)`
- 行之间用 `border-bottom: 1px solid var(--border-subtle)` 分隔
**Header**: 标题 + "View All" 按钮（跳 `/screening`）
**空状态**: "No screenings yet. Start one"（含链接）

### 4.5 System Health（系统健康）

**数据源**: `/api/metrics`
**显示条件**: `metrics` 不为 null 时渲染
**Header**: "System Health" + Uptime（右上角灰字）
**6 个状态项**:

| 标签 | 值 | 绿灯条件 |
|------|-----|---------|
| AI Engine | `{provider} — Connected` / `Not configured` | `ai_configured` |
| TrustIn API | `Connected` / `Not configured` | `trustin_configured` |
| Screenings (Total/Week/Today) | `{total} / {week} / {today}` | 永远绿 |
| Avg Screening Latency | `{x.x}s` / `N/A` | < 60s |
| Active Monitors | `{active} active / {paused} paused` | 永远绿 |
| Last Screening | 相对时间 / `Never` | 有值则绿 |

**StatusItem 组件**: 圆点（8px, 绿/红）+ 标签（`text-xs`, 灰色）+ 值（`text-xs`, 白色）

### 4.6 System Status（系统状态）

**数据源**: `/api/dashboard`（`api_status` 字段）
**4 个状态项**:
- AI Provider: 名称, 绿灯 = 有 key
- TrustIn API: Connected/Not configured, 绿灯 = 有 key
- Scheduler: Active ({n} jobs) / Inactive, 绿灯 = active
- Running Monitors: 数字, 永远绿

---

## 5. CSS Classes（dashboard.css）

```css
.dashboard-alert          /* 黄色警告条: flex, warning 配色 */
.dashboard-stats-grid     /* 统计卡片网格: auto-fill, minmax(160px, 1fr) */
.dashboard-stat-card      /* 单个统计卡片: surface-1 背景, 圆角, hover 边框变化 */
.dashboard-columns        /* 双栏布局: grid 1fr 1fr, 768px 以下变单栏 */
.dashboard-status-grid    /* 状态项网格: auto-fill, minmax(200px, 1fr) */
```

---

## 6. 工具函数依赖

```typescript
import { shortenAddr, formatTime } from "@/lib/utils";

// shortenAddr("TJ7nG...abc") → "TJ7n...abc"  (前4+后3)
// formatTime("2025-03-11T10:30:00Z") → "2m ago" / "3h ago" / "Mar 11"
```

---

## 7. 响应式行为

| 断点 | Stats Grid | 双栏布局 |
|------|-----------|---------|
| > 768px | `repeat(auto-fill, minmax(160px, 1fr))` — 通常 6 列 | 两列并排 |
| ≤ 768px | `repeat(2, 1fr)` — 两列 | 单列堆叠 |

---

## 8. 加载与错误状态

- **Loading**: 居中大号 spinner（`spinner spinner-lg`），`paddingTop: 100`
- **Error**: 灰字 "Failed to load dashboard data"，居中
- **数据加载**: `Promise.all([dashboard, metrics])`，并行请求，任一失败不阻塞

---

## 9. 交互细节

1. **页面刷新即可更新数据**（无自动轮询，简单可靠）
2. **StatCard 点击跳转**: Total Screenings → `/screening`, Policies → `/policies`, Rules → `/rules`, Active Monitors → `/monitoring`
3. **Recent Screening 行点击**: 跳转 `/screening?job={job_id}`，展示该次筛查结果
4. **Settings 链接**: Alert 条内跳转 `/settings` 配置 API key

---

## 10. 改进建议（可选实现）

以下是当前版本的已知可改进点，新 agent 可选择实现：

1. **自动刷新**: 每 30-60s 轮询更新数据
2. **时间段选择器**: 支持切换 7d / 30d / 90d 统计区间
3. **趋势图**: 用 SVG 或 Canvas 画近 7 天的筛查量折线图
4. **合并 System Health 和 System Status**: 当前有信息重复（AI/TrustIn 状态显示了两次）
5. **快捷操作**: 添加 "Quick Screen" 入口（直接输入地址开始筛查）
6. **通知中心**: 显示未读的高风险告警
