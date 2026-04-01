---
name: update-md2ainote
description: "将 xxx 目录下的 Markdown 笔记通过 MCP 工具同步到 AiNote 云端(新建或追加到指定 mission)，实现本地笔记的云端备份和管理。"
tools:
[ainote-mcp-server/create_mission, ainote-mcp-server/create_note, ainote-mcp-server/create_study_note, ainote-mcp-server/create_subtask, ainote-mcp-server/create_task, ainote-mcp-server/get_mission_snapshot, ainote-mcp-server/get_note, ainote-mcp-server/list_missions, ainote-mcp-server/list_notes, ainote-mcp-server/list_tasks]
---

# Skill：上传 docs 笔记到云端

> **模型要求**：本 Skill 全程使用 **最低消耗/免费额度模型** 完成 MCP 工具调用，不消耗高级配额。

## 执行步骤

### 1. 读取目标文件

读取用户指定的 `docs/` 目录下 Markdown 文件内容（若未指定则处理全部 `.md` 文件）。

### 2. 检查云端层级

调用 `list_missions` 获取 `workspaceId`，按以下规则匹配或新建：

```
list_missions → 找到匹配 missionTitle？
  是 → 取 missionId，继续
  否 → 调用 create_mission 新建
```

### 3. 选择上传方式

| 场景 | 工具 |
|------|------|
| mission/board/task 层级均不存在 | `create_study_note`（一次建全） |
| mission 已存在，只追加笔记 | `create_note`（传 missionId） |

**`create_study_note` 参数模板：**

```json
{
  "workspaceId": "<来自 list_missions 的 workSpaceId>",
  "missionTitle": "项目文档",
  "boardTitle": "docs",
  "taskTitle": "云端备份",
  "subtaskTitle": "笔记同步",
  "noteTitle": "<文件名>",
  "blocks": [{ "blockType": "markdown", "blockContent": "<文件全文>" }]
}
```

**`create_note` 参数模板：**

```json
{
  "missionId": "<missionId>",
  "noteTitle": "<文件名>",
  "blocks": [{ "blockType": "markdown", "blockContent": "<文件全文>" }]
}
```

### 4. 验证结果

调用 `list_notes`（传 `missionId`）确认新 noteId 存在，输出上传摘要表格。

---

## 网络受限说明

- 本地直连 Vercel 超时（国内封锁）→ 通过 Copilot/Cursor 内置 MCP 工具调用，走服务侧网络，无需本地网络可达。
- 本地网络正常时也可执行：`node scripts/push-docs-to-mcp.mjs`
