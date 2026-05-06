## 1. Snapshot integrity boundary

- [x] 1.1 提炼共享的 snapshot sanitizer / validator 模块，统一输出 canonical snapshot、unsafe 错误和 `repairSummary`
- [x] 1.2 更新 `AiNote_online/app/api/sync/route.ts`，在 GET/PUT 前后执行规范化、拒绝 unsafe payload，并保持 `_chatbot` 透传不阻塞 kanban 修复
- [x] 1.3 为 `/api/sync` 增加测试，覆盖 safe orphan cleanup、ambiguous payload rejection 和 repair summary 返回

## 2. Online producer stop-the-bleed

- [x] 2.1 修复 `AiNote_online/src/store/kanban/index.ts` 的 workspace / mission / board 删除逻辑，级联清理子实体、排序索引和派生引用
- [x] 2.2 更新 `AiNote_online/src/components/auth/CloudSync.tsx`，在上传前应用 sanitizer 或校验结果，并在拉取时处理 repair summary
- [x] 2.3 增加在线端回归测试，覆盖“删除父节点后再次同步不会生成 orphan snapshot”以及 `_chatbot` 独立透传

## 3. Desktop fallback and persistence safety

- [x] 3.1 扩展 `desktop/src/shared/cloudSnapshot.ts` 与 `desktop/src/main/services/SyncService.ts`，区分 persistable snapshot 与 transient sanitized view
- [x] 3.2 更新桌面端 rehydrate / 错误提示链路，使合法子集可临时恢复，但原始非法 payload 不会写入 SQLite
- [x] 3.3 为桌面端增加测试，覆盖合法快照落库、部分非法快照仅临时恢复、不可安全修复快照被拒绝三种路径

## 4. End-to-end verification

- [ ] 4.1 执行跨端手工验证：在线端删除 workspace/mission → 触发同步 → 桌面端拉取并确认无断链错误
- [x] 4.2 记录 repair summary、拒绝场景和回滚开关，补充到调试文档与发布说明
