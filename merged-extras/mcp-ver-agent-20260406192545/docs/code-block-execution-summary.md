# Code Block Execution — 实施记录

## 概要
实现了在 `code` 类型的 Block 中运行代码的能力（支持 JavaScript / TypeScript / Python / C++ / Java），执行结果会保存在 Block 中并展示在 UI 下方。新增后端执行 API 和执行抽象层，前端新增运行按钮、语言选择与输出终端样式。

## 主要改动文件

- `src/store/kanban/index.ts`
  - `Block` 类型新增字段：`language?`, `executionOutput?`, `executionError?`, `executionExitCode?`, `executionTimestamp?`
  - Zustand persist 版本升级到 `6`，添加迁移逻辑（为历史 code block 加入默认 language）

- `src/services/CodeExecutor.ts`
  - 新增 `CodeExecutor` 接口与 `LocalExecutor` 实现（临时目录执行、10s 超时、64KB 限制、输出截断）

- `app/api/execute/route.ts`
  - 新增 `POST /api/execute`，使用 `auth()` 校验 session，调用执行器并返回 `{ stdout, stderr, exitCode, duration }`。

- `src/components/Note/Block/index.tsx`
  - Code block UI：语言选择器、运行按钮（含 loading）、执行输出区（stdout / stderr / 退出码 / 时间戳 / 清除按钮）、CodeMirror 按语言高亮。

- `src/components/Note/index.tsx`
  - 创建 code block 时设置默认 `language: 'javascript'`，并通过 `onUpdateBlock` 回写执行结果。

- `src/agent/tools/codeExecution.ts`
  - 将执行能力封装为 agent 工具 `run_code`，方便在 agent 场景下调用执行器（输入 `{ code, language }`，返回 JSON 字符串）。

## 使用说明（开发/测试）

1. 本地环境要求：宿主机需安装对应运行环境：`node`、`python`、`g++`、`javac`；若缺少对应工具，API 会返回明确错误。
2. 在笔记中新建 Code Block，选择语言后写代码，点击“运行”按钮即可看到输出。
3. 超时与安全：代码最大 64KB；执行超时 10s；输出截断 256KB，避免无限输出。

示例（JavaScript）：
```javascript
console.log("hello world");
```

示例（Python）：
```python
print("hello world")
```

## 限制与后续改进

- 目前每个 Block 为独立执行环境，不共享变量或运行上下文。若需 notebook 风格（跨 cell 共享），建议引入持久化 executionContext 或服务器端 session REPL。
- 本地 `LocalExecutor` 依赖宿主机，生产环境（如 Vercel Serverless）不适合，推荐将执行任务转移到专用沙箱服务（Judge0/Piston 或 self-hosted container）以提高安全性与可控性。
- 可扩展：异步执行队列、WebSocket 实时输出、容器化沙箱、RBAC/配额限制。

## 工具（tools）说明

已将执行能力封装为 agent 工具：`run_code`。
- 参数: `{ code: string, language?: string }`
- 返回: `{"stdout": string, "stderr": string, "exitCode": number, "duration": number}`
- 文件位置: `src/agent/tools/codeExecution.ts`

## 验证用例

- 输入 `console.log("hello")` (javascript) → 输出 `hello`。
- 输入语法错误 → 返回 stderr，并显示为红色错误块。
- 输入无限循环 → 10s 后超时并返回超时提示。

## 实现时间与作者

- 实现时间: 2026-04-06
- 实现者: 自动化脚本 + Copilot
