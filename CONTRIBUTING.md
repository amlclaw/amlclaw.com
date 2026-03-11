# Contributing to AMLClaw Web

[中文版](#中文) | [English](#english)

---

<a name="english"></a>

## English

Thank you for your interest in contributing to AMLClaw Web! This guide will help you get started.

### Development Setup

```bash
git clone https://github.com/amlclaw/amlclaw.com.git
cd amlclaw-web
npm install
npm run dev
```

Open http://localhost:3000. Configure API keys in **Settings**.

### Code Standards

- **TypeScript** — strict mode, no `any` unless unavoidable
- **React** — functional components, hooks only (no class components)
- **Styling** — Tailwind CSS 4 + CSS custom properties, no inline styles for colors
- **CSS namespacing** — prefix by feature: `landing-`, `settings-`, `setup-banner`
- **Imports** — use `@/*` path alias
- **Linting** — run `npm run lint` before committing

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable release |
| `dev` | Development integration |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `docs/*` | Documentation |

### Pull Request Process

1. Fork the repo and create your branch from `dev`
2. Make your changes with clear, atomic commits
3. Ensure `npm run lint` and `npm run build` pass
4. Run `npm run test:unit` to verify tests pass
5. Submit a PR to `dev` with a clear description
6. Fill out the PR template completely

### Issue Guidelines

- **Bug reports** — use the bug report template, include reproduction steps
- **Feature requests** — use the feature request template, explain the use case
- Search existing issues before creating new ones

### Testing

```bash
npm run test:unit    # Unit tests (vitest)
npm run dev &        # Start dev server first
npm test             # Integration tests
```

---

<a name="中文"></a>

## 中文

感谢你对 AMLClaw Web 的贡献兴趣！以下指南将帮助你快速上手。

### 开发环境搭建

```bash
git clone https://github.com/amlclaw/amlclaw.com.git
cd amlclaw-web
npm install
npm run dev
```

打开 http://localhost:3000，在 **Settings** 页面配置 API 密钥。

### 代码规范

- **TypeScript** — 严格模式，避免使用 `any`
- **React** — 函数组件 + Hooks，不使用类组件
- **样式** — Tailwind CSS 4 + CSS 自定义属性，颜色不用内联样式
- **CSS 命名空间** — 按功能前缀：`landing-`、`settings-`、`setup-banner`
- **导入** — 使用 `@/*` 路径别名
- **Lint** — 提交前运行 `npm run lint`

### 分支策略

| 分支 | 用途 |
|------|------|
| `main` | 稳定发布版 |
| `dev` | 开发集成 |
| `feature/*` | 新功能 |
| `fix/*` | Bug 修复 |
| `docs/*` | 文档更新 |

### PR 流程

1. Fork 仓库，从 `dev` 创建分支
2. 提交清晰的、原子化的 commit
3. 确保 `npm run lint` 和 `npm run build` 通过
4. 运行 `npm run test:unit` 确认测试通过
5. 向 `dev` 提交 PR，填写清晰的描述
6. 完整填写 PR 模板

### Issue 规范

- **Bug 报告** — 使用 Bug 报告模板，包含复现步骤
- **功能请求** — 使用功能请求模板，说明使用场景
- 创建新 Issue 前请先搜索已有 Issue

### 测试

```bash
npm run test:unit    # 单元测试 (vitest)
npm run dev &        # 先启动开发服务器
npm test             # 集成测试
```
