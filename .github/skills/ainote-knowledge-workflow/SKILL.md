---
name: ainote-knowledge-workflow
description: "AiNote 云端知识管理工作流。USE FOR: 创建/整理笔记、错题解析、知识点整理、任务与笔记关联。USE WHEN: 用户要求整理知识点、写学习笔记、整理错题、创建任务看板、同步笔记到云端。COVERS: Mission/Board/Task/Subtask/Note 全链路 CRUD 与错题专用流程。"
---

# AiNote 知识管理工作流

## 总体原则（必须遵守）

1. **工具成功才可确认**：任何创建/修改操作必须调用工具并确认成功返回，工具未成功时**禁止**声称"已完成"。
2. **优先批量写入**：使用 `create_study_note`（一次建全链路 + 笔记）或 `create_note`（带完整 blocks 数组），避免逐块多次调用。
3. **错误即停止**：工具返回错误时，报告错误信息并给出下一步建议（重试/回退），绝不假装成功。
4. **先查后建**：对 Mission / Board 先用 `create_mission` / `create_board`（自带 find-or-create 语义），对 Task / Note 先用 `list_tasks` / `list_notes` 查找再决定是否新建。

---

## 可用 MCP 工具速查

| 工具 | 用途 | 关键参数 |
|------|------|----------|
| `list_missions` | 列出所有 Mission（获取 workspaceId） | `workspaceId?` |
| `create_mission` | **查找或创建** Mission | `workspaceId`, `title` |
| `create_board` | **查找或创建** Board | `missionId`, `title` |
| `list_boards` | 列出 Mission 下 Board | `missionId` |
| `create_task` | 在 Board 下创建 Task | `boardId`, `title` |
| `list_tasks` | 列出 Board 下 Task | `boardId` |
| `create_subtask` | 在 Task 下创建 Subtask | `boardId`, `taskId`, `title` |
| `create_note` | 在 Mission 下创建 Note（含 blocks） | `missionId`, `noteTitle`, `blocks[]` |
| `create_study_note` | **一次性创建全链路**（Mission→Board→Task→Subtask→Note+Blocks） | `workspaceId?`, `missionTitle`, `boardTitle`, `taskTitle`, `subtaskTitle`, `noteTitle`, `blocks[]` |
| `get_mission_snapshot` | 获取 Mission 完整快照 | `missionId` |
| `get_note` | 获取 Note 完整内容 | `noteId` |
| `list_notes` | 列出 Mission 下所有 Note | `missionId` |

> **注意**：当前无 `rewrite_note`、`update_block`、`link_subtask` 等工具。如需修改已有笔记或建立关联，使用 `create_study_note` 自动关联，或通过 `create_note` 新建替代笔记。

---

## 通用工作流（新增笔记/任务）

### 快速路径：使用 `create_study_note`（推荐）

当需要一次性创建 Mission → Board → Task → Subtask → Note 全链路时，优先使用此工具：

```
create_study_note({
  workspaceId: "<从 list_missions 获取>",
  missionTitle: "<Mission 名称>",
  boardTitle: "<Board 名称>",
  taskTitle: "<Task 名称>",
  subtaskTitle: "<Subtask 名称>",
  noteTitle: "<Note 标题>",
  blocks: [
    { blockType: "markdown", blockContent: "..." },
    { blockType: "code", blockContent: "..." }
  ]
})
```

此工具内置 find-or-create 逻辑，已存在的层级不会重复创建。**这是最推荐的方式**，一次调用完成所有操作。

### 分步路径：逐层构建

仅在以下情况使用分步路径：
- 需要在已有 Task 下追加多个 Subtask + Note
- 需要对中间层级做额外操作（如列出已有 Tasks 让用户选择）

```
步骤 1: list_missions() → 获取 workspaceId
步骤 2: create_mission(workspaceId, title) → 获取 missionId（find-or-create）
步骤 3: create_board(missionId, title) → 获取 boardId（find-or-create）
步骤 4: list_tasks(boardId) → 检查是否已有同名 Task
步骤 5: create_task(boardId, title) → 获取 taskId（仅在不存在时）
步骤 6: create_subtask(boardId, taskId, title) → 创建子任务
步骤 7: create_note(missionId, noteTitle, blocks) → 创建笔记（一次性传入所有 blocks）
步骤 8: list_notes(missionId) → 验证笔记已创建
```

---

## 错题/题目类笔记专用流程

### 流程顺序（严格遵守）

1. **确认层级归属**：检查/创建 Mission → Board → Task → Subtask
2. **创建笔记**：一次性写入所有 blocks
3. **验证结果**：确认创建成功后才反馈

