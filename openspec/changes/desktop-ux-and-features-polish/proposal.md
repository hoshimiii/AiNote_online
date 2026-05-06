# Proposal: Desktop UX & Features Polish

## Summary

Complete the AiNote Desktop application with 9 critical improvements spanning authentication, layout, interactions, markdown rendering, code execution, linking, and bug fixes. These changes transform the current skeleton into a usable daily-driver note-taking + kanban application.

## Motivation

The desktop app has all core infrastructure (Electron, SQLite, IPC, Zustand stores) but is missing essential UX polish and features that the online version already provides. Users cannot:
- Distinguish accounts (no login)
- See the app properly (has default window chrome)
- Navigate efficiently (only 2-column layout vs needed 3-column)
- Reorder items (no drag-and-drop)
- Link tasks to notes (no linking UI)
- Write formatted notes (no markdown rendering)
- Execute code blocks
- Insert blocks between existing blocks
- Configure AI settings

Additionally, boards are shared across missions (bug).

## Changes Requested

1. **Login & User Management** — Local auth with SQLite user table; future Prisma migration path
2. **Frameless Window** — Remove default titlebar, custom drag region + window controls
3. **3-Column Layout** — Left: missions, Center: note list (title+preview+date, max 200px), Right: note/board content
4. **Drag-and-Drop** — DnD for missions, boards, tasks, notes, blocks using @dnd-kit
5. **Task→Note Linking** — Ctrl+Click navigation from subtask/task to linked note/block
6. **Markdown Rendering** — Live preview for text blocks (headings, bold, etc.), code block execution button + output display
7. **Block Insertion** — Insert block between any two existing blocks
8. **AI Settings Panel** — UI for configuring LLM baseUrl, model, API token, temperature
9. **Bug Fix: Board Scoping** — Boards must be isolated per mission

## Scope

All changes target `desktop/src/` only. No changes to the online project.

## Risks

- @dnd-kit v6 + v10 sortable may have API inconsistencies (already installed as deps)
- Markdown rendering adds bundle size (~50KB for react-markdown + plugins)
- Frameless window behavior varies by OS (targeting Windows primarily)
