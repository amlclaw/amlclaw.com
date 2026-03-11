# UI Style Guide — AMLClaw Design System

> **Purpose**: 让任何 AI coding agent 或新开发者能在 5 分钟内掌握本项目的 UI 规范，快速产出风格一致的界面代码。

## 1. 设计语言

**Google AI Studio Dark** 风格 — 冷色调、低对比度、大圆角、呼吸感。支持 dark/light 双主题。

### 核心原则
- **Inline styles for layout**（flex, grid, padding, gap）
- **CSS classes for components**（`.btn`, `.card`, `.input`, `.risk-pill`）
- **CSS variables for tokens**（颜色、间距、圆角、字体大小）
- **No component library** — 纯手写 CSS，无 Material UI、shadcn 等
- **No markdown tables in JSX** — 全部用 `<table className="data-table">` 或 inline flex 布局

---

## 2. Design Tokens（CSS Variables）

### Colors

```css
/* Primary — Google Blue */
--primary-500: #1a73e8;         /* 按钮、链接、选中态 */
--primary-400: #4285f4;         /* hover 态 */
--primary-dim: rgba(26,115,232,0.08);  /* 选中背景 */

/* Surfaces — 从深到浅 */
--surface-0: #1a1a2e;    /* 页面背景 */
--surface-1: #1f1f33;    /* 卡片、面板、模态框 */
--surface-2: #252539;    /* 输入框背景、次级区域 */
--surface-3: #2c2c40;    /* hover 态 */
--surface-4: #343448;    /* 更亮的 hover */

/* Borders — 三级 */
--border-subtle: #2a2a3e;    /* 表格行线 */
--border-default: #303045;   /* 卡片边框、输入框边框 */
--border-strong: #3e3e55;    /* hover 边框 */

/* Text — 三级 */
--text-primary: #e8eaed;     /* 标题、主文本 */
--text-secondary: #9aa0a6;   /* 正文、按钮文字 */
--text-tertiary: #6b7280;    /* 占位符、次要标签 */

/* Risk — 四级 */
--risk-severe: #ef4444;   /* 红 */
--risk-high: #f97316;     /* 橙 */
--risk-medium: #eab308;   /* 黄 */
--risk-low: #34a853;      /* 绿 */

/* Semantic */
--success: #34a853;  --success-dim: rgba(52,168,83,0.1);
--warning: #f9ab00;  --warning-dim: rgba(249,171,0,0.1);
--danger: #ea4335;   --danger-dim: rgba(234,67,53,0.1);
--info: #4285f4;     --info-dim: rgba(66,133,244,0.1);
```

### Typography

```css
--font: 'Inter', 'Google Sans', -apple-system, sans-serif;
--mono: 'JetBrains Mono', 'Fira Code', monospace;

--text-xs: 0.694rem;    /* 标签、badge */
--text-sm: 0.833rem;    /* 正文、按钮 */
--text-base: 1rem;      /* 基准 (14px) */
--text-md: 1.125rem;
--text-lg: 1.25rem;     /* 页面标题 */
--text-xl: 1.5rem;
--text-2xl: 1.875rem;
```

### Spacing（4px grid）

```css
--sp-1: 4px;   --sp-2: 8px;   --sp-3: 12px;  --sp-4: 16px;
--sp-5: 24px;  --sp-6: 32px;  --sp-8: 40px;  --sp-10: 48px;
```

### Border Radius

```css
--radius-sm: 8px;       /* 小元素：checkbox, icon btn */
--radius: 12px;         /* 通用：input, list item */
--radius-lg: 16px;      /* 大元素：card, panel, modal */
--radius-xl: 24px;
--radius-full: 9999px;  /* 圆形：badge, pill */
```

---

## 3. Component Classes

### Buttons

```jsx
// 大小：btn-sm | btn-md | btn-lg
// 样式：btn-primary | btn-secondary | btn-ghost | btn-danger | btn-icon

<button className="btn btn-md btn-primary">Save</button>
<button className="btn btn-sm btn-secondary">Cancel</button>
<button className="btn btn-md btn-ghost">More</button>
<button className="btn btn-md btn-danger">Delete</button>
<button className="btn-icon">×</button>

// 按钮内嵌图标：inline SVG, 16x16, stroke="currentColor", strokeWidth="2"
<button className="btn btn-md btn-secondary">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
  Add Item
</button>
```

### Inputs

```jsx
<label className="label">Field Name</label>
<input className="input" placeholder="Enter value..." />
<input className="input input-sm" />
<textarea className="input" rows={4} />
<select className="input"><option>...</option></select>
<input className="input input-mono" />  {/* monospace */}
```