### 笔记内容要求（每道题/知识点）

每道错题或知识点必须包含以下 blocks，按顺序排列：

| Block 序号 | blockType | 内容说明 |
|-----------|-----------|----------|
| 1 | `markdown` | **题目标题**（如 `## 题目 1：闭包与变量捕获`） |
| 2 | `markdown` | **题干**（完整题目描述） |
| 3 | `markdown` | **解答与解析**（详细步骤） |
| 4 | `markdown` | **点评 / 常见错误**（易错点分析） |
| 5 | `markdown` | **知识点总结**（核心概念提炼） |
| 6 | `code` | **代码示例**（可运行的实际使用代码） |
| 7 | `markdown` | **练习题**（2 道练习题，供巩固） |

### 示例：一次性创建错题笔记

```
create_study_note({
  workspaceId: "<workspaceId>",
  missionTitle: "JavaScript 基础",
  boardTitle: "错题本",
  taskTitle: "闭包相关错题",
  subtaskTitle: "整理：闭包与变量捕获",
  noteTitle: "闭包与变量捕获 - 错题解析",
  blocks: [
    { blockType: "markdown", blockContent: "## 题目：闭包中的循环变量\n\n以下代码输出什么？为什么？\n```js\nfor (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 100);\n}\n```" },
    { blockType: "markdown", blockContent: "## 解答\n\n输出 `3, 3, 3`。\n\n`var` 没有块级作用域，循环结束后 `i` 为 3，三个 setTimeout 回调共享同一个 `i`。\n\n### 修复方式\n1. 使用 `let` 替代 `var`\n2. 使用 IIFE 捕获当前 `i`" },
    { blockType: "markdown", blockContent: "## 常见错误\n\n- 误以为每次迭代会捕获当前 `i` 的值\n- 忽略 `var` 的函数作用域特性" },
    { blockType: "markdown", blockContent: "## 知识点总结\n\n- `var` 是函数作用域，`let` 是块级作用域\n- 闭包捕获的是变量引用而非值的快照\n- `setTimeout` 回调在循环完成后执行" },
    { blockType: "code", blockContent: "// 正确写法：使用 let\nfor (let i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 100);\n}\n// 输出: 0, 1, 2\n\n// 另一种写法：IIFE\nfor (var i = 0; i < 3; i++) {\n  ((j) => {\n    setTimeout(() => console.log(j), 100);\n  })(i);\n}" },
    { blockType: "markdown", blockContent: "## 练习题\n\n**练习 1**：以下代码的输出是什么？\n```js\nconst funcs = [];\nfor (var i = 0; i < 5; i++) {\n  funcs.push(() => i * 2);\n}\nconsole.log(funcs[2]());\n```\n\n**练习 2**：如何修改以下代码使其输出 `[0, 1, 2, 3, 4]`？\n```js\nconst results = [];\nfor (var i = 0; i < 5; i++) {\n  setTimeout(() => results.push(i), 0);\n}\n```" }
  ]
})
```

### 多道题目处理

若需整理多道题到同一 Task 下：
1. 为每道题分别调用 `create_study_note`，使用相同的 `missionTitle` / `boardTitle` / `taskTitle`，不同的 `subtaskTitle` 和 `noteTitle`
2. 已存在的 Mission / Board / Task 不会重复创建（find-or-create 语义）

---

## 命名规范

| 层级 | 风格 | 示例 |
|------|------|------|
| Mission | 主题化 | `react底层`、`算法题整理`、`JavaScript 基础` |
| Board | 功能化 | `构建与打包`、`错题本`、`Hooks 专题` |
| Task | 聚焦化 | `esbuild --bundle 研究整理`、`闭包相关错题` |
| Subtask | 动作化 | `整理：esbuild --bundle 的作用与内部过程` |
| Note 标题 | 描述化 | `<主题> - 知识整理`、`<主题> - 错题解析` |

---

## 错误处理规则

```
工具调用 → 成功？
  ├─ 是 → 继续下一步 / 向用户确认完成
  └─ 否 → 停止后续操作
           报告错误信息
           给出建议（重试 / 检查参数 / 回退）
           绝不宣称"已完成"
```

---

## 验证清单

每次执行完成后，对照此清单确认：

- [ ] 所有工具调用均返回成功
- [ ] Mission / Board / Task / Subtask / Note 层级完整
- [ ] 笔记包含所有必要 blocks（题目类：题干、解析、知识点、代码示例、练习题）
- [ ] 代码示例具有可运行性
- [ ] 练习题为 2 道（每个知识点）
- [ ] 向用户报告了创建项的位置与 ID
