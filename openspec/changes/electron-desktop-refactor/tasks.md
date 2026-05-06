## 1. 项目脚手架搭建 (Electron + Vite + React)

- [ ] 1.1 在 `desktop/` 目录初始化 Electron + Vite + React 项目骨架（`electron-vite` 或手动配置 `electron-builder` + `vite`）
- [ ] 1.2 配置项目目录结构：`main/`（主进程）、`renderer/`（渲染进程）、`preload/`（预加载脚本）、`shared/`（共享类型）
- [ ] 1.3 配置 TypeScript：`tsconfig.json` 分离主进程和渲染进程的编译目标
- [ ] 1.4 配置 electron-builder：`electron-builder.yml`，包含 Windows NSIS 和 macOS DMG 打包配置
- [ ] 1.5 配置 `preload.ts`：使用 `contextBridge` 暴露安全的 IPC API（`window.electronAPI`）
- [ ] 1.6 实现主进程入口 `main/index.ts`：创建 BrowserWindow、加载 Vite dev server（开发）或本地 HTML（生产）
- [ ] 1.7 实现单实例锁（`app.requestSingleInstanceLock()`）
- [ ] 1.8 配置开发脚本：`pnpm dev` 同时启动 Vite 和 Electron，支持 HMR
- [ ] 1.9 验证：运行 `pnpm dev` 能打开 Electron 窗口并显示 React Hello World

## 2. 设计系统迁移 (stitch → React + Tailwind)

- [ ] 2.1 从 stitch `code.html` 和 `DESIGN.md` 提取设计 Token，配置 `tailwind.config.ts` 主题扩展（colors、typography、spacing、borderRadius）
- [ ] 2.2 配置全局字体引入：Manrope（display/headlines）+ Inter（body）+ Material Symbols Outlined
- [ ] 2.3 创建基础 UI 组件：`Button`（Primary / Tertiary）、`Input`（invisible style）、`Card`
- [ ] 2.4 创建布局组件：`AppShell`（整体框架）、`Sidebar`（导航栏）、`ContentArea`（主内容区）
- [ ] 2.5 创建 `NoteList` 组件：笔记列表，遵循 No-Line Rule（无分割线，使用垂直间距和背景色层次）
- [ ] 2.6 创建 `TaskBoard` 组件：看板视图，支持列布局（To Do / In Progress / Done），复用 `@dnd-kit` 拖拽
- [ ] 2.7 创建 `NoteEditor` 组件：笔记编辑器区域，使用 Cursor Pillar 聚焦指示器
- [ ] 2.8 创建 `FloatingActionButton` 组件：FAB 按钮，主色渐变 + 圆形
- [ ] 2.9 实现交互状态：hover 背景过渡、press 缩放（98%）、focus 指示器
- [ ] 2.10 验证：在 Electron 中加载完整布局，对照 stitch 原型视觉一致

## 3. 本地 SQLite 数据层

- [ ] 3.1 安装 `better-sqlite3`，配置 `electron-rebuild` 确保 native addon 与 Electron 版本兼容
- [ ] 3.2 设计 SQLite schema（DDL）：`workspaces`, `missions`, `boards`, `tasks`, `subtasks`, `notes`, `note_blocks`, `conversations`, `messages`, `settings`, `sync_meta`
- [ ] 3.3 实现数据库初始化模块 `main/database/init.ts`：首次启动创建 DB 文件、执行建表迁移
- [ ] 3.4 实现迁移系统：基于版本号的增量迁移脚本管理（`migrations/` 目录）
- [ ] 3.5 实现 DAO 层 `main/database/dao/`：为每张表提供类型安全的 CRUD 方法
- [ ] 3.6 实现事务支持：`dao.transaction()` 包装器
- [ ] 3.7 注册 IPC handlers：`db:query`、`db:mutate`、`db:transaction`
- [ ] 3.8 验证：通过 IPC 从渲染进程创建一条 Note 并读取回来

## 4. Zustand Store 适配

- [ ] 4.1 从现有 `src/store/` 复制 Zustand store 定义（kanban, notes, chatbot）
- [ ] 4.2 创建 SQLite persist middleware：替换 `localStorage` persist 为 IPC → SQLite 读写
- [ ] 4.3 实现 store hydration：应用启动时从 SQLite 加载初始数据到 Zustand
- [ ] 4.4 实现 store 变更监听：mutation 后 500ms 内通过 IPC 写回 SQLite（debounced）
- [ ] 4.5 适配 `ZustandRehydrate` 组件：改用 SQLite hydration 状态控制 UI 渲染
- [ ] 4.6 验证：创建/编辑笔记 → 重启应用 → 数据持久化正确

## 5. 核心业务组件迁移

- [ ] 5.1 迁移路由：从 Next.js App Router 改为 `react-router-dom`，配置主路由（Main/Work/Workspaces/Login/Settings）
- [ ] 5.2 迁移 `WorkSpace` 组件：工作区管理
- [ ] 5.3 迁移 `Mission` 组件：任务集管理
- [ ] 5.4 迁移 `Board` + `BoardItem` + `Task` 组件：看板 + 拖拽
- [ ] 5.5 迁移 `Note` 组件：笔记编辑器（CodeMirror 集成）
- [ ] 5.6 迁移 `ChatBot` 组件：ChatBotWindow + ChatPanel
- [ ] 5.7 迁移 `items/` 对话框组件：CreateDialog, DeleteDialog, LinkBlockDialog 等
- [ ] 5.8 迁移 `settings/` 组件：AgentSettings 等设置面板
- [ ] 5.9 移除 Next.js 特有代码：`next/link`, `next/router`, `next/image`, `useSearchParams` 等替换为对应方案
- [ ] 5.10 验证：所有页面可导航，核心 CRUD 操作（创建/编辑/删除笔记、任务）工作正常

## 6. Node.js 后端服务嵌入

- [ ] 6.1 迁移 `LLMService`：从 API Route 改为主进程 IPC handler，支持流式响应（IPC event stream）
- [ ] 6.2 迁移 `Agent_LLM` + ReActAgent：移入主进程，通过 IPC 暴露 `llm:chat` 和 `llm:stream`
- [ ] 6.3 迁移 MCP bridge：作为主进程子模块或 child_process 启动
- [ ] 6.4 迁移 `CodeExecutor`：沙箱代码执行服务
- [ ] 6.5 迁移 `MemoryManager` + `EmbeddingService`：向量嵌入和记忆管理（云端 pgvector 保留，本地可选 fallback）
- [ ] 6.6 实现安全配置管理：API Keys 使用 Electron `safeStorage` 加密存储
- [ ] 6.7 实现环境配置加载：从 app data 目录的 `config.json` 读取配置，fallback 到环境变量
- [ ] 6.8 验证：在 ChatBot 中发送消息 → LLM 流式响应正常显示

## 7. 云端同步引擎

- [ ] 7.1 配置 Prisma Client 在 Electron 主进程中运行：设置正确的 `binaryTargets`，测试连接云端 PostgreSQL
- [ ] 7.2 实现同步元数据表 `sync_meta`：记录每条记录的 `localUpdatedAt`、`cloudUpdatedAt`、`syncStatus`
- [ ] 7.3 实现上行同步：扫描 `localUpdatedAt > cloudUpdatedAt` 的记录，批量 upsert 到云端
- [ ] 7.4 实现下行同步：查询云端 `updatedAt > localUpdatedAt` 的记录，批量更新本地 SQLite
- [ ] 7.5 实现 Last-Write-Wins 冲突解决逻辑
- [ ] 7.6 实现网络状态检测：`navigator.onLine` + 定时 ping，触发自动同步
- [ ] 7.7 实现同步状态 IPC：`sync:status`、`sync:push`、`sync:pull`
- [ ] 7.8 创建同步状态 UI 指示器组件：syncing / synced / error 状态显示
- [ ] 7.9 实现认证流程：Electron 内嵌 OAuth 或 token-based 登录，登录后启用同步
- [ ] 7.10 实现首次数据迁移工具：新设备登录时从云端全量拉取数据填充本地 SQLite
- [ ] 7.11 验证：断网操作 → 联网后自动同步 → 另一端可见变更

## 8. Mini Dialog (全局 AI 对话框)

- [ ] 8.1 创建独立 BrowserWindow 配置：frameless、transparent、alwaysOnTop、600x400
- [ ] 8.2 实现全局快捷键注册：`Shift+Alt+Space`（`globalShortcut.register`）
- [ ] 8.3 实现窗口 toggle 逻辑：显示/隐藏切换，显示时居中偏上定位
- [ ] 8.4 实现 blur 自动隐藏：窗口失焦时自动隐藏
- [ ] 8.5 创建 Mini Dialog React 页面：毛玻璃背景 + 输入框 + 消息列表
- [ ] 8.6 应用 Digital Sanctuary Glassmorphism 样式：surface 70% opacity + backdrop-filter blur(12px)
- [ ] 8.7 实现 AI 对话功能：输入框 → IPC 调用 LLM → 流式渲染响应
- [ ] 8.8 实现 Escape 键关闭、Enter 发送、自动聚焦
- [ ] 8.9 实现会话管理：隐藏后再显示清空上下文
- [ ] 8.10 验证：在任意应用中按 Shift+Alt+Space → 弹出对话框 → 发送消息 → 收到 AI 回复

## 9. 桌面原生能力

- [ ] 9.1 实现系统托盘：图标 + 右键菜单（Show Window / Quick Chat / Quit）
- [ ] 9.2 实现关闭到托盘：主窗口关闭 → 最小化到托盘而非退出
- [ ] 9.3 实现窗口状态持久化：记住窗口位置/大小/最大化状态
- [ ] 9.4 配置自动更新：`electron-updater` + GitHub Releases（或自建更新服务器）
- [ ] 9.5 验证：关闭窗口 → 托盘可见 → 重新打开 → 窗口位置恢复

## 10. 打包与发布

- [ ] 10.1 配置 electron-builder 生产构建：asar 打包、代码签名（可选）
- [ ] 10.2 处理 native addon 打包：`better-sqlite3` + `electron-rebuild` 在 CI 环境的构建脚本
- [ ] 10.3 生成 Windows NSIS 安装包，验证安装/卸载流程
- [ ] 10.4 配置 CI/CD：GitHub Actions 自动构建和发布
- [ ] 10.5 验证：从安装包安装 → 启动 → 所有功能正常 → 自动更新检测正常
