# AiNote 📝

一款 AI 驱动的在线知识管理与笔记应用，融合看板任务管理、富文本块编辑、代码块编辑与 AI 对话记忆，帮助你高效组织、沉淀和检索知识。

---

## ✨ 核心功能

### 🗂️ 层级化工作区
按 **工作区 → Mission → Board → Task / Subtask → Note** 五层结构组织内容，清晰分隔不同项目或学习主题。支持拖拽排序（dnd-kit），一键重命名/删除。

### 📄 块编辑器（Block Editor）
笔记由多种「块」组成，目前支持：

| 块类型 | 说明 |
|---|---|
| `markdown` | 支持 KaTeX 数学公式、GFM 语法渲染 |
| `code` | 语法高亮（CodeMirror），可编辑、保存代码 |

### ▶️ 代码块
代码块保留编辑、语法高亮和保存功能。当前版本未配置隔离执行服务，因此运行按钮显示“执行暂不可用”，`/api/execute` 对已登录用户返回 503，`run_code` 工具返回明确的不可用结果。恢复执行前需要提供与 Web 服务的文件、环境变量和网络权限隔离的执行环境。

### 🤖 AI 对话助手
内置 ChatBot 面板，可连接使用公共 IP 的 OpenAI 兼容服务。服务端代理、摘要和向量请求共用目标校验：解析全部 DNS 结果并将连接固定到已验证的公共地址，保留原域名的 Host/TLS 校验，拒绝 URL 凭据和重定向。私网、回环、链路本地及特殊用途地址不可作为服务端模型目标；本地模型暂不支持通过该服务访问。请求正文上限 2 MiB、读取时限 10 秒，DNS 解析时限 5 秒；上游响应上限 32 MiB，连接空闲超时 30 秒、上游请求总时限 120 秒。具备：
- **流式输出**（SSE）
- **向量记忆（RAG）**：历史对话自动压缩并存入 pgvector，回答时语义检索相关记忆注入上下文
- **笔记 RAG**：将 Note 块内容向量化，AI 可检索你的笔记回答问题

### ☁️ 云端同步
登录后，工作区状态通过「最后写入者胜（LWW）」策略同步到 PostgreSQL。本地工作区、聊天记录和模型配置按账号分开保存，访客数据单独保留。切换账号时先清空内存，再恢复对应账号的数据；旧请求、定时上传和模型工具调用会失效。同步及记忆请求携带发起账号标识，服务端与当前会话核对后再读写。

旧版 `workspace-storage`、`chatbot-storage` 没有账号归属信息，升级后保留原值，并在页面提供“导出旧版本地数据”。它们不会自动并入当前账号或上传。请自行确认导出内容归属后恢复需要的笔记；导出文件可能包含旧 API Key。

### 🔌 MCP Bridge
提供一个独立的 MCP（Model Context Protocol）桥接服务器（`mcp-bridge/`），可被 Cursor / Copilot 等 AI IDE 接入，通过工具调用直接在 AiNote 创建 Mission、Board、Task、Note，实现 **AI 笔记自动化工作流**。

MCP 密钥使用 `ainote_v2.<账号ID>.<64位十六进制secret>` 格式。认证只按账号 ID 查询一条记录并比较一次 bcrypt 散列，每个服务进程最多同时处理 4 次认证；部署入口仍需按实际负载配置限流。

旧密钥的数据库散列无需迁移。在已登录的设置页查看账号前缀，去掉旧密钥开头的 `ainote_`（若有），将剩余 64 位 secret 接在该前缀之后，更新 Bridge 的 `AINOTE_API_KEY`。未带账号前缀的旧格式会收到明确的迁移提示。格式迁移保留原 secret；已泄露的密钥需要在设置页重新生成，旧密钥才会失效。

编辑器 MCP 配置通过 `${env:AINOTE_API_KEY}`、`${env:VERCEL_API_URL}` 读取环境变量。请在本机或 Bridge 的未跟踪 `.env` 配置实际值。当前文件移除凭据不代表历史副本已清理或旧密钥已撤销；历史密钥与公开副本仍需另行处理。


---

## 🛠️ 技术栈

| 层次 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router) + React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 + shadcn/ui |
| 状态管理 | Zustand 5（持久化到 localStorage）|
| 数据库 | PostgreSQL + Prisma 6（ORM）|
| 向量搜索 | pgvector（余弦距离语义检索）|
| 认证 | NextAuth v5（Beta）|
| AI SDK | Vercel AI SDK + LangChain |
| 动画 | Framer Motion |
| 拖拽 | dnd-kit |
| 代码编辑器 | CodeMirror 6 |
| MCP | @modelcontextprotocol/sdk |

