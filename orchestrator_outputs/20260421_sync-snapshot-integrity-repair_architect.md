# Architecture Plan

- 在线端分三层收口：producer 删除止血、`/api/sync` canonical boundary、上传前本地 sanitize。
- 桌面端分两层兜底：strict import 先验证；失败时退回 transient legal subset，不写入 SQLite。
- `_chatbot` 作为独立 payload 透传，不参与 kanban 关系修复。
- repair summary 需要贯通 online API、web 提示、desktop 同步结果与 UI banner。
- 验证优先级：静态错误 → 单测 → 桌面构建 → 文档/任务回写 → desktop 单独发布。