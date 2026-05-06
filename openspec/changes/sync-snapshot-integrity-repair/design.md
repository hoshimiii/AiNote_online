## Context

当前同步架构是“客户端生成完整 snapshot → `/api/sync` 原样 upsert → 其他客户端整包拉取”的 Last-Write-Wins 模型。该模型实现简单，但它默认所有客户端都能稳定产出合法 snapshot；一旦某个客户端删除 workspace 或 mission 时未级联清理，脏关系就会被完整复制到云端并持续传播。

当前已确认的具体问题：
- `AiNote_online/src/store/kanban/index.ts` 在 `deleteWorkSpace`、`deleteMission`、`deleteBoard` 上只删除当前层级，未保证级联删除和排序清理。
- `AiNote_online/src/components/auth/CloudSync.tsx` 直接把 kanban store 的当前数据和 `_chatbot` 一起上传到 `/api/sync`，只校验 shape，不校验父子引用完整性。
- `AiNote_online/app/api/sync/route.ts` 直接落库存储客户端上传的 JSON，没有规范化、修复摘要或拒收策略。
- 桌面端 `desktop/src/shared/cloudSnapshot.ts` 现在会在 pull 时执行严格关系校验，因此云端历史脏快照会被暴露为同步失败。

约束条件：
- 仍然保持 snapshot 同步模式，不在本次变更中切换到增量同步。
- `_chatbot` 与 kanban 属于不同 store；本次只为 kanban 关系图建立完整性规则，聊天数据需独立透传。
- 线上已经存在脏快照，因此设计既要止血，也要提供历史数据修复路径。
- 桌面端必须避免把未确认安全的数据写入本地 SQLite。

## Goals / Non-Goals

**Goals:**
- 阻止在线端继续生成和上传关系断裂的 snapshot。
- 在服务端建立快照规范化边界，对可安全修复的数据进行剪枝修复，对不可安全修复的数据明确拒收。
- 让桌面端在收到部分非法 snapshot 时能够保留合法子集的可用性，同时禁止把非法实体写入本地持久化存储。
- 为修复结果提供结构化摘要，便于 UI 提示、日志记录和后续人工排障。
- 覆盖“在线端删除 → 上传 → 云端存储 → 桌面端拉取”的跨端回归测试。

**Non-Goals:**
- 不重构为 CRDT、事件流或增量同步协议。
- 不在本次变更中统一重写所有 Zustand store 结构。
- 不尝试对父节点归属不明确的实体做猜测性重建；无法安全推断时必须拒绝或丢弃。
- 不改变 `_chatbot` 的业务语义，只保证其不会阻塞 kanban 快照修复流程。

## Decisions

### 1. 以服务端规范化为最终权威，客户端止血为第一道防线

**Decision**：新增一个共享的 snapshot integrity/sanitizer 模块，供在线端 `CloudSync` 上传前和 `/api/sync` 落库前复用；服务端是最终权威，客户端是提前止血。

**Rationale**：
- 只靠客户端校验无法修复历史脏快照，也无法防止旧客户端继续上传非法数据。
- 只靠桌面端消费时修复会把“生产者错误”永久转嫁给消费者，并且无法阻止云端继续积累脏数据。
- 服务端统一规范化后，所有客户端都会看到同一个 canonical snapshot。

**Alternatives considered**：
- 只在在线端 `CloudSync` 做校验：旧快照和其他客户端仍可污染云端，放弃。
- 只在桌面端 pull 时修复：无法止血，也无法清理云端，放弃。

### 2. 在线端删除操作必须维护级联关系与排序索引

**Decision**：为 workspace、mission、board 删除流程建立明确的级联清理规则，并同步清理 `missionOrder`、`boardOrder` 以及下游引用字段。

**Rationale**：
- 当前脏快照根因来自 producer 端允许 orphan mission / board 长期存在。
- 上传时再修复只能降低伤害，不能替代 store 本身保持一致性。
- 级联删除是最直接、最可测试的防线，能在用户操作瞬间把状态维持在合法闭包内。

**Alternatives considered**：
- 保留现有删除语义，仅在上传时 scrub：用户本地状态依旧脏，后续 UI/功能仍可能异常，放弃。
- 删除时只清排序不清实体：无法防止 orphan data，放弃。

### 3. 服务端将修复结果分成“安全修复”和“拒绝应用”两类

**Decision**：服务端 sanitizer 需要输出结构化 `repairSummary`，并将问题分为两类：
- **Safe repair**：可通过删除孤儿实体、清理排序残留、去掉无效引用而得到合法 snapshot。
- **Unsafe / ambiguous**：无法安全推断父归属、根节点缺失导致多种解释并存、或 payload 结构不满足基本快照契约。

对于 safe repair，服务端保存修复后的 canonical snapshot，并在响应中返回修复摘要；对于 unsafe payload，服务端返回 4xx 和诊断信息，不更新云端快照。

