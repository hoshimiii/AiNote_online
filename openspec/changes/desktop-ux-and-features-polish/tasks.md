# Tasks: Desktop UX & Features Polish

## Phase 1: Bug Fix — Board Scoping (Priority: P0, fix broken behavior first)

### 1.1 Fix `createBoard()` to maintain `mission.boardIds[]`
- **File**: `src/renderer/store/kanban.ts`
- When creating a board, push the new board ID into `missions[missionId].boardIds`
- Also update `boardOrder[missionId]`

### 1.2 Fix `deleteBoard()` to clean up `mission.boardIds[]`
- **File**: `src/renderer/store/kanban.ts`
- Remove board ID from `missions[missionId].boardIds` on deletion
- Also remove from `boardOrder[missionId]`

### 1.3 Fix `BoardView` to filter boards by current mission only
- **File**: `src/renderer/components/Board/BoardView.tsx`
- Use `boardOrder[currentMissionId]` to get board IDs
- Only render boards that exist in this array
- Verify boards aren't leaking across missions

---

## Phase 2: Frameless Window + Custom Titlebar

### 2.1 Make BrowserWindow frameless
- **File**: `src/main/index.ts`
- Change `frame: true` → `frame: false`
- Change `titleBarStyle: 'hiddenInset'` → remove or set `'hidden'`
- Keep `show: false` + `ready-to-show` pattern

### 2.2 Create `WindowTitlebar` component
- **New file**: `src/renderer/components/layout/WindowTitlebar.tsx`
- 32px height bar with `-webkit-app-region: drag`
- Left side: back button + workspace/mission breadcrumb (no-drag)
- Right side: minimize / maximize / close buttons (no-drag)
- Buttons call `window.electronAPI.app.minimize()` / `.maximize()` / `.close()`

### 2.3 Integrate titlebar into App layout
- **File**: `src/renderer/components/pages/WorkPage.tsx`
- Replace current fixed top-bar (h-8) with `<WindowTitlebar />`
- **File**: `src/renderer/components/pages/WorkspacesPage.tsx`
- Add `<WindowTitlebar />` at top
- **File**: `src/renderer/index.css`
- Add utility classes: `.titlebar-drag { -webkit-app-region: drag }`, `.titlebar-no-drag { -webkit-app-region: no-drag }`

---

## Phase 3: Three-Column Layout

### 3.1 Create `NoteListPanel` component (center column)
- **New file**: `src/renderer/components/Note/NoteListPanel.tsx`
- Reads `currentMissionId` from store
- Lists notes for that mission: title (1 line), content preview (2 lines from first text block), last modified date
- Each note card max height 200px, with click handler → `setActiveNote(id)`
- Active note has highlighted border/background
- Top tabs: "Notes" | "Boards" to switch center panel content
- "Boards" tab shows list of boards for current mission as cards

### 3.2 Restructure `WorkPage` to 3 columns
- **File**: `src/renderer/components/pages/WorkPage.tsx`
- Layout: `<WindowTitlebar />` + flex row of 3 panels
  - Left (`w-56`): `<MissionSidebar />`
  - Center (`w-72`, border-x): `<NoteListPanel />`
  - Right (`flex-1`): `<NoteView />` or `<BoardView />` based on selection
- Remove old 2-column conditional rendering
- Show `NoteView` when `currentNoteId`, `BoardView` when a board is selected, otherwise empty placeholder

### 3.3 Update `MissionSidebar` for new width
- **File**: `src/renderer/components/Mission/MissionSidebar.tsx`
- Adjust from `w-64` parent to work with new `w-56` container
- Ensure scroll area fills available height

---

## Phase 4: Login & User Management

### 4.1 Add `users` table to SQLite schema
- **File**: `src/main/database/schema.ts`
- Add `users` table: `id TEXT PK, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT, created_at TEXT, last_login_at TEXT`
- Add `user_id TEXT REFERENCES users(id)` column to `workspaces` table
- Increment `CURRENT_SCHEMA_VERSION`, add migration in `init.ts`

### 4.2 Create `AuthService`
- **New file**: `src/main/services/AuthService.ts`
- `register(username, password)`: validate, hash with `crypto.scryptSync` + random 16-byte salt, insert into users table, return user object (no password)
- `login(username, password)`: lookup user, verify hash, update `last_login_at`, return user
- `getCurrentUser(userId)`: lookup by ID
- `listUsers()`: return all users (for user switcher)