### Cards & Panels

```jsx
// Card — 最常用的容器
<div className="card">
  <div style={{ padding: "var(--sp-4)" }}>Content</div>
</div>

// Panel — 带 header 的结构化容器
<div className="panel">
  <div className="panel-header">
    <h3>Title</h3>
    <button className="btn btn-sm btn-ghost">Action</button>
  </div>
  <div className="panel-body">Content</div>
</div>
```

### Data Tables

```jsx
<div className="card">
  <table className="data-table">
    <thead>
      <tr>
        <th className="col-check"><input type="checkbox" className="checkbox" /></th>
        <th>Name</th>
        <th>Status</th>
        <th className="col-actions"></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td className="col-check"><input type="checkbox" className="checkbox" /></td>
        <td>Item name</td>
        <td><span className="badge badge-success">Active</span></td>
        <td className="col-actions">
          <button className="btn-icon">⋯</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Risk & Status Indicators

```jsx
// Risk pills — 用于风险等级显示
<span className="risk-pill severe">Severe</span>
<span className="risk-pill high">High</span>
<span className="risk-pill medium">Medium</span>
<span className="risk-pill low">Low</span>

// Badges — 用于状态标签
<span className="badge badge-success">Ready</span>
<span className="badge badge-warning">Generating</span>
<span className="badge badge-danger">Error</span>
<span className="badge badge-neutral">Draft</span>

// Category badge
<span className="category-badge">Singapore</span>
```

### Modals

```jsx
// 大小：modal-sm | modal-md | modal-lg | modal-xl | modal-xxl
{isOpen && (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal modal-md" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h3>Title</h3>
        <button className="btn-icon" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">Content</div>
      <div className="modal-footer">
        <button className="btn btn-md btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-md btn-primary">Confirm</button>
      </div>
    </div>
  </div>
)}
```

### Tabs

```jsx
<div className="tab-bar">
  <button className={`tab-btn ${active === "a" ? "active" : ""}`}>Tab A</button>
  <button className={`tab-btn ${active === "b" ? "active" : ""}`}>Tab B</button>
</div>
```

### List Items

```jsx
<div className={`list-item ${selected ? "active" : ""}`} onClick={...}>
  <span>🔵</span>
  <div>
    <div style={{ fontWeight: 500 }}>Title</div>
    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Subtitle</div>
  </div>
</div>
```

### Loading States

```jsx
// Skeleton
<div className="skeleton skeleton-heading" />
<div className="skeleton skeleton-text" />
<div className="skeleton skeleton-text" style={{ width: "40%" }} />

// Spinner
<div className="spinner" />
<div className="spinner spinner-sm" />

// AI cursor (used during streaming)
<span className="ai-cursor" />

// Pulse dot (active indicator)
<span className="pulse-dot" />
```

### Toast (via utility)

```typescript
import { showToast } from "@/lib/utils";

showToast("Success message", "success");
showToast("Error message", "error");
showToast("Info message", "info");
```

---

## 4. Layout Patterns

### Page Structure

每个页面都在 `app/(app)/` 路由组下，被 Sidebar 包裹。页面组件接收全宽区域。

```jsx
// 典型页面结构
export default function MyPage() {
  return (
    <div style={{ padding: "0 var(--sp-6) var(--sp-5)" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "var(--sp-4)"
      }}>
        <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>Page Title</h1>
        <button className="btn btn-md btn-secondary">Action</button>
      </div>

      {/* Content */}
      <div className="card">
        ...
      </div>
    </div>
  );
}
```

### Two-Column Layout（如 Screening, Rules）

```jsx
<div style={{
  display: "flex",
  gap: "var(--sp-5)",
  height: "calc(100vh - 120px)"
}}>
  <div style={{ width: 320, flexShrink: 0 }}>
    <div className="panel">Left panel</div>
  </div>
  <div style={{ flex: 1, minWidth: 0 }}>
    <div className="panel">Right panel</div>
  </div>
</div>
```

### Filter Bar + Table（如 Documents, Audit）

```jsx
{/* Search + Filters */}
<div style={{
  display: "flex",
  gap: "var(--sp-3)",
  marginBottom: "var(--sp-4)",
  flexWrap: "wrap",
  alignItems: "center"
}}>
  <input className="input" placeholder="Search..." style={{ width: 220 }} />
  <div style={{ display: "flex", gap: "var(--sp-1)", flexWrap: "wrap" }}>
    {categories.map(cat => (
      <button className={`btn btn-sm ${active === cat ? "btn-primary" : "btn-secondary"}`}>
        {cat}
      </button>
    ))}
  </div>
