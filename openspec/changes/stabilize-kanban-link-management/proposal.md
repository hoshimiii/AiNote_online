## Why

The current kanban link flows spread relationship updates across UI components and store actions, which makes note-task and block-subtask links easy to drift out of sync. At the same time, the link dialogs are optimized for single-field selection and are already straining as the product grows, while the current Vitest coverage is mixed into feature folders instead of a dedicated test area.

## What Changes

- Consolidate Vitest-based automated tests into a dedicated test folder without moving ad-hoc debug scripts that only happen to be named `test.ts`.
- Add canonical store-level link commands for note-task and block-task-subtask updates so UI code no longer performs manual double writes.
- Introduce a shared right-side link management Sheet UI with selection, current-link summary, and lightweight previews for note, task, block, and subtask linking flows.
- Keep the persisted kanban snapshot shape unchanged for this change; task/board flattening and multi-link data model changes remain out of scope.

## Capabilities

### New Capabilities
- `kanban-link-management`: Manage kanban entity links through a consistent side-sheet workflow while keeping mirrored link fields synchronized through store-owned write paths.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/store/kanban/index.ts`, `src/components/Board/index.tsx`, `src/components/Board/Task.tsx`, `src/components/Note/index.tsx`, `src/components/items/Link*.tsx`, `vitest.config.ts`, and Vitest test files.
- Affected systems: local Zustand state, CloudSync payload consumers, MCP helper/tool callers that rely on current snapshot shape.
- Dependencies: reuse the existing `Sheet` UI primitive; no persisted schema change and no API contract change in this phase.