---

## 📈 首屏性能观测

项目现在内置了一个轻量的 Web Vitals 首屏观测面板：

- 采集指标：`FCP` 与 `LCP`
- 首屏参考值：优先使用 `LCP`，在 `LCP` 还未产出前回退到 `FCP`
- 接入方式：根布局中的独立客户端监测组件，不影响其余服务端渲染结构

### 如何查看

- 开发环境：运行 `pnpm dev` 后，打开页面会自动显示右下角调试面板。
- 生产环境：在页面 URL 后追加 `?vitals=1`，即可临时显示同一块面板。

### 编程式访问

- 当前快照：`window.__AINOTE_WEB_VITALS__`
- 订阅更新：

```ts
window.addEventListener("ainote:web-vitals", (event) => {
    console.log(event.detail)
})
```

这为后续接入自建 analytics API、埋点平台或可视化 dashboard 留出了扩展点。

---

## 🚀 快速开始
### 方法一
### 前置依赖

- Node.js ≥ 18
- pnpm
- PostgreSQL（含 pgvector 扩展）

### 1. 克隆并安装依赖

```bash
git clone https://github.com/hoshimiii/AiNote_online.git
cd AiNote_online
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，填写以下关键字段：

```env
# NextAuth 加密密钥（随机生成 32 字节）
NEXTAUTH_SECRET=your_generated_secret
NEXTAUTH_URL=http://localhost:3000

# PostgreSQL 连接字符串（需安装 pgvector 扩展）
DATABASE_URL=postgresql://user:password@localhost:5432/ainote
```

### 3. 初始化数据库

```bash
# 安装 pgvector 扩展（在 psql 中执行）
# CREATE EXTENSION IF NOT EXISTS vector;

pnpm dlx prisma migrate dev
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)，注册账号后即可使用。

### 方法二

    访问[vercel](https://ai-note-online-jyn5.vercel.app/)上部署好的内容

    或者fork到自己仓库中在vercel部署
---

## 📁 项目结构

```
AiNote_online/
├── app/                    # Next.js App Router
│   ├── api/                # API 路由
│   │   ├── auth/           # NextAuth 认证
│   │   ├── execute/        # 代码在线执行
│   │   ├── llm/            # LLM 流式接口
│   │   ├── mcp/            # MCP 工具调用接口
│   │   ├── memory/         # 对话记忆存取
│   │   └── sync/           # 云端快照同步
│   ├── login/              # 登录页
│   └── pages/              # 应用页面（工作区、看板、笔记等）
├── src/
│   ├── components/         # UI 组件
│   │   ├── Board/          # 看板组件
│   │   ├── ChatBot/        # AI 对话面板
│   │   ├── Mission/        # Mission 组件
│   │   ├── Note/           # 笔记块编辑器
│   │   └── WorkSpace/      # 工作区组件
│   ├── services/           # 核心服务
│   │   ├── CodeExecutor.ts # 多语言代码执行
│   │   ├── EmbeddingService.ts # 向量化服务
│   │   ├── LLMService.ts   # LLM 流式调用
│   │   └── MemoryManager.ts # 对话记忆管理
│   └── store/              # Zustand 状态管理
│       └── kanban/         # 工作区/看板状态
├── mcp-bridge/             # MCP 桥接服务器（独立进程）
│   ├── bridge-server.ts    # MCP Server 入口
│   └── skills/             # Copilot/Cursor Skill 提示词
└── prisma/
    └── schema.prisma       # 数据库模型定义
```

---

## 🔌 MCP Bridge 配置

MCP Bridge 允许 AI IDE（Cursor、GitHub Copilot 等）通过 MCP 协议直接操作 AiNote。

```bash
cd mcp-bridge
cp .env.example .env    # 填写 AINOTE_API_URL 和 MCP_API_KEY
pnpm start
```

在 Cursor / Copilot 中添加 MCP 服务器地址后，即可使用以下工具：

| 工具 | 说明 |
|---|---|
| `list_missions` | 列出所有 Mission |
| `create_mission` | 创建 Mission |
| `create_board` | 创建 Board |
| `create_task` / `create_subtask` | 创建任务 |
| `create_note` | 创建笔记 |
| `create_study_note` | 一键创建完整学习笔记层级 |
| `get_note` | 读取笔记内容 |
| `list_notes` | 列出笔记 |

---

## 📄 License

本项目仅供学习与个人使用。
