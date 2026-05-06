---
name: multi_agent_code_orchestrator
description: >
  多Agent协作完成代码架构设计、实现、测试与验收的完整流水线。
  使用场景：需要跨多个文件进行功能开发、重构、无障碍修复、UI交互完善、
  模块打通时（需求复杂、涉及多个组件/API/Store/DB）。
  状态机流转：PLAN → IMPLEMENT → TEST → REVIEW，评审不通过则 REPLAN。
  触发词：架构设计、多模块、多组件、流水线、验收、重构、联调、打通。
argument-hint: '描述需要完成的功能或改造目标（例如：完善设置页面并打通对话侧边栏）'
---

# 多Agent代码编排（Multi-Agent Code Orchestrator）

## 何时使用

- 任务跨越 **3个以上文件** 或 **2个以上模块**
- 需要同时处理**前端交互 + 后端逻辑 + 数据层**
- 存在**依赖关系复杂**的多步骤开发
- 需要**质量验收**确保零编译错误与功能完整性
- 需要**并行加速**：多个独立子任务同时推进

---

## 角色定义

### 🏛️ Architect（系统架构师）
- 分析现有代码结构，设计文件/模块边界
- 定义每个组件的职责与数据流
- **禁止**直接写代码
- 输出：`Architecture Plan`（见[模板](./references/architect-template.md)）

### 👨‍💻 Developer（程序员）
- 严格按照 Architecture Plan 实现
- 不得擅自修改架构；发现问题须上报 Architect
- 输出：`Implementation Changes`（见[模板](./references/developer-template.md)）

### 🧪 Tester（测试员）
- 生成正常/边界/异常三类测试用例
- 强制检查：UI可用性、loading/error状态、状态同步
- 输出：`Test Report`（见[模板](./references/tester-template.md)）

### 🔍 Reviewer（验收员）
- 综合评审架构合规性、测试通过情况、代码可维护性
- 不通过必须给出**具体**修改建议，不得模糊描述
- 输出：`Review Result`（见[模板](./references/reviewer-template.md)）

---

## 状态机流程

```
PLAN → IMPLEMENT → TEST → REVIEW
                              │
                    review != 通过
                              ↓
                           REPLAN
                              │
                          (循环直到通过)
```

### 各状态执行规则

| 状态 | 执行Agent | 输入 | 输出 | 准入条件 |
|------|-----------|------|------|----------|
| PLAN | Architect | codebase_context, task_description | architecture_plan | 任务开始 |
| IMPLEMENT | Developer | architecture_plan | implementation_changes | PLAN完成 |
| TEST | Tester | implementation_changes | test_report | IMPLEMENT完成，无编译错误 |
| REVIEW | Reviewer | 全部前置输出 | review_result | TEST完成 |
| REPLAN | Architect | review_result + 问题列表 | 新architecture_plan | REVIEW不通过 |

---

## 执行流程（逐步操作指南）

### Step 0：信息收集
在启动前，先并行收集以下上下文：
- 读取所有相关文件（`read_file` 或 `semantic_search`）
- 理解现有API路由、Store、组件层次
- 记录当前编译错误（`get_errors`）

### Step 1：PLAN ─ 架构规划
发起 **Architect 子Agent**，输出格式严格遵守：

```markdown
# Architecture Plan

## 1. 文件结构调整
## 2. 组件职责划分
## 3. 数据流设计
## 4. 交互逻辑补全（列出所有按钮→对应行为）
## 5. 风险与冲突
## 6. 是否需要人工确认
```

若发现冲突 → 生成 `conflict_report.md` 并标注【需人工确认】后暂停。

### Step 2：IMPLEMENT ─ 并行实现
将 Architecture Plan 中的独立任务分配给**多个 Developer 子Agent并行执行**。

分组原则：
- 无依赖关系的模块 → 同批并行
- 有依赖的模块 → 串行，等待前置完成

每个 Developer 子Agent 结束后强制执行 `get_errors` 验证零编译错误。

### Step 3：TEST ─ 测试验证
发起 **Tester 子Agent**，必须覆盖：
- ✅ Happy Path（正常流程）
- ⚠️ Edge Cases（边界情况）
- ❌ Error Handling（异常情况）
- 🔍 UI可用性检查（无"只展示不执行"的元素）

### Step 4：REVIEW ─ 验收评审
发起 **Reviewer 子Agent**，评审维度：
1. 是否符合 Architecture Plan
2. 是否通过 Test Report
3. 是否存在冗余/潜在Bug
4. 中文文本一致性（界面文本必须为中文）

**结论只能为"通过"或"不通过"**，不通过必须列出具体问题。

### Step 5：REPLAN（条件触发）
若 REVIEW 结论为"不通过"：
- 发起新的 Architect 子Agent，携带 review_result 中的问题列表
- 只针对被标记问题的最小范围重新规划
- 再次进入 IMPLEMENT → TEST → REVIEW 循环

---

## 核心规则（强制执行）

| 规则 | 说明 |
|------|------|
| 🚫 禁止删除已有组件 | 除非提供完整替代方案，并在Architecture Plan中明确说明 |
| 🔗 UI必须有交互逻辑 | 所有按钮/Switch/Link都必须有绑定的onClick/onChange |
| 🛡️ 必须有错误处理 | 所有异步操作必须有try/catch，UI必须处理loading/error状态 |
| 📋 冲突必须上报 | 发现依赖冲突/架构歧义时生成conflict_report，暂停等待确认 |
| 🔒 Developer不绕过Architect | 实现前必须有Architecture Plan；发现问题先上报再继续 |
| ♻️ 必须形成闭环 | 每轮必须完整走完 PLAN→IMPLEMENT→TEST→REVIEW |
| 🈶 文本必须为中文 | 所有用户可见UI文本必须为中文（技术标识符除外） |

---

## 输出规范速查

所有输出模板详见参考文件：
- [Architect输出模板](./references/architect-template.md)
- [Developer输出模板](./references/developer-template.md)
- [Tester输出模板](./references/tester-template.md)
- [Reviewer输出模板](./references/reviewer-template.md)
- [冲突报告模板](./references/conflict-report-template.md)

---

## 质量检查清单（每轮结束前执行）

- [ ] 所有文件编译错误为零（`get_errors` 验证）
- [ ] 所有UI元素均有交互行为
- [ ] 所有异步操作均有错误处理
- [ ] 所有用户可见文本为中文
- [ ] 未删除已有组件（除非有替代方案）
- [ ] Test Report 覆盖三类用例
- [ ] Review Result 给出明确结论（通过/不通过）