</div>

{/* Table */}
<div className="card">
  <div style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
    <table className="data-table">...</table>
  </div>
</div>
```

---

## 5. Icons

项目不使用图标库。所有图标为 **inline SVG**：

```jsx
// 标准参数
<svg viewBox="0 0 24 24" width="16" height="16" fill="none"
     stroke="currentColor" strokeWidth="2">
  <path d="..." />
</svg>

// 常用图标直接参考 https://lucide.dev/ 的 path data
// 大小：16x16（按钮内）、20x20（独立图标）、24x24（大图标）
```

---

## 6. React Patterns

### State Management
- **No Redux / Zustand** — 纯 React hooks
- `useState` + `useCallback` + `useEffect`
- 数据通过 `fetch()` 调用 API 路由

### Client Components
```jsx
"use client";
import { useState, useEffect, useCallback } from "react";
```

### Suspense for SearchParams
```jsx
// 使用 useSearchParams 的页面必须 Suspense 包裹
export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
function Inner() {
  const params = useSearchParams();
  ...
}
```

### Data Fetching Pattern
```jsx
const [data, setData] = useState([]);
const loadData = useCallback(() => {
  fetch("/api/endpoint")
    .then(r => r.json())
    .then(setData)
    .catch(() => {});
}, []);
useEffect(() => { loadData(); }, [loadData]);
```

---

## 7. 文件组织

```
components/
  documents/     # DocumentLibrary, DocumentModal, DocumentUpload
  policies/      # PolicyList, PolicyGenerator, PolicyViewer
  rules/         # RulesetList, RulesetViewer, RuleEditor, RuleCard
  screening/     # ScreeningForm, ScreeningResult, FlowGraph
  monitoring/    # MonitorList, MonitorEditor, MonitorRunHistory
  settings/      # SettingsPage (sections in tabs)
  shared/        # AIStreamPanel, PageGuide, SetupBanner, TopNav
  landing/       # 10 landing page sections
```

### CSS 文件
- `app/globals.css` — 核心设计系统（~800 行），导入其他模块
- `app/sidebar.css` — Sidebar 专用（响应式折叠逻辑）
- `app/screening.css` — Screening 页面特殊样式（FlowGraph）
- `app/rules.css` — Rules 页面特殊样式
- `app/settings.css` — Settings 页面表单样式（`settings-` 前缀）
- `app/dashboard.css` — Dashboard 图表和统计卡
- `app/landing.css` — Landing 页面（`landing-` 前缀）

### 命名前缀规则
- Landing 页面 CSS: `landing-xxx`
- Settings 页面 CSS: `settings-xxx`
- Setup banner: `setup-banner-xxx`
- 其他页面: 使用通用 class（`.card`, `.panel`, `.btn` 等）

---

## 8. Do's and Don'ts

### ✅ Do
- 用 `var(--sp-*)` 做间距，不要写死 `px`
- 用 `var(--text-*)` 做字号
- 用 `var(--surface-*)` 做背景色
- 用 `className="card"` / `className="panel"` 做容器
- 用 `className="btn btn-md btn-primary"` 做按钮
- 用 inline SVG 做图标
- 用 `showToast()` 做反馈
- 用 inline style 做 layout（flex, grid, gap, padding）

### ❌ Don't
- 不要用 Tailwind utility classes（`bg-blue-500`, `p-4`）— 项目虽有 Tailwind 但只用 CSS variables
- 不要引入新的 UI 组件库
- 不要写 CSS modules（`.module.css`）
- 不要用 `styled-components` / `emotion`
- 不要用 `px` 硬编码间距和字号
- 不要创建新的 CSS 文件除非是新的页面级模块
- 不要在 JSX 中写 markdown table

---

## 9. Quick Reference — 常用组合

```jsx
// 一行：标签 + 值
<div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
  <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>Label:</span>
  <span style={{ fontWeight: 500 }}>Value</span>
</div>

// 空状态
<div style={{
  textAlign: "center",
  padding: "var(--sp-10)",
  color: "var(--text-tertiary)"
}}>
  <div style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--sp-2)" }}>📄</div>
  <div style={{ fontWeight: 500, marginBottom: "var(--sp-1)" }}>No items yet</div>
  <div style={{ fontSize: "var(--text-xs)" }}>Create one to get started</div>
</div>

// Section 标题
<div style={{
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "var(--sp-3)"
}}>
  Section Title
</div>
```
