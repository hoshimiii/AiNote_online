# Architecture Plan 输出模板

> 由 **Architect 子Agent** 填写。Developer 在收到此文档前不得开始实现。

---

## 1. 文件结构调整

> 说明哪些文件需要新增、修改或拆分，哪些保持不变。

| 操作 | 文件路径 | 原因 |
|------|----------|------|
| 修改 | `src/components/xxx.tsx` | 需补全交互逻辑 |
| 新增 | `src/actions/xxx-actions.ts` | 提取 Server Actions |
| 保持 | `src/stores/chat-store.ts` | 已满足需求 |

---

## 2. 组件职责划分

> 每个组件只有一个主要职责（单一职责原则）。

- **`XxxPanel`（Client Component）**
  - 职责：展示数据、触发用户交互
  - 数据来源：通过 props 接收（来自 Server Component）
  - 调用：Server Actions（写操作）

- **`XxxPage`（Server Component）**
  - 职责：并行查询 DB，将数据作为 props 传给子组件
  - 禁止：不包含任何客户端交互逻辑

- **`xxx-actions.ts`（Server Actions）**
  - 职责：写操作封装，调用 `revalidatePath` 触发重刷新
  - 禁止：不得在此文件处理 UI 状态

---

## 3. 数据流设计

```
用户操作
  ↓
Client Component（useTransition）
  ↓
Server Action（"use server"）
  ↓
DB（Drizzle ORM）
  ↓
revalidatePath("/xxx")
  ↓
Server Component 重新渲染
  ↓
新数据通过 props 传给 Client Component
```

或（Store 模式）：
```
用户点击按钮
  ↓
useChatStore.someAction()
  ↓
fetch("/api/xxx", { method: "POST", ... })
  ↓
Store 状态更新（set(...)）
  ↓
React 重渲染
```

---

## 4. 交互逻辑补全

> 列出所有 UI 元素及其对应行为（**禁止留白**）。

| UI 元素 | 位置 | 触发行为 | 实现方式 |
|---------|------|----------|----------|
| "新建对话"按钮 | `sidebar.tsx` | 调用 POST /api/conversations，跳转 `/chat?id=xxx` | `useTransition` + `router.push` |
| 工具 Switch | `tool-settings.tsx` | 调用 `toggleTool(name, enabled)` Server Action | `onCheckedChange` |
| 删除按钮 | `xxx-settings.tsx` | 调用对应 `deleteXxx(id)` Action | `startTransition` |

---

## 5. 风险与冲突

> 若存在以下情况，必须填写。无冲突则写"无"。

- **依赖冲突**：例如 A 模块依赖尚未实现的 B 接口
- **类型不兼容**：例如 DB 返回 `null`，但组件 props 期望 `string`
- **权限边界不清**：例如工具表无 userId 字段，需确认是否全局可操作
- **并行实现风险**：例如多个 Developer 同时修改同一文件

若发现冲突 → 另见 [conflict-report-template.md](./conflict-report-template.md)

---

## 6. 是否需要人工确认

- [ ] 是（需要暂停，等待确认后继续）
- [ ] 否（可直接进入 IMPLEMENT 阶段）

**确认项（若勾选"是"）**：
1. ……
