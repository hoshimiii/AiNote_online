# MCP Bridge 与 Cursor 配置（整理笔记）

## 架构

- Cursor → 本地 `mcp-bridge/bridge-server.ts`（stdio MCP）
- Bridge → `POST /api/mcp`，请求头 `Authorization: Bearer <完整密钥，含 ainote_ 前缀>`
- `app/api/mcp/route.ts`：用 bcrypt 比对 `User.mcpApiKey` 得到 `userId`，再 `mcp-helpers.dispatch`
- 数据存 `WorkspaceSnapshot.data`，与前端 `/api/sync` 是同一份快照（看板 + `_chatbot` 等）

## 鉴权与密钥

- 应用内 Agent 设置 →「MCP API Key」生成；明文只显示一次，库中存哈希
- 请求体：`{ "toolName": "...", "arguments": { ... } }`，不需要 email
- 密钥可自行用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 生成思路一致，但实际以应用内生成为准（前缀 `ainote_` + hex，校验时去掉前缀再 bcrypt）

## Vercel

- 需要：`DATABASE_URL`、`AUTH_SECRET`
- 不需要全局 `MCP_API_KEY`
- 部署需已执行含 `User.mcpApiKey` 的迁移（项目 `build` 里一般有 `prisma migrate deploy`）

## 环境变量分工

| 位置 | 用途 |
|------|------|
| Next `.env.local` | `DATABASE_URL`、`AUTH_SECRET` |
| `mcp-bridge/.env` | `AINOTE_API_KEY`、`VERCEL_API_URL` |

二者互不替代。`bridge-server` 用脚本目录下的 `.env`（代码里 `dotenv.config({ path: join(__dirname, ".env") })`），不依赖进程 cwd。

## pnpm 与 TypeScript

- `pnpm-workspace.yaml` 需包含 `mcp-bridge`，根目录执行 `pnpm install`，否则 `mcp-bridge/node_modules` 里没有 SDK，IDE 报「找不到模块」
- 根 `tsconfig.json` `exclude: ["mcp-bridge"]`，避免 Next 构建去类型检查子项目

## Cursor `mcp.json`（Windows 常见坑）

1. **`spawn tsx ENOENT`**：`tsx` 不在 Cursor 的 PATH 里 → 用 `npx` 调 `tsx`，不要用裸命令 `tsx`。
2. **`Cannot find module C:\Users\ADMIN\bridge-server.ts`**：相对路径 `bridge-server.ts` 在未生效的 cwd 下会解析错 → **`args` 里写 `bridge-server.ts` 的绝对路径**，例如 `E:\\codes\\AiNote\\AiNote_online\\mcp-bridge\\bridge-server.ts`。
3. 示例（按本机路径改）：

```json
{
  "mcpServers": {
    "bridge-server": {
      "command": "npx",
      "args": ["tsx", "E:\\codes\\AiNote\\AiNote_online\\mcp-bridge\\bridge-server.ts"]
    }
  }
}
```

若 `npx` 也 ENOENT，需保证 Node 安装时加入系统 PATH，或把 `command` 写成 `npx.cmd` 的绝对路径。

## 何时会调用 MCP 工具

- MCP 连接正常、对话模式支持工具时，只有你让 AI 做**与云端看板/笔记/任务相关**的事，模型才可能选工具（如 `list_missions`、`create_study_note`）；普通闲聊一般不会调用。

## 工具名（与 `bridge-server.ts` 注册一致）

- 读：`list_missions`、`list_boards`、`list_tasks`、`list_notes`、`get_note`、`get_mission_snapshot`
- 写：`create_mission`、`create_board`、`create_task`、`create_subtask`、`create_note`
- 复合：`create_study_note`

## 与前端数据结构一致

- Block 字段为 `blockContent`（兼容入参 `content` 的解析在服务端/helpers）
- `Task.linkedNoteIds` 为 `string`
- `missions` / `boards` 为 Record；Notes 挂在 Mission；Tasks 挂在 Board

## 传到云端（本仓库无法代你登录）

- 在浏览器打开已部署的 AiNote，**登录**，在某一 Mission 下**新建笔记**，把本文全文粘贴进 markdown 块，保存。
- 项目自带 CloudSync：登录后会自动与 `WorkspaceSnapshot` 同步；也可在能调用 MCP 的 Cursor 对话里说明 mission/board，让模型用 `create_note` / `create_study_note` 写入（需已知 `workspaceId`、`missionId` 等或让模型先 `list_*`）。
