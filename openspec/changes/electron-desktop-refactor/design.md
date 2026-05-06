## Context

AiNote 当前是一个基于 Next.js 16 的全栈 Web 应用，部署在 Vercel 上，使用 PostgreSQL + Prisma 做数据持久化，Zustand + localStorage 做前端状态管理。UI 组件基于 Radix UI + Tailwind CSS，AI 交互通过 LangChain + OpenAI 实现。

现状的主要约束：
- 完全依赖网络：离线无法使用
- 所有数据存储在云端 PostgreSQL，本地仅有 Zustand 的 localStorage 快照
- 无桌面原生能力（快捷键、托盘、文件系统访问）
- 已有 stitch 生成的 "Digital Sanctuary" 设计系统原型（纯 HTML/Tailwind），需迁移为 React 组件

目标是将其重构为 Electron 桌面应用，保留核心业务逻辑，替换运行时和数据层。

## Goals / Non-Goals

**Goals:**
- 构建可离线使用的 Electron 桌面应用，支持 Windows（首要）和 macOS
- 本地数据使用 SQLite 存储，启动即可用，无需登录
- 联网时自动同步到云端 PostgreSQL（通过 Prisma），支持多端数据一致
- 全局快捷键 `Shift+Alt+Space` 呼出 AI 微型对话框
- 将 stitch 原型转化为可复用的 React 组件库
- 保留现有 LLM、MCP bridge、代码执行等 AI 能力

**Non-Goals:**
- 不做移动端适配（后续独立规划）
- 不做实时协作编辑（多端同步基于 Last-Write-Wins）
- 不重写 AI Agent 核心逻辑，仅调整调用入口
- 不支持 Linux（首版不做，后续可扩展）
- 不做自定义主题引擎（使用 Digital Sanctuary 单一设计语言）

## Decisions

### D1: Electron + Vite + React 架构

**选择**: Electron 28+ 作为桌面容器，Vite 作为前端构建工具，React 19 作为 UI 框架

**替代方案考虑**:
- Tauri：更轻量，但 Rust 后端对团队学习成本高，且 Node.js 生态兼容性不如 Electron
- NW.js：社区不活跃，工具链老旧
- Next.js + Electron：增加复杂度，SSR 在桌面场景无意义

**理由**: Electron 生态成熟，与现有 Node.js/React 技术栈完全兼容，可最大化复用现有代码。Vite 比 webpack 快 10x+，HMR 体验好。

### D2: better-sqlite3 作为本地存储引擎

**选择**: better-sqlite3（同步 API）+ 自定义轻量 ORM 层

**替代方案考虑**:
- sql.js (wasm)：性能弱于原生，不适合大数据量
- Prisma + SQLite：Prisma 的 SQLite 驱动在 Electron 中打包和运行有兼容性问题
- LowDB / NeDB：不是真正的 SQL 数据库，查询能力弱

**理由**: better-sqlite3 是 Node.js 生态中最快的 SQLite 绑定，同步 API 简化了主进程数据访问。通过自定义 DAO 层封装 SQL，保持类型安全。

### D3: 离线优先 + 增量同步策略

**选择**: 本地 SQLite 为主（Single Source of Truth），联网时基于 `updatedAt` 时间戳做增量同步

**同步策略**:
- 每条记录维护 `localUpdatedAt` 和 `cloudUpdatedAt` 字段
- 上行同步：本地 `localUpdatedAt > cloudUpdatedAt` 的记录推送到云端
- 下行同步：云端 `updatedAt > localUpdatedAt` 的记录拉取到本地
- 冲突解决：Last-Write-Wins（以时间戳较新者为准）
- 同步通过 Prisma Client 直连云端 PostgreSQL 或通过 REST API 中转

**替代方案考虑**:
- CRDTs：实现复杂，对笔记场景过度设计
- 全量快照同步：现有方案，数据量大时效率低

### D4: 进程架构

