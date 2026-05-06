# Design: Desktop UX & Features Polish

## Architecture Overview

All 9 features integrate into the existing Electron + React + Zustand + SQLite architecture. No new major dependencies required (react-markdown, rehype-katex, remark-math already installed).

```
┌──────────────────────────────────────────────────────────────────┐
│ Electron Main Process                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ SQLite   │  │ Auth     │  │ Code     │  │ LLM Service      ││
│  │ (users,  │  │ Service  │  │ Executor │  │                  ││
│  │ data)    │  │          │  │          │  │                  ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
│                          IPC Bridge                              │
├──────────────────────────────────────────────────────────────────┤
│ Renderer Process                                                 │
│  ┌─────────┬───────────────┬────────────────────────────────────┐│
│  │ Left    │ Center        │ Right                              ││
│  │ Panel   │ Panel         │ Panel                              ││
│  │ w-56    │ w-72          │ flex-1                             ││
│  │         │               │                                    ││
│  │ Mission │ NoteList      │ NoteView / BoardView               ││
│  │ List    │ (title+       │ (Markdown blocks, DnD,             ││
│  │ (DnD)   │ preview+date) │  Code exec, Block insert)         ││
│  │         │ max-h-[200px] │                                    ││
│  └─────────┴───────────────┴────────────────────────────────────┘│
│  ┌────────────────────────┐  ┌──────────────────────────────────┐│
│  │ ChatBotWindow + AI     │  │ Login Page                       ││
│  │ Settings Panel         │  │ (if not authenticated)           ││
│  └────────────────────────┘  └──────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## Feature Designs

### 1. Login & User Management

**Database Schema** — Add `users` table to SQLite:
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT
);
-- Add user_id FK to workspaces
ALTER TABLE workspaces ADD COLUMN user_id TEXT REFERENCES users(id);
```

**Auth Flow**:
- Main process: `AuthService` with `register(username, password)`, `login(username, password)`, `getCurrentUser()`. Passwords hashed with Node.js `crypto.scryptSync` + random salt.
- IPC: `auth:register`, `auth:login`, `auth:logout`, `auth:current-user`
- Renderer: `useAuthStore` Zustand store with `user, isAuthenticated, login(), register(), logout()`
- Login page rendered when `!isAuthenticated` in App.tsx
- All workspace queries filtered by `user_id`

### 2. Frameless Window

**Main process changes**:
```typescript
// In createMainWindow():
mainWindow = new BrowserWindow({
  frame: false,           // Remove default frame
  titleBarStyle: 'hidden', // (was 'hiddenInset')
  // ... rest same
})
```

**Custom titlebar component** (`WindowTitlebar.tsx`):
- Height: 32px, `titlebar-drag` region
- Left: app icon + workspace name (breadcrumb)
- Right: minimize / maximize / close buttons (`titlebar-no-drag`)
- `-webkit-app-region: drag` for the bar, `no-drag` for buttons
- Icons: `minimize`, `crop_square` (maximize), `close` from Material Symbols

### 3. Three-Column Layout

**WorkPage.tsx restructure**:
```
<div className="flex h-screen">
  <WindowTitlebar />           {/* fixed top, 32px */}
  <div className="flex flex-1 mt-8">
    <LeftPanel w-56 />         {/* Mission list */}
    <CenterPanel w-72 />       {/* Note/Board list for current mission */}
    <RightPanel flex-1 />      {/* Content: NoteView or BoardView */}
  </div>
</div>
```

**Center Panel (`NoteListPanel.tsx`)**:
- Shows list of notes for `currentMissionId`
- Each note card: title (1 line), content preview (2 lines, truncated), last modified time
- Max height per card: 200px
- Active note highlighted
- Toggle between "Notes" and "Boards" tabs at top
- Click note → `setActiveNote(id)`; click board → show BoardView

### 4. Drag-and-Drop (@dnd-kit)

Already installed: `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2`

**DnD contexts**:
| List | Component | Store method |
|------|-----------|-------------|
| Missions | MissionSidebar | `reorderMissions()` |
| Notes | NoteListPanel | new `reorderNotes()` |
| Boards | BoardView columns | `reorderBoards()` |
| Tasks | TaskCard within/across boards | `reorderTasks()` + `moveTask()` |
| Blocks | NoteView block list | new `reorderBlocks()` |

