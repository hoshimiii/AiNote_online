# `src/lib` 目录文件说明

> 本目录存放 Next.js 应用的**服务端核心工具模块**，包括认证、数据库、MCP 工具分发、Server Actions 等。

---

## 文件总览

| 文件 | 职责 |
|---|---|
| `auth.config.ts` | Edge Runtime 兼容的 Auth.js **基础配置**（纯 JWT 校验，无 DB 依赖） |
| `auth.ts` | 完整 Auth.js 配置（含 Credentials Provider、Prisma 用户查询、JWT/Session 回调） |
| `actions.ts` | Next.js **Server Actions**：登录、注册、登出、MCP API Key 生成 |
| `prisma.ts` | Prisma Client **单例**工厂（开发环境防 HMR 多实例，生产用 Prisma Accelerate） |
| `mcp-helpers.ts` | MCP 工具**分发中心**：所有 MCP tool 的服务端实现与 Snapshot 读写逻辑 |
| `utils.ts` | 通用工具函数（目前仅 `cn()` — Tailwind 样式合并） |

---

## 各文件详细说明

### `auth.config.ts` — Edge 兼容基础配置

**运行环境**：Edge Runtime（`middleware.ts` 调用）

**为什么要独立一个文件？**

Next.js 中间件运行在 Vercel Edge Runtime，**不支持** Node.js 原生模块（如 `bcrypt` 的 C++ binding、Prisma 的 TCP 连接）。因此需要把"只用纯 JS 验证 JWT"的路由保护逻辑放在这里，与需要 Prisma/bcrypt 的登录逻辑分离。

**主要内容**：
- 自定义登录页路径（`/login`）
- `authorized` 回调：每次路由访问时被 `middleware.ts` 调用，实现以下规则：
  - 已登录访问 `/login` → 重定向到 `/pages/workspacesPage`
  - 未登录访问非公开 API → 返回 `401 JSON`（而非 HTML 重定向）
  - 未登录访问受保护页面 → 重定向到登录页

---

### `auth.ts` — 完整 Auth.js 配置（Node.js Runtime）

**运行环境**：Node.js（Server Components、API Routes、Server Actions）

**主要内容**：
- 引入 `auth.config.ts` 的基础配置并扩展
- **Credentials Provider**：处理邮箱/密码登录，`authorize` 流程：
  1. Zod 校验输入格式
  2. Prisma 查询用户
  3. `bcrypt.compare` 验证密码哈希
  4. 返回用户对象写入 JWT
- **JWT Strategy**：Session 以加密 Cookie 存储，无需数据库存会话（适合 Vercel 无状态部署）
- **jwt 回调**：首次登录时将 `userId` 写入 JWT token
- **session 回调**：将 `userId` 从 token 透传到 `session.user.id`，客户端可通过 `useSession()` 或 `auth()` 获取
- 导出 `auth`、`signIn`、`signOut`、`handlers` 供全项目使用

---

### `actions.ts` — Server Actions

**运行环境**：服务端（标记了 `"use server"`），客户端组件可直接调用

**为什么用 Server Actions 而非 fetch？**

不需要手写 `API route + fetch`，类型安全，且能正确捕获 Auth.js 内部的重定向异常（redirect 会抛出需要 rethrow 的特殊错误）。

**导出的函数**：

| 函数 | 说明 |
|---|---|
| `loginAction(email, password)` | 邮箱密码登录，成功后重定向至工作区页 |
| `registerAction(email, password, name?)` | 注册新用户（Zod 校验 + 查重 + bcrypt 哈希），成功后自动登录 |
| `logoutAction()` | 登出，重定向至 `/login` |
| `getMcpApiKeyStatus()` | 查询当前用户是否已生成 MCP API Key |
| `generateMcpApiKey()` | 生成新 MCP API Key（随机 32 字节 hex），返回明文 `ainote_xxx`，数据库存 bcrypt 哈希 |