### 4.3 Register auth IPC handlers
- **File**: `src/main/ipc/index.ts`
- Add `registerAuthHandlers()`: `auth:register`, `auth:login`, `auth:logout`, `auth:current-user`, `auth:list-users`
- **File**: `src/main/index.ts` — call `registerAuthHandlers()`
- **File**: `src/preload/index.ts` — expose `auth.*` methods

### 4.4 Create `useAuthStore`
- **New file**: `src/renderer/store/auth.ts`
- State: `user: { id, username, displayName } | null`, `isAuthenticated: boolean`
- Actions: `login(username, password)`, `register(username, password)`, `logout()`, `checkSession()`
- Persist current user ID in SQLite settings (auto-login on restart)

### 4.5 Create `LoginPage` component
- **New file**: `src/renderer/components/pages/LoginPage.tsx`
- Two modes: Login / Register (toggle)
- Fields: username, password (+ confirm password for register)
- User list for quick switch (click to login with password prompt)
- Error messages for invalid credentials / duplicate username

### 4.6 Integrate auth into App routing
- **File**: `src/renderer/App.tsx`
- If `!isAuthenticated` → render `<LoginPage />`
- If authenticated → render current `<AppContent />`
- Filter workspaces by `user_id` in store hydration

---

## Phase 5: Drag-and-Drop

### 5.1 Create reusable `SortableItem` wrapper
- **New file**: `src/renderer/components/utils/SortableItem.tsx`
- Wrapper component using `useSortable()` from @dnd-kit/sortable
- Provides drag handle, transform styles, transition
- Generic: accepts children, id, optional drag handle element

### 5.2 Add DnD to MissionSidebar
- **File**: `src/renderer/components/Mission/MissionSidebar.tsx`
- Wrap mission list in `<DndContext>` + `<SortableContext>`
- Each mission item wrapped in `<SortableItem>`
- `onDragEnd` → `reorderMissions(wsId, newOrder)`
- Drag handle: 6-dot grip icon on left

### 5.3 Add DnD to NoteListPanel
- **File**: `src/renderer/components/Note/NoteListPanel.tsx`
- Same DnD pattern for note cards
- Add `reorderNotes(missionId, newOrder)` to kanban store
- **File**: `src/renderer/store/kanban.ts` — add `noteOrder: Record<string, string[]>` + `reorderNotes()`

### 5.4 Add DnD to BoardView (board columns + task cards)
- **File**: `src/renderer/components/Board/BoardView.tsx`
- Board columns: horizontal sortable context → `reorderBoards()`
- Task cards within columns: vertical sortable → `reorderTasks()`
- Cross-board task drag: detect `over.data.boardId !== active.data.boardId` → `moveTask()`
- Visual feedback: dragged card has elevation shadow + opacity

### 5.5 Add DnD to NoteView blocks
- **File**: `src/renderer/components/Note/NoteView.tsx`
- Blocks: vertical sortable context
- Add `reorderBlocks(noteId, newOrder)` to kanban store
- **File**: `src/renderer/store/kanban.ts` — add `reorderBlocks()`
- Drag handle on left side of each block

---

## Phase 6: Markdown Rendering & Code Execution

### 6.1 Create `MarkdownBlock` component
- **New file**: `src/renderer/components/Note/MarkdownBlock.tsx`
- Dual mode: editing (textarea) ↔ rendered (react-markdown)
- Click rendered → switch to editing; blur textarea → switch to rendered
- Support: headings, bold, italic, lists, links, code fences, math (KaTeX)
- Inherit font/size from Digital Sanctuary theme

### 6.2 Create `CodeBlockEditor` component
- **New file**: `src/renderer/components/Note/CodeBlockEditor.tsx`
- Header: language selector dropdown + "▶ Run" button
- Code textarea with monospace font
- Output area: `<pre>` with background, shows `lastOutput` + exit code badge
- "▶ Run" calls `window.electronAPI.code.execute(code, language)`
- Loading spinner while executing
- Languages from `window.electronAPI.code.languages()`

### 6.3 Integrate new block components into NoteView
- **File**: `src/renderer/components/Note/NoteView.tsx`
- Replace inline `BlockEditor` with `MarkdownBlock` (for type='text') and `CodeBlockEditor` (for type='code')
- Each block wrapped in `SortableItem` (from Phase 5)
- Delete button remains on hover left side

---

## Phase 7: Block Insertion

