## Why

当前 AiNote 基于 Next.js 部署在 Vercel 上，存在以下核心问题：
1. **离线不可用**——用户断网后无法访问笔记，数据全部依赖云端 PostgreSQL
2. **响应延迟**——每次操作都经过网络往返，编辑体验不够流畅
3. **桌面集成缺失**——无法注册全局快捷键、系统托盘、本地文件系统访问等原生能力
4. **AI 交互效率低**——没有像 Claude Desktop 那样随时呼出的轻量对话框，必须切换到聊天页面

迁移到 Electron 桌面应用 + 本地 SQLite 存储 + 云端 Prisma 同步，可以同时解决离线可用性、操作延迟和桌面原生集成三大问题，并通过全局快捷键快速唤起 AI 对话框提升效率。

## What Changes

- **BREAKING** 移除 Next.js 框架和 Vercel 部署流水线，改用 Electron 作为应用容器
- 引入 Electron 主进程 + 渲染进程架构，前端继续使用 React（Vite 构建）
- **BREAKING** 本地持久化从 Zustand localStorage 迁移到 SQLite（通过 better-sqlite3）
- 云端数据库保留 PostgreSQL + Prisma ORM，仅用于同步和多端共享
- 实现离线优先（Offline-First）数据同步策略：本地 SQLite 为主，联网时增量同步到云端
- 引入全局快捷键 `Shift+Alt+Space` 呼出悬浮 AI 微型对话框（类似 Claude Desktop / Spotlight）
- 将 stitch 生成的 "Digital Sanctuary" UI 设计系统移植为 React 组件库，接入 Electron 渲染进程
- Node.js 后端逻辑（LLM 调用、代码执行、MCP bridge）移入 Electron 主进程或本地 Express 服务
- 适配系统托盘、窗口管理、自动更新等桌面原生能力

## Capabilities

### New Capabilities
- `electron-shell`: Electron 主进程/渲染进程架构、窗口管理、系统托盘、自动更新、IPC 通信
- `sqlite-local-storage`: 本地 SQLite 数据库 schema 设计、CRUD 操作层、Zustand store 适配
- `offline-sync`: 离线优先数据同步引擎——本地 SQLite ↔ 云端 PostgreSQL 增量同步、冲突解决策略
- `mini-dialog`: 全局快捷键 `Shift+Alt+Space` 唤起的悬浮 AI 对话框，独立窗口、毛玻璃效果
- `stitch-ui-migration`: 将 stitch HTML 原型的 "Digital Sanctuary" 设计系统迁移为 React + Tailwind 组件库
- `node-backend-embed`: 将现有 Next.js API Routes（LLM、MCP、auth、sync）改造为 Electron 内嵌 Node.js 服务

### Modified Capabilities
<!-- 无需修改现有 spec，所有能力均为新建 -->

## Impact

- **前端构建工具链**：Next.js → Vite + React，路由从文件路由改为 react-router
- **数据层**：Zustand persist(localStorage) → Zustand + SQLite adapter；Prisma 仅用于云端同步
- **后端**：Next.js API Routes → Electron 主进程 IPC handlers 或内嵌 Express/Fastify
- **部署**：Vercel → electron-builder 打包为 Windows/macOS 安装包
- **依赖新增**：electron, electron-builder, better-sqlite3, vite, @electron/remote 等
- **依赖移除**：next, next-auth（改用本地 session 或自建 auth 流程）
- **数据库迁移**：需提供 PostgreSQL → SQLite schema 映射脚本和首次数据导入工具
- **现有代码**：`src/components/`, `src/store/`, `src/services/` 大部分可复用；`app/` 目录下的 Next.js 路由和中间件需重写
