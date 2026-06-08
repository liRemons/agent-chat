# 前端开发者从 0 到 1 实现功能型 Agent 全栈技术方案

## 技术方案概述

作为前端开发者，从 0 到 1 实现一个具备完整能力的 Agent，完全可以在你熟悉的 JavaScript/TypeScript 技术栈内完成。为了以**最小成本**且采用**业界通用方案**落地，推荐采用 **Next.js (React) + LangChain.js + Vercel AI SDK** 的全栈架构。

本方案在基础对话能力之上，重点补全了**大模型安全接入、上下文压缩、边界守卫与规则引擎**等生产级必备模块。

---

## 🛠️ 核心技术栈选型

| 模块 | 推荐技术 | 选型理由 |
| ------ |------ |------ |
| **全栈框架** | Next.js (App Router) + React + TailwindCSS | 前端舒适区，轻松实现 SSR、API Routes 和流式渲染 |
| **Agent 编排** | **LangChain.js** (核心) + LangGraph | JS生态最成熟，完美支持 Planner、Memory、Tool Calling |
| **大模型层** | OpenAI (GPT-4o) / Claude 3.5 / DeepSeek | 推理能力与工具调用（Function Calling）最强的模型 |
| **对话交互** | **Vercel AI SDK** (`ai/react`) | 丝滑对接 React，内置流式输出（Streaming）和中间状态捕获 |
| **记忆 (Memory)** | 短期：ConversationBufferMemory长期：向量库 (Chroma/Pinecone) + RAG | 结合 LangChain 的记忆模块，低成本实现跨会话的持久化记忆 |
| **安全与规则** | 自定义 Interceptor + 确定性规则引擎 | 防止提示词注入、越权操作，保障 Agent 行为符合业务预期 |

---

## 🏗️ 核心功能模块实现方案

### 1. Memory (记忆系统) 与上下文压缩

#### 短期记忆与自动压缩

利用 LangChain 的 `ConversationSummaryMemory`。当对话轮数或 Token 数量超过设定阈值（如 4000 tokens）时，自动调用 LLM 对历史对话进行摘要压缩，只保留核心意图和结论，大幅降低 Token 消耗。

#### 长期记忆 (RAG)

针对私有知识库（如公司文档、产品手册），使用 Node.js 将文本分块并通过 Embedding API 存入轻量级向量数据库（开发阶段推荐本地运行的 **Chroma**）。检索时将相关片段拼接到 System Prompt 中。

### 2. 边界守卫 (Guardrails) 与安全接入

#### 后端代理模式 (方案二)

**绝对禁止**在前端暴露 API Key。必须在 Next.js 的 API Routes 中建立安全的后端代理层。所有的大模型请求均由后端转发，同时在此层加入鉴权逻辑（如校验用户的 Session/Token）。

#### 输入/输出拦截器 (Interceptor)

- **输入侧**：在请求发给 LLM 之前，先经过一层规则过滤，识别并拦截恶意的提示词注入（Prompt Injection）攻击
- **输出侧**：对 LLM 生成的内容进行 PII（个人敏感信息）扫描与脱敏，防止手机号、邮箱等隐私数据泄露

#### 工具沙箱化

对于高风险工具（如执行 Shell 命令、数据库写操作），必须将其运行在隔离的沙箱环境（如 Docker 容器或受限的 Serverless 函数）中，并严格限制其文件系统访问路径（工作空间隔离）。

### 3. Rule (规则引擎) 与 MCP/Skill

#### 确定性规则引擎

不完全依赖 LLM 做决策。引入一套基于优先级的白名单规则（如 P0-P3 风险分级）。例如：

- 查询类操作（P3）自动放行
- 测试环境重启（P2）工作时间自动放行
- 生产环境删除（P0）必须触发人工审批流

#### Skill (技能) 与 MCP

将内部业务 API 封装成标准的 Tool。引入 MCP (Model Context Protocol) 客户端，通过标准化的 JSON-RPC 协议连接外部数据源，让 Agent 像插拔 USB 一样灵活调用外部能力。

### 4. Planner (规划器) 与 Clarification (澄清)

#### ReAct 规划

利用 LangChain 的 `createReactAgent`，让 Agent 能够自动将复杂目标拆解为"思考 -> 行动 -> 观察"的循环。

#### 主动澄清机制

当用户指令模糊或缺少关键参数时，通过规则引擎判定后，强制 Agent 返回特定的结构化状态（如 `requires_clarification: true`），在前端触发交互式表单，引导用户补充信息。

---

## 💻 已生成的核心代码结构

本仓库已按方案生成可落地的 Next.js Agent 应用代码，核心文件如下：