**Rationale**：
- 当前问题中，“父节点已不存在”的 orphan mission / board 是可安全修复的：直接剪枝比猜测挂回某个父节点更可靠。
- 不是所有缺失关系都能安全修补；例如缺少 `WorkSpaceId` 且存在多个 workspace 时，推断会产生错误归属。
- 将修复摘要显式返回，便于桌面端和在线端向用户解释“发生了什么”。

**Alternatives considered**：
- 全部自动修复：会把不确定的数据静默改坏，放弃。
- 全部拒绝：历史账户将无法恢复，且无法消除已经产生的脏数据，放弃。

### 4. `_chatbot` 作为独立 payload 透传，不参与 kanban 引用修复

**Decision**：快照规范化只约束 kanban 字段（`workspaces`、`missions`、`boards`、`tasks`、`missionOrder`、`boardOrder` 等），`_chatbot` 作为独立块透传；若 `_chatbot` 结构本身非法，仅忽略该块，不影响 kanban 修复决策。

**Rationale**：
- `_chatbot` 来自另一个 Zustand store，没有 workspace/mission/board 的父子关系。
- 把聊天数据纳入 kanban 修复规则会耦合两个无关模块，增加回归风险。
- 用户已经确认 `_chatbot` 可能出现在 payload 中，因此设计需要明确其边界。

**Alternatives considered**：
- 把 `_chatbot` 一并纳入 snapshot 完整性图：收益低、复杂度高，放弃。
- 发现 `_chatbot` 异常就整包拒绝：会误伤 kanban 数据恢复，放弃。

### 5. 桌面端区分“可持久化快照”和“临时恢复视图”

**Decision**：桌面端 pull 逻辑新增两种处理结果：
- **Persistable snapshot**：来自 canonical/sanitized 后的合法 snapshot，可写入 SQLite 并触发正常 rehydrate。
- **Transient sanitized view**：若桌面端本地仍遇到包含非法实体的 payload（例如旧服务端、手工导入或修复摘要标记为 dropped entities），可以只对合法子集生成临时视图供当前会话恢复操作，但不得把原始非法 payload 或未确认的修复结果写入 SQLite。

同时，桌面端需要把“丢弃了哪些实体、为何未持久化”展示给用户。

**Rationale**：
- 用户明确要求“只接收合法数据；非法数据可以先接收不保存”。
- 当前桌面同步入口是 main process 写 SQLite；因此需要显式区分“可展示”和“可落库”。
- 即使服务端已修复，大版本过渡期仍可能遇到旧 payload；桌面端作为最后一道安全边界仍然需要兜底。

**Alternatives considered**：
- 继续严格失败：安全但可用性差，不满足恢复诉求。
- 本地自动修复后直接持久化：可能把未经确认的推断结果写死到 SQLite，放弃。

## Risks / Trade-offs

- **[风险] 服务端修复会裁剪掉用户看不见但仍存在的数据** → **缓解**：返回 `repairSummary`，记录被丢弃实体类型、数量和 ID 摘要，并在 UI 中明确提示。
- **[风险] 客户端和服务端使用不同修复规则导致结果不一致** → **缓解**：将 sanitizer 提炼为共享模块，至少复用同一套分类规则和测试用例。
- **[风险] 桌面端“临时视图不落库”会增加实现复杂度** → **缓解**：将其限定为 fallback 路径，主路径仍优先消费服务端 canonical snapshot。
- **[风险] 级联删除可能暴露旧 UI 对孤儿数据的隐性依赖** → **缓解**：为删除、排序和同步补充回归测试，并在实现阶段审查相关 selector。
- **[风险] `_chatbot` 透传可能掩盖其自身的数据问题** → **缓解**：单独记录聊天块结构异常，不阻塞 kanban 修复，但保留日志与告警。

## Migration Plan

1. 先在在线端引入 sanitizer 和级联删除逻辑，确保新产生的本地状态不会继续污染云端。
2. 更新 `/api/sync`：PUT 在保存前执行规范化；GET 在返回前对历史快照做相同规则的修复/拒绝，并附带 `repairSummary`。
3. 为历史云快照准备一次惰性修复路径：用户下一次 GET/PUT 命中时完成安全剪枝并回写 canonical 数据。
4. 更新桌面端同步入口，识别 `repairSummary` 与临时视图场景；只对 persistable snapshot 写 SQLite，对 fallback 场景仅进行会话级恢复和提示。
5. 发布后观察修复摘要与拒绝率；如异常高，再决定是否补充离线 repair 脚本。

**Rollback**：
- 若 sanitizer 误删范围过大，可临时关闭服务端 safe-repair 的写回，仅保留诊断与拒绝；客户端仍使用旧行为但不影响已有数据。
- 级联删除若引发明显 UI 回归，可回退到上传前 scrub 方案，但需保留服务端拒收防线。

## Open Questions

- 服务端返回的 `repairSummary` 是否需要包含完整 dropped IDs，还是只返回截断摘要并将全量详情写日志？
- 桌面端“临时恢复视图”是通过 main → renderer 的专用 IPC 发送，还是通过现有 rehydrate 通知链扩展一个 memory-only 通道？
- 在线端是否也需要把服务端 `repairSummary` 展示给当前登录用户，避免用户误以为数据“自动消失”？
