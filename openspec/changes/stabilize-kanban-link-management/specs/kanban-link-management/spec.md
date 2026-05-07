## ADDED Requirements

### Requirement: Canonical link writes own mirrored single-link state
The system SHALL update mirrored kanban link fields through store-owned canonical commands rather than UI-managed paired writes.

#### Scenario: Linking a note to a new task clears the previous mirrored task link
- **WHEN** a note that is already linked to task A is linked to task B through the link-management flow
- **THEN** the store clears task A's mirrored note link field
- **AND** the store writes task B's mirrored note link field
- **AND** the store updates the note's related task field to task B

#### Scenario: Clearing a note-task link removes mirrored state from both sides
- **WHEN** a user removes the current task link from a note
- **THEN** the store clears the note's related task field
- **AND** the store clears the previously linked task's mirrored note field

#### Scenario: Linking a block to a task and subtask synchronizes both entities
- **WHEN** a block is linked to a task with an optional subtask through the link-management flow
- **THEN** the store updates the block's linked board, task, and subtask fields
- **AND** if a subtask is selected, the store updates that subtask's linked note and block fields to point back to the block
- **AND** any previously linked subtask owned by the block is cleared before the new link is written

### Requirement: Link management uses a shared side-sheet workflow
The system SHALL present current link editing through a shared side-sheet UI that exposes the current link state, selectable targets, and lightweight previews.

#### Scenario: Opening note-to-task linking shows current state and available task targets
- **WHEN** a user opens the link-management UI for a note
- **THEN** a side sheet opens instead of a narrow modal dialog
- **AND** the sheet shows the note's current task link state
- **AND** the sheet lists selectable tasks from the current mission context

#### Scenario: Opening subtask-to-note-block linking shows note and block preview context
- **WHEN** a user opens the link-management UI for a subtask
- **THEN** the side sheet lists selectable notes
- **AND** selecting a note reveals its blocks with short previews
- **AND** the current linked note and block remain visible until changed or cleared

#### Scenario: Opening block-to-task linking supports current-link review before save
- **WHEN** a user opens the link-management UI for a block
- **THEN** the side sheet shows the block's current linked board, task, and subtask
- **AND** the user can replace or clear the selection before saving
- **AND** the sheet provides enough context to distinguish tasks and subtasks without leaving the note editor
