---
mode: agent
model: auto
description: "将错题整理并同步到 AiNote 云端，每题独立 subtask+note，含知识点代码示例和练习题"
tools:
  - list_missions
  - list_boards
  - list_tasks
  - create_mission
  - create_board
  - create_task
  - create_subtask
  - create_note
---

# Skill：整理错题到云端

> **模型要求**：本 Skill 全程使用 **最低消耗/免费额度模型** 完成 MCP 工具调用，不消耗高级配额。仅在生成知识点讲解、代码示例、练习题等内容时允许使用更强模型。

---

## 阶段一：切分题目

若用户输入包含**多道题目**，首先将其逐题拆分，列出题目清单（序号 + 题干摘要），等待确认后再逐题处理。  
每道题独立走完下方完整流程，**不合并为同一 note**。

---

## 阶段二：检查/创建云端层级

> 每道题处理前执行，复用已有层级，避免重复创建。

### 2-1 Mission（科目/分类）

```
调用 list_missions
→ 找到与题目学科匹配的 mission（如"错题整理"、"数学"、"算法"）？
  是 → 记录 missionId，跳过创建
  否 → 调用 create_mission，missionTitle = "<学科名称>"
```

### 2-2 Board（章节/知识模块）

```
调用 list_boards（传 missionId）
→ 找到与题目章节匹配的 board？
  是 → 记录 boardId，跳过创建
  否 → 调用 create_board，title = "<章节名>"
```

### 2-3 Task（具体知识点）

```
调用 list_tasks（传 boardId）
→ 找到与本题知识点匹配的 task？
  是 → 记录 taskId，跳过创建
  否 → 调用 create_task，title = "<知识点名称>"
```

### 2-4 Subtask（单题条目）

```
调用 create_subtask（传 boardId + taskId）
title = "错题 #<序号>：<题干摘要，不超过20字>"
记录 subTaskId
```

---

## 阶段三：生成 Note 内容

每道题对应**一个 note**，note 下包含以下**四个独立 block**（按顺序）：

### Block 1 — 题目与解析

````markdown
blockType: "markdown"
blockContent:
## 题目

<完整题干>

## 我的作答

<用户的错误作答（若有）>

## 正确答案

<答案>

## 错误分析

<分析为什么会做错，指出思维误区>
````

### Block 2 — 知识点整理

````markdown
blockType: "markdown"
blockContent:
## 涉及知识点

<列出本题涉及的核心知识点，条目式>

### 知识点详解

<对每个知识点的原理说明，重点突出易错之处>
````

### Block 3 — 代码示例

````markdown
blockType: "markdown"
blockContent:
## 实际使用代码示例

> 以下代码演示上述知识点在实际场景中的应用

```<语言>
<可运行的代码示例，含注释>
```

**代码说明**：<简要说明代码演示了哪个知识点及其关键行为>
````

### Block 4 — 练习题

````markdown
blockType: "markdown"
blockContent:
## 同类练习题

**练习 1**

<练习题题干>

<details>
<summary>查看答案</summary>

<答案与简要解析>

</details>

---

**练习 2**

<练习题题干>

<details>
<summary>查看答案</summary>

<答案与简要解析>

</details>
````

---

## 阶段四：写入云端

调用 `create_note`：

```json
{
  "missionId": "<missionId>",
  "noteTitle": "错题 #<序号>：<题干摘要>",
  "blocks": [
    { "blockType": "markdown", "blockContent": "<Block1内容>" },
    { "blockType": "markdown", "blockContent": "<Block2内容>" },
    { "blockType": "markdown", "blockContent": "<Block3内容>" },
    { "blockType": "markdown", "blockContent": "<Block4内容>" }
  ]
}
```

---

## 阶段五：汇总输出

所有题目处理完毕后，输出摘要表格：

| 题号 | 题干摘要 | Mission | Board | Task | Subtask | noteId |
|------|----------|---------|-------|------|---------|--------|
| #1   | ...      | ...     | ...   | ...  | ...     | ...    |

---

## 注意事项

- Mission / Board / Task **能复用就复用**，不重复创建；只在找不到匹配项时新建。
- 多题时**逐题串行处理**，确保每题 subtask 独立。
- Block 3 代码语言根据题目自动判断（JS/TS/Python/Java 等）。
- Block 4 练习题难度应与原题相近，但题目内容不同。
