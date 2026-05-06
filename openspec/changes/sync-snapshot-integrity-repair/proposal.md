## Why

当前云同步链路会持续产生并保存断链快照：在线端删除 workspace / mission 时不会级联清理子实体，`CloudSync` 又会把当前 Zustand 状态原样上传到 `/api/sync`，服务端也会直接落库。桌面端新增的关系校验因此开始拒绝这些历史和增量脏数据，导致用户拉取失败且问题会继续累积。

现在需要同时解决三件事：阻止新的非法快照继续写入云端、为已经存在的脏快照提供可控修复路径、以及让桌面端在遇到部分非法数据时只接收合法子集且不把非法实体落地持久化。

## What Changes

- 新增统一的云同步快照完整性能力，定义 workspace / mission / board / task / note 的父子引用约束，并要求在线端在删除、上传和存储三个入口都保持快照合法。
- 为在线端删除流程补充级联清理与 orphan scrub，确保删除 workspace 或 mission 后不会继续保留悬空的 mission、board、note、排序信息或关联字段。
- 为 `/api/sync` 引入快照规范化与修复摘要返回，使服务端能够拒绝不可安全修复的数据，并对可安全修复的历史快照进行剪枝后保存。
- 新增桌面端对部分非法云快照的降级处理：允许临时接收合法子集用于展示和恢复操作，但必须阻止非法实体写入本地持久化存储，并向用户显示修复/丢弃摘要。
- 补充跨端回归测试，覆盖“在线端删除 → 云端保存 → 桌面端拉取”的完整链路，验证脏快照不再持续产生。

## Capabilities

### New Capabilities
- `cloud-sync-integrity`: 定义和执行云同步快照的关系完整性、级联删除、上传校验、服务端安全修复与修复摘要输出。
- `desktop-invalid-snapshot-fallback`: 定义桌面端在遇到部分非法云快照时的临时接收、非法实体隔离、禁止持久化以及用户可见诊断行为。

### Modified Capabilities
<!-- 当前 openspec/specs 为空，本次无需修改既有 capability -->

## Impact

- 在线端 store：`AiNote_online/src/store/kanban/index.ts`
- 在线端同步副作用：`AiNote_online/src/components/auth/CloudSync.tsx`
- 在线端同步接口：`AiNote_online/app/api/sync/route.ts`
- 共享快照转换与校验：`desktop/src/shared/cloudSnapshot.ts`
- 桌面端同步应用入口：`desktop/src/main/services/SyncService.ts`
- 需要新增/更新跨端测试、脏快照修复测试与删除级联测试
