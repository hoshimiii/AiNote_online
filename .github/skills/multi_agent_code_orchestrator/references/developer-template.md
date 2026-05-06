# Implementation Changes 输出模板

> 由 **Developer 子Agent** 填写。实现前必须已收到 Architecture Plan。

---

## 前置检查

- [ ] 已阅读并理解 Architecture Plan
- [ ] 无逻辑不通或需求不清的问题（若有，已上报 Architect）
- [ ] 明确本次分配的文件范围

---

## 修改文件清单

| 文件 | 操作类型 | 说明 |
|------|----------|------|
| `src/components/xxx.tsx` | 修改 | 添加 DialogDescription，修复无障碍警告 |
| `src/actions/xxx-actions.ts` | 修改 | 新增 toggleXxx Server Action |
| `src/stores/chat-store.ts` | 修改 | 添加 loadConversations action |

---

## 关键修改说明

### 修改1：`xxx.tsx` — 添加 DialogDescription

```tsx
// 修改前
<DialogHeader>
  <DialogTitle>添加工作区</DialogTitle>
</DialogHeader>

// 修改后（添加 DialogDescription 消除无障碍警告）
<DialogHeader>
  <DialogTitle>添加工作区</DialogTitle>
  <DialogDescription>
    填写工作区名称和根路径，Agent 的文件操作将限定在此路径内。
  </DialogDescription>
</DialogHeader>
```

### 修改2：`xxx-actions.ts` — 新增 Server Action

```ts
export async function toggleXxx(id: string, enabled: boolean): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  
  await db.update(xxxTable).set({ enabled }).where(eq(xxxTable.id, id));
  revalidatePath("/settings");
}
```

---

## 编译验证

> 实现完成后必须运行 `get_errors`，结果如下：

| 文件 | 编译状态 |
|------|----------|
| `src/components/xxx.tsx` | ✅ 无错误 |
| `src/actions/xxx-actions.ts` | ✅ 无错误 |

---

## 上报问题（若有）

> 若发现 Architecture Plan 中存在问题，在此记录并上报 Architect，**停止实现**。

- **问题描述**：……
- **影响范围**：……
- **建议方案**：……