**Pattern**: Wrap each sortable list in `<DndContext>` + `<SortableContext>`, each item in `useSortable()`. On `onDragEnd`, call the corresponding store reorder method.

### 5. Task→Note Linking (Ctrl+Click)

**Types update**:
```typescript
// In types.ts Task:
linkedNoteId?: string

// Block already has no link fields, add:
interface Block {
  // ... existing
  linkedBoardId?: string
  linkedTaskId?: string
  linkedSubTaskId?: string
}
```

**UI**:
- `LinkBlockDialog`: Select Board → Task → SubTask from current mission, save to block
- `LinkNoteDialog`: Select Note from mission to link from a task
- SubTask already has `noteId` and `blockId` — add `LinkSubTaskDialog`
- **Ctrl+Click** on a linked element: `setActiveNote(noteId)` + scroll to `blockId`

### 6. Markdown Rendering & Code Execution

**Text blocks**:
- Dual mode: **Edit** (textarea) ↔ **Preview** (react-markdown)
- Click on preview → switch to edit; blur → switch to preview
- `react-markdown` with `remark-math`, `rehype-katex` (already installed)
- Headings, bold, italic, lists, code fences all rendered

**Code blocks**:
- Add "▶ Run" button in code block header
- On click: `window.electronAPI.code.execute(code, language)`
- Output displayed below in `<pre>` with exit code badge
- Supported languages shown via `window.electronAPI.code.languages()`

### 7. Block Insertion

**Current**: "Add Text/Code Block" buttons only at bottom of note.

**New**: Hover between any two blocks shows a thin "+" insertion line.
- On hover between block[i] and block[i+1]: show `InsertBlockHandle`
- Click → popover with "Text" / "Code" choice
- Store method: `insertBlock(noteId, afterIndex, block)` — splice into blocks array

### 8. AI Settings Panel

**Component**: `AgentSettingsPanel.tsx` (slide-out drawer or modal)
- Fields: Base URL, Model name, API Token (password field), Temperature (slider 0-2)
- Stored in `useChatbotStore.config` (already has LLMConfig type)
- Trigger: gear icon button in ChatBotWindow header
- On save: `setConfig(newConfig)` → persisted via sqlitePersist

### 9. Bug Fix: Board Scoping

**Root cause**: `createBoard()` in kanban store finds a missionId but doesn't properly scope. When switching missions, all boards from `boards{}` Record are displayed instead of only those in `boardOrder[currentMissionId]`.

**Fix**:
- `BoardView` must filter boards using `boardOrder[currentMissionId]` strictly
- `createBoard()` must also push new board ID into `missions[missionId].boardIds[]`
- `deleteBoard()` must remove from both `boardOrder` and `mission.boardIds[]`

## File Change Map

| Feature | New Files | Modified Files |
|---------|-----------|----------------|
| 1. Login | `AuthService.ts`, `LoginPage.tsx`, `useAuthStore.ts` | `schema.ts`, `ipc/index.ts`, `main/index.ts`, `preload/index.ts`, `App.tsx` |
| 2. Frameless | `WindowTitlebar.tsx` | `main/index.ts`, `WorkPage.tsx`, `index.css` |
| 3. 3-Column | `NoteListPanel.tsx` | `WorkPage.tsx`, `MissionSidebar.tsx` |
| 4. DnD | `SortableItem.tsx`, `DndWrapper.tsx` | `MissionSidebar.tsx`, `BoardView.tsx`, `NoteView.tsx`, `NoteListPanel.tsx` |
| 5. Linking | `LinkBlockDialog.tsx`, `LinkNoteDialog.tsx`, `LinkSubTaskDialog.tsx` | `types.ts`, `kanban.ts`, `BoardView.tsx`, `NoteView.tsx` |
| 6. Markdown | `MarkdownBlock.tsx`, `CodeBlockEditor.tsx` | `NoteView.tsx` |
| 7. Block Insert | `InsertBlockHandle.tsx` | `NoteView.tsx`, `kanban.ts` |
| 8. AI Settings | `AgentSettingsPanel.tsx` | `ChatBotWindow.tsx` |
| 9. Board Bug | — | `kanban.ts`, `BoardView.tsx` |

## Dependencies

All already installed. No new packages needed:
- `react-markdown@10.1.0`, `rehype-katex@7.0.1`, `remark-math@6.0.0`
- `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@^10.0.0`
- `framer-motion@12.35.2` (for animations)