```
┌─────────────────────────────────────────────────┐
│                  Main Process                    │
│  ├─ SQLite (better-sqlite3)                     │
│  ├─ Sync Engine (Prisma → PostgreSQL)            │
│  ├─ LLM Service (LangChain/OpenAI)              │
│  ├─ MCP Bridge                                   │
│  ├─ Global Shortcut Manager                      │
│  └─ Tray / Auto-updater                         │
├─────────────────────────────────────────────────┤
│              Renderer Process (Vite)             │
│  ├─ React App (主窗口)                           │
│  │  ├─ Workspace / Board / Note / Mission       │
│  │  ├─ ChatBot Panel                            │
│  │  └─ Settings                                 │
│  └─ Mini Dialog Window (独立渲染进程)             │
│     └─ AI Quick Chat                            │
├─────────────────────────────────────────────────┤
│              IPC Bridge (contextBridge)           │
│  ├─ db:query / db:mutate                        │
│  ├─ sync:push / sync:pull / sync:status         │
│  ├─ llm:chat / llm:stream                       │
│  └─ app:minimize / app:quit / dialog:toggle     │
└─────────────────────────────────────────────────┘
```

### D5: Mini Dialog 设计

**选择**: 独立 BrowserWindow，无边框 + 毛玻璃背景，全局快捷键控制显示/隐藏

**行为**:
- `Shift+Alt+Space` 切换显示状态
- 窗口居中偏上（类似 Spotlight/Alfred 位置）
- 尺寸约 600x400px，可拖拽但不可调整大小
- 输入框自动聚焦，回车发送，支持流式响应
- 点击窗口外区域自动隐藏
- 使用 Digital Sanctuary 的 Glassmorphism 风格

### D6: stitch UI 迁移策略

**选择**: 从 stitch HTML 中提取设计 token（色彩、排版、间距）和组件结构，重建为 React 函数组件 + Tailwind CSS

**迁移范围**:
- 设计 Token → `tailwind.config.ts` 主题扩展（已在 stitch 原型的 tailwind.config 中定义）
- 布局结构 → React 组件：Sidebar, NoteList, TaskBoard, NoteEditor
- 交互模式 → Framer Motion 动画（复用现有依赖）
- 图标 → Material Symbols Outlined（保持 stitch 原型一致）

## Risks / Trade-offs

- **[原生模块打包]** better-sqlite3 是 C++ addon，需要 electron-rebuild → 在 CI 中配置 rebuild 脚本
- **[包体积]** Electron 基础约 150MB → 使用 electron-builder 的 asar + 压缩优化，预计安装包 ~80MB
- **[同步冲突]** LWW 可能丢失并发编辑 → 首版可接受，后续可引入操作日志回溯
- **[Prisma 兼容性]** Prisma Client 在 Electron 主进程中运行需要正确配置 binary targets → 测试验证
- **[认证变化]** 移除 next-auth 后需要自建登录流程 → 使用 Electron 内嵌 OAuth 或 token-based 认证
- **[代码迁移量]** `app/` 目录下约 15 个路由文件需要重写 → 优先迁移核心页面，非核心功能后续补齐

## Migration Plan

1. **Phase 0 - 脚手架**: 搭建 Electron + Vite + React 项目骨架，配置 electron-builder
2. **Phase 1 - UI 迁移**: 将 stitch 设计系统转化为 React 组件，搭建主界面框架
3. **Phase 2 - 数据层**: 实现 SQLite schema + DAO 层，适配 Zustand store
4. **Phase 3 - 业务迁移**: 逐步将 Note/Board/Mission/ChatBot 等业务组件接入
5. **Phase 4 - AI 集成**: LLM/MCP/Agent 服务迁移到主进程
6. **Phase 5 - 同步引擎**: 实现离线同步机制
7. **Phase 6 - Mini Dialog**: 全局快捷键 + 悬浮对话框
8. **Phase 7 - 打包发布**: electron-builder 配置、自动更新、安装包

**回滚策略**: 原有 Next.js Web 版保持可用，Electron 版作为独立项目并行开发，不影响线上服务。

## Open Questions

- 云端同步是否继续使用现有 PostgreSQL 实例，还是切换到新的后端 API 服务？
- 是否需要保留 Web 版作为轻量访问入口（PWA 模式）？
- 自动更新使用 electron-updater + GitHub Releases 还是自建更新服务器？
- 向量嵌入（pgvector）功能是否迁移到本地（使用 SQLite 的 vec0 扩展），还是仅在云端保留？