### 7.1 Create `InsertBlockHandle` component
- **New file**: `src/renderer/components/Note/InsertBlockHandle.tsx`
- Thin horizontal line (2px) shown between blocks on hover
- Center "+" button that expands to menu: "Text" / "Code"
- Appears between block[i] and block[i+1], also at top (before first block)

### 7.2 Add `insertBlock()` to kanban store
- **File**: `src/renderer/store/kanban.ts`
- `insertBlock(noteId: string, afterIndex: number, blockType: 'text' | 'code')`
- Creates new block with nanoid, splices into `notes[noteId].blocks` at position `afterIndex + 1`

### 7.3 Integrate InsertBlockHandle into NoteView
- **File**: `src/renderer/components/Note/NoteView.tsx`
- Render `<InsertBlockHandle>` between each block
- Also render one at the top of the block list
- Remove old "Add Text/Code Block" buttons at bottom (or keep as fallback)

---

## Phase 8: Task→Note Linking (Ctrl+Click)

### 8.1 Update types for linking
- **File**: `src/shared/types.ts`
- Add to `Task`: `linkedNoteId?: string`
- Add to `Block`: `linkedBoardId?: string`, `linkedTaskId?: string`, `linkedSubTaskId?: string`
- SubTask already has `noteId?`, `blockId?`

### 8.2 Create link dialog components
- **New file**: `src/renderer/components/items/LinkBlockDialog.tsx`
  - 3-level cascade: Board → Task → SubTask selector
  - Saves `linkedBoardId`, `linkedTaskId`, `linkedSubTaskId` to the block
- **New file**: `src/renderer/components/items/LinkNoteDialog.tsx`
  - Select a Note from current mission to link from a Task
- **New file**: `src/renderer/components/items/LinkSubTaskDialog.tsx`
  - Select Note → Block to link from a SubTask

### 8.3 Add link store methods
- **File**: `src/renderer/store/kanban.ts`
- `linkTaskToNote(taskId, noteId)`: sets `tasks[taskId].linkedNoteId`
- `linkBlockToTask(noteId, blockId, boardId, taskId, subTaskId?)`: sets block link fields
- `linkSubTaskToBlock(taskId, subTaskIndex, noteId, blockId)`: sets subtask link fields
- `unlinkTask(taskId)`, `unlinkBlock(noteId, blockId)`, `unlinkSubTask(taskId, subTaskIndex)`

### 8.4 Add Ctrl+Click navigation
- **File**: `src/renderer/components/Board/BoardView.tsx`
  - TaskCard: render link icon if `linkedNoteId` exists
  - On Ctrl+Click task title → `setActiveNote(linkedNoteId)`
  - SubTask: on Ctrl+Click → `setActiveNote(noteId)` + scroll to blockId
- **File**: `src/renderer/components/Note/NoteView.tsx`
  - Block: render link badge if `linkedTaskId` exists
  - On Ctrl+Click link badge → switch to BoardView, highlight linked task

---

## Phase 9: AI Settings Panel

### 9.1 Create `AgentSettingsPanel` component
- **New file**: `src/renderer/components/settings/AgentSettingsPanel.tsx`
- Slide-out drawer (right side) or modal dialog
- Fields:
  - Base URL: text input (default: `https://api.openai.com/v1`)
  - Model: text input (default: `gpt-4o`)
  - API Token: password input with toggle visibility
  - Temperature: slider 0–2, step 0.1, with numeric display
- Save button → `useChatbotStore.setConfig()`
- Test connection button → send a minimal "hello" prompt

### 9.2 Integrate settings trigger into ChatBot
- **File**: `src/renderer/components/ChatBot/ChatBotWindow.tsx`
- Add gear icon button in ChatPanel header (next to clear/close)
- Click → open `AgentSettingsPanel`
- Show current model name as subtitle in chat header

---

## Dependency Order

```
Phase 1 (Board Bug) → independent, do first
Phase 2 (Frameless) → independent
Phase 3 (3-Column) → depends on Phase 2 (titlebar)
Phase 4 (Login) → independent of layout
Phase 5 (DnD) → depends on Phase 3 (new components to add DnD to)
Phase 6 (Markdown) → independent
Phase 7 (Block Insert) → depends on Phase 6 (new block components)
Phase 8 (Linking) → depends on Phase 5 (DnD) and Phase 6 (new block components)
Phase 9 (AI Settings) → independent
```

**Recommended order**: 1 → 2 → 3 → 9 → 6 → 7 → 4 → 5 → 8