- `app/api/session/route.ts`：创建服务端签名会话 Cookie，前端不传用户身份明文。
- `app/api/chat/route.ts`：统一承接对话请求，完成会话校验、输入拦截、Agent 执行、输出脱敏和流式文本响应。
- `lib/agent/runAgent.ts`：实现 LangChain 工具调用闭环，模型产生 Tool Call 后会执行工具并把 Tool Result 回灌给模型。
- `lib/agent/tools.ts`：集中注册 Agent Tool，并在执行前接入规则引擎和审计日志。
- `lib/agent/weather.ts`：通过 Open-Meteo 地理编码与天气接口获取实时天气数据。
- `lib/security/guardrails.ts`：实现输入侧 Prompt Injection 拦截与输出侧手机号、邮箱脱敏。
- `lib/security/rules.ts`：实现工具白名单、风险等级、角色权限与审批状态判定。
- `lib/server/session.ts`：实现 HMAC 签名会话，避免前端伪造用户身份。
- `components/ChatPanel.tsx`：实现聊天 UI、会话初始化、请求发送和流式文本读取。

---

## ✅ 已落地的生产化能力

### 1. 统一配置与密钥管理

- `OPENAI_API_KEY`、`AGENT_SESSION_SECRET` 只在服务端读取。
- `OPENAI_MODEL`、`CONTEXT_COMPRESSION_CHARACTER_THRESHOLD` 支持通过环境变量配置。
- `assertServerConfig()` 在请求入口校验必要环境变量。

### 2. 会话与多用户隔离

- `app/api/session/route.ts` 为每个浏览器会话生成独立 `userId`。
- `lib/server/session.ts` 使用 HMAC 签名 Cookie，避免前端伪造用户身份。
- 每次请求都带 `conversationId`，审计日志按 `userId + conversationId + requestId` 关联。

### 3. 上下文压缩

- `lib/agent/context.ts` 会统计历史消息长度。
- 超过阈值后，使用 LLM 压缩历史上下文，只保留用户目标、约束、关键结论和未解决问题。
- 压缩后的上下文会作为 `SystemMessage` 注入 Agent 执行链路。

### 4. 工具调用闭环

- `lib/agent/runAgent.ts` 支持模型产生 Tool Call、执行 Tool、回灌 Tool Result、再次调用模型生成最终答案。
- `lib/agent/weather.ts` 调用 Open-Meteo 的地理编码与天气接口，返回实时天气数据。

### 5. 安全守卫与规则引擎

- `lib/security/guardrails.ts` 在输入侧拦截 Prompt Injection 关键词，在输出侧脱敏手机号和邮箱。
- `lib/security/rules.ts` 对 Tool 做白名单、风险等级、角色权限和审批状态判断。
- `lib/agent/tools.ts` 在工具执行前强制执行规则引擎，并写入审计日志。

### 6. 可观测性与审计日志

- `lib/server/audit.ts` 统一输出结构化审计日志。
- 对话请求、工具策略判断、响应生成、异常都会记录 `requestId`、`userId` 和 `conversationId`。

---

## ⚠️ 关键注意事项

### 安全风险防范

1. **API Key 绝对不能暴露在前端**
2. **所有外部工具调用必须经过白名单验证**
3. **敏感操作必须有人工审批环节**
4. **输出内容必须进行 PII 脱敏处理**

### 性能优化落地

1. **上下文压缩阈值**：通过 `CONTEXT_COMPRESSION_CHARACTER_THRESHOLD` 控制。
2. **天气工具缓存**：Open-Meteo 请求使用 `revalidate: 300`，同一查询 5 分钟内复用缓存。
3. **响应控制**：`maxDuration` 与服务端错误响应避免请求无限等待。

### 扩展性设计

1. **插件化 Tool**：`createAgentTools()` 统一注册工具，新增 Tool 时接入同一套规则与审计链路。
2. **规则引擎配置**：`lib/security/rules.ts` 集中维护工具风险等级、角色权限和审批状态。
3. **审计扩展点**：`writeAuditLog()` 统一输出结构化日志，可直接对接日志平台。

---

## 📌 总结

这套技术方案完全基于前端开发者熟悉的 JS/TS 技术栈，采用业界成熟的开源框架，能够以最小成本实现一个具备完整生产级能力的 Agent 系统。通过后端代理、规则引擎、边界守卫等安全机制的设计，确保了系统的安全性、可控性和可扩展性。

作为前端开发者，你可以充分利用现有的 React 和 Node.js 技能，快速构建出一个企业级的 AI Agent 应用。记住，安全永远是第一位的，不要在前端暴露任何敏感的 API Key 或密钥信息。

