# AiNote 📝

一款 AI 驱动的在线知识管理与笔记应用，融合看板任务管理、富文本块编辑、代码在线执行与 AI 对话记忆，帮助你高效组织、沉淀和检索知识。

---

## ✨ 核心功能

### 🗂️ 层级化工作区
按 **工作区 → Mission → Board → Task / Subtask → Note** 五层结构组织内容，清晰分隔不同项目或学习主题。支持拖拽排序（dnd-kit），一键重命名/删除。

### 📄 块编辑器（Block Editor）
笔记由多种「块」组成，目前支持：

| 块类型 | 说明 |
|---|---|
| `markdown` | 支持 KaTeX 数学公式、GFM 语法渲染 |
| `code` | 语法高亮（CodeMirror），支持在线执行 |

### ▶️ 代码在线执行
在代码块中直接运行代码，无需切换终端。支持语言：

- JavaScript / TypeScript（via `tsx`）
- Python
- C++（via `g++`）
- Java（via `javac` + `java`）

执行结果（stdout / stderr / 退出码）实时展示在代码块下方。

### 🤖 AI 对话助手
内置 ChatBot 面板，支持任意兼容 OpenAI 接口的大模型。具备：
- **流式输出**（SSE）
- **向量记忆（RAG）**：历史对话自动压缩并存入 pgvector，回答时语义检索相关记忆注入上下文
- **笔记 RAG**：将 Note 块内容向量化，AI 可检索你的笔记回答问题

### ☁️ 云端同步
登录后，工作区状态自动通过「最后写入者胜（LWW）」策略同步到 PostgreSQL，跨设备无缝续写。

### 🔌 MCP Bridge
提供一个独立的 MCP（Model Context Protocol）桥接服务器（`mcp-bridge/`），可被 Cursor / Copilot 等 AI IDE 接入，通过工具调用直接在 AiNote 创建 Mission、Board、Task、Note，实现 **AI 笔记自动化工作流**。

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

## 🚀 快速开始

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
