## 1. Test organization

- [x] 1.1 Move Vitest-based automated tests into a dedicated test folder and keep Vitest discovery limited to automated tests.
- [x] 1.2 Leave ad-hoc debug scripts outside the Vitest test tree and verify the test command still discovers the intended suite.

## 2. Canonical link write paths

- [x] 2.1 Add a store-owned action for note-task linking and unlinking that keeps `Note.relatedTaskId` and `Task.linkedNoteIds` synchronized.
- [x] 2.2 Add a store-owned action for block-task-subtask linking and unlinking that keeps block fields and subtask reverse-link fields synchronized.

## 3. Shared link-management UI

- [x] 3.1 Introduce a reusable Sheet-based link-management UI with current-link summary and lightweight previews.
- [x] 3.2 Replace the current note, task, block, and subtask link entry points to use the shared Sheet workflow and canonical store actions.

## 4. Validation

- [x] 4.1 Add or update regression tests covering canonical link writes and link clearing behavior.
- [x] 4.2 Run Vitest and lint for the touched files and confirm the change remains snapshot-compatible.