**安全设计**：
- MCP API Key 采用与密码相同的 bcrypt 哈希存储，接口返回一次性明文
- 密码哈希使用 12 轮 salt（约 300ms/hash，抗暴力破解）

---

### `prisma.ts` — Prisma Client 单例

**为什么需要单例？**

Next.js 开发环境使用 HMR（热重载），每次保存文件 Node.js 模块都会重新加载。若直接 `new PrismaClient()`，每次 HMR 都会新建实例，迅速耗尽数据库连接池（默认 ~10 个连接）。

**解决方案**：
- 将实例挂在 `globalThis` 上，HMR 不会重置 `globalThis`，从而整个进程生命周期内只有一个实例
- 生产环境下每次请求是独立 Worker，直接创建即可

**Prisma Accelerate 说明**：
- 使用 `withAccelerate()` 扩展，当 `DATABASE_URL` 为 Prisma Accelerate URL 时（`prisma+postgres://`），所有查询会通过 Prisma 全球边缘网络代理到真实数据库，提升连接性能

---

### `mcp-helpers.ts` — MCP 工具分发中心

**职责**：`/api/mcp/route.ts` 在鉴权后将所有 MCP 工具调用转发到此文件的 `dispatch()` 函数。

**核心架构**：
- 所有数据存储在用户的 `workspaceSnapshot`（Prisma 表）中，以 JSON Snapshot 形式保存完整看板状态
- `readSnapshot(userId, fn)`：只读操作，取出 Snapshot 执行 `fn`
- `withSnapshot(userId, mutate)`：写操作，取出 → 修改 → 写回，保证原子性

**已实现的 MCP 工具**（对应 `dispatch` 的 `switch` 分支）：

| Tool | 说明 |
|---|---|
| `list_workspaces` | 返回用户所有工作区列表 |
| `list_missions` | 列出工作区（可选）下的所有 Mission，支持排序 |
| `list_boards` | 列出 Mission 下的所有 Board（按 boardOrder 排序） |
| `list_tasks` | 列出 Board 下的所有 Task |
| `list_notes` | 列出 Mission 下的所有 Note |
| `get_note` | 按 noteId 获取完整 Note（含 blocks） |
| `get_mission_snapshot` | 获取 Mission 的完整快照（boards + tasks + notes） |
| `create_mission` | 幂等创建 Mission（同名已有则复用） |
| `create_board` | 幂等创建 Board（同名已有则复用） |
| `create_task` | 在 Board 下新建 Task |
| `create_subtask` | 在 Task 下新建 SubTask |
| `create_note` | 在 Mission 下新建 Note（支持传入 blocks 数组） |
| `create_study_note` | 一次调用完成 Mission→Board→Task→SubTask→Note 整个链路的创建 |

**辅助函数**：
- `normalizeSnapshot(data)`：将历史数据补全为完整的 Snapshot 结构
- `ensureWorkspace(state, workspaceId)`：校验 workspaceId 合法性
- `findMissionByTitle / findBoardByTitle / findTaskByTitle`：按名称查找（大小写不敏感），用于幂等创建
- `parseBlocks(raw)`：将 MCP 传入的 blocks 参数转换为内部 Block 类型

---

### `utils.ts` — 通用工具

```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

组合 `clsx`（条件类名）和 `tailwind-merge`（去重 Tailwind 冲突类名），全项目所有 className 拼接都通过 `cn()` 完成。

---

## 模块依赖关系

```
middleware.ts
    └── auth.config.ts          (Edge Runtime)

app/api/auth/[...nextauth]/
app/api/mcp/route.ts
app/api/sync/route.ts
app/api/execute/route.ts
    └── auth.ts                 (Node.js Runtime)
        └── auth.config.ts
        └── prisma.ts

app/api/mcp/route.ts
    └── mcp-helpers.ts
        └── prisma.ts

src/components/**
    └── actions.ts              (Server Actions via RPC)
        └── auth.ts
        └── prisma.ts

src/components/ui/**
    └── utils.ts
```
