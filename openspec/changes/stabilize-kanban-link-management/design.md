## Context

The kanban store currently persists mirrored relationship fields on both sides of several link flows: `Task.linkedNoteIds` mirrors `Note.relatedTaskId`, and `SubTask.linkedNoteId` / `linkedBlockId` mirror `Block.linkedBoardId` / `linkedTaskId` / `linkedSubTaskId`. Today many of those mirrors are maintained by UI components through manual paired updates, which makes the behavior easy to drift and hard to test.

The current link dialogs are also implemented as separate narrow modal flows (`LinkTaskDialog`, `LinkNoteDialog`, `LinkBlockDialog`, `LinkSubTaskDialog`) with duplicated selection logic and almost no preview context. The repo already contains a `Sheet` primitive that can support a larger, more informative management surface without changing persisted data.

At the same time, current automated Vitest coverage is small and should be easy to move into a dedicated tests area, but there are also non-Vitest debug scripts named `test.ts` that must remain outside the Vitest discovery path.

## Goals / Non-Goals

**Goals:**
- Keep the current persisted kanban snapshot shape unchanged.
- Remove UI-owned manual double writes for current single-link flows by introducing store-owned canonical write commands.
- Replace fragmented link dialogs with a shared side-sheet interaction pattern that shows current selection and lightweight previews.
- Move Vitest-based automated tests into a dedicated test folder without reclassifying debug scripts as tests.

**Non-Goals:**
- Flatten task, subtask, or board storage.
- Introduce true multi-link persistence between tasks, notes, blocks, and subtasks.
- Redesign cloud sync payloads, Prisma snapshots, or MCP schemas.
- Rework every kanban editor surface; this change only covers the current link-management entry points.

## Decisions

### 1. Keep mirrored fields, but centralize writes in the store
We will keep the existing mirrored fields so CloudSync, MCP helpers, and persisted snapshots remain compatible. Instead of letting UI components call `updateNote`, `setLinkedNoteIds`, `linkSubTask`, and `linkBlock` in ad-hoc combinations, we will add store-level commands that own the full write sequence.

Rationale:
- Avoids a data migration.
- Contains link consistency rules in one place.
- Preserves existing read paths while reducing drift risk.

Alternatives considered:
- **Make one side canonical and derive the other at read time**: rejected for this phase because too many current call sites and helper APIs read mirrored fields directly.
- **Change to a dedicated link table**: rejected for this phase because it changes persistence shape and broadens scope beyond the agreed boundary.

### 2. Use a shared link-management Sheet instead of separate narrow dialogs
We will introduce a reusable side-sheet pattern for link management. Each flow can still tailor the selector options it shows, but the layout will be shared: header, current link summary, searchable/selectable targets, optional preview, and footer actions.

Rationale:
- Gives enough space for previews and future expansion toward multi-link workflows.
- Reduces duplicated dialog logic.
- Keeps the UI direction compatible with later richer linking without forcing the data model change now.

Alternatives considered:
- **Keep dialogs and just improve styling**: rejected because it does not solve the cramped interaction model or duplication.
- **Jump directly to a full multi-column relationship manager**: rejected because current single-link data shape would not justify the added complexity.

### 3. Migrate only Vitest tests into the dedicated test folder
We will move Vitest-discovered automated tests into a dedicated folder (for example `tests/vitest/...`) and keep ad-hoc debug scripts outside that tree.

Rationale:
- Clarifies what is runner-owned versus manually executed.
- Keeps the current debug scripts from being accidentally swept into automation.

Alternatives considered:
- **Move every file named `test.ts` into one folder**: rejected because it conflates automation with debug scripts and would worsen signal quality.

## Risks / Trade-offs

- **[Risk] Existing UI code may still call low-level setters directly** → Mitigation: update current link entry points to use the new canonical store commands and keep the old low-level actions internal-only by convention.
- **[Risk] Mirrored fields can still drift if future code bypasses the canonical commands** → Mitigation: add regression tests around store commands and document the canonical APIs in the change artifacts.
- **[Risk] A shared Sheet can feel heavier than a simple dialog** → Mitigation: keep the first version focused on current-link summary, selection, and preview only, avoiding multi-step complexity.
- **[Risk] Test relocation can break imports or runner discovery** → Mitigation: keep alias-based imports, update Vitest include patterns if needed, and run the full Vitest command after migration.

## Migration Plan

1. Add canonical store actions for note-task and block-task-subtask linking while keeping existing data fields.
2. Repoint current UI link entry points to those canonical actions.
3. Introduce the shared Sheet-based link manager and swap it into existing link surfaces.
4. Move Vitest tests into the dedicated test folder and confirm discovery still works.
5. Run lint and Vitest.

Rollback is straightforward because there is no persisted data shape change: UI components can be switched back to the existing dialogs and store callers can revert to prior action usage.

## Open Questions

- Whether the first Sheet version should include search inputs for all entities or only where current lists are already large enough to justify it.
- Whether to immediately deprecate the older dialog components after replacement or keep them temporarily as thin wrappers around the Sheet.