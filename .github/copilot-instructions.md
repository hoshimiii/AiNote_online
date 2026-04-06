# AiNote Copilot 全局指引

## 模型选择原则

- **MCP 工具调用（上传笔记、整理错题）**：优先使用 **不计费 / 免费额度模型**（如 `claude-3-5-haiku`、`gpt-4o-mini`、`gemini-flash` 等低消耗模型），保留高级模型用于复杂推理任务。
- 若对话中未明确指定模型，默认选择当前可用的最低消耗模型完成 MCP 写入操作。

## MCP 工具可用列表

读操作：`list_missions` · `list_boards` · `list_tasks` · `list_notes` · `get_note` · `get_mission_snapshot`  
写操作：`create_mission` · `create_board` · `create_task` · `create_subtask` · `create_note`  
复合：`create_study_note`

## Block 格式规范

```json
{ "blockType": "markdown", "blockContent": "Markdown 正文..." }
```
