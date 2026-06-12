# Agent Chat

一个基于 **Next.js App Router + React + Ant Design + LangChain.js** 的本地 Agent Chat 示例项目。

项目包含聊天会话、模型配置、本地记忆、服务端会话签名、上下文压缩、工具调用、安全守卫和审计日志等能力。

## 技术栈

- **框架**：Next.js App Router、React、TypeScript
- **UI**：Ant Design、Less Modules
- **Agent**：LangChain.js、OpenAI Compatible API
- **消息渲染**：react-markdown、remark-gfm
- **校验**：zod
- **部署**：Next.js standalone、PM2、自定义 HTTPS 启动脚本

## 本地开发

### 1. 安装依赖

```bash
yarn install
```

### 2. 配置服务端会话密钥

本地开发需要创建 `.env.local`：

```env
AGENT_SESSION_SECRET=请替换为随机长字符串
```

`AGENT_SESSION_SECRET` 用于签名浏览器会话 Cookie。它是服务端运行时变量，不要提交到 Git。

### 3. 启动开发服务

```bash
yarn dev
```

项目使用 `.module.less`，并在 `next.config.ts` 中配置了 webpack 的 `less-loader`，所以 `dev` 和 `build` 脚本都显式使用 `--webpack`，避免 Next.js 16 默认 Turbopack 与 webpack 配置冲突。

## 常用命令

```bash
yarn dev          # 本地开发
yarn build        # standalone 构建并复制静态资源
yarn start        # Next.js start
yarn lint         # ESLint 检查
yarn pm2:start    # 使用 PM2 启动自定义 HTTPS 服务
yarn pm2:restart  # 重启 PM2 进程
yarn pm2:stop     # 停止 PM2 进程
yarn pm2:logs     # 查看 PM2 日志
```

## 核心目录

```text
app/
  api/
    chat/route.ts       # 对话接口：会话校验、输入守卫、Agent 执行、输出脱敏
    session/route.ts    # 创建服务端签名会话 Cookie
  memories/page.tsx     # 浏览器本地记忆 / 常用提示词管理页
  layout.tsx            # Next.js 根布局，接入 Ant Design Registry
  page.tsx              # 聊天首页
  providers.tsx         # Ant Design App、ConfigProvider 等全局 Provider
components/
  ChatPanel.tsx         # 聊天页状态编排
  ConfirmDialog.tsx     # 通用确认弹窗
  chat/                 # 聊天页拆分组件、样式、类型和本地存储工具
lib/
  agent/                # Agent 上下文、工具和执行流程
  security/             # 输入守卫、输出脱敏、工具规则引擎
  server/               # 服务端配置、会话签名、审计日志
```

## 主要功能

### 聊天会话

- 支持多会话创建、切换、重命名和删除。
- 会话历史保存在当前浏览器 `localStorage`。
- 首次进入页面会调用 `/api/session` 创建匿名签名会话 Cookie。

### 模型配置

- `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL` 由用户在前端配置弹窗填写。
- 配置只保存在当前浏览器 `localStorage`。
- 每次聊天请求会随请求体提交给服务端，服务端不会持久化用户模型密钥。

### 记忆中心

- `/memories` 页面用于管理记忆和常用提示词。
- 当前实现保存在浏览器 `localStorage`，不会写入服务端文件系统。
- 聊天请求会读取本地记忆，并作为上下文提交给 Agent。

### Agent 执行

- `lib/agent/context.ts` 会根据历史长度进行上下文压缩。
- `lib/agent/runAgent.ts` 支持模型工具调用闭环。
- `lib/agent/tools.ts` 当前注册了城市经纬度查询工具。
- `lib/agent/weather.ts` 使用 Open-Meteo 地理编码接口获取城市坐标。

### 安全与审计

- `lib/security/guardrails.ts` 会拦截常见 Prompt Injection，并对手机号、邮箱做输出脱敏。
- `lib/security/rules.ts` 对工具调用执行白名单和风险等级判断。
- `lib/server/audit.ts` 输出结构化审计日志，包含 `requestId`、`userId`、`conversationId` 等字段。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AGENT_SESSION_SECRET` | 是 | 服务端会话 Cookie 签名密钥 |
| `AGENT_REQUEST_TIMEOUT_MS` | 否 | Agent 请求超时时间，默认 `30000` |
| `OPENAI_TIMEOUT_MS` | 否 | 模型请求超时时间，默认 `20000` |
| `WEATHER_REQUEST_TIMEOUT_MS` | 否 | 天气工具请求超时时间，默认 `8000` |
| `CONTEXT_COMPRESSION_CHARACTER_THRESHOLD` | 否 | 上下文压缩字符阈值，默认 `4000` |

## 部署说明

### standalone 构建

```bash
yarn build
```

构建后会执行 `copy-assets.js`，把 `.next/static` 和 `public` 复制到 standalone 目录。

### PM2 HTTPS 启动

```bash
yarn pm2:start
```

PM2 使用 `ecosystem.config.cjs`，入口为 `agent-chat-server.js`。

`agent-chat-server.js` 会读取项目根目录下的 `a.key` 和 `a.pem` 作为 HTTPS 证书。生产环境请替换为真实证书，并通过安全方式注入 `AGENT_SESSION_SECRET`。

## 清理说明

本项目已移除以下过期或未使用内容：

- `app/api/settings/route.ts`：旧模型配置接口，当前前端不再调用，模型配置只保存在浏览器。
- `.eslintrc.json`：旧 ESLint 配置，当前使用 `eslint.config.mjs`。
- 旧的 `*.module.css` 样式文件：样式已迁移到 `*.module.less`。

## 注意事项

- 不要提交 `.env.local` 或任何真实密钥。
- 不要在前端硬编码模型 API Key。
- `.module.less` 依赖 `less` 和 `less-loader`，并通过 `next.config.ts` 接入 webpack。
- Next.js 16 默认启用 Turbopack；本项目因 Less Modules 配置需要显式使用 `--webpack`。
