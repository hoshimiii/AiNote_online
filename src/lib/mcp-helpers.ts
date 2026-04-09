import { prisma } from "./prisma"
import { nanoid } from "nanoid"
import type { Mission, Board, Task, Note, Block, SubTask } from "@/store/kanban"

type Snapshot = Record<string, unknown>

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase()
}

function defaultKanban(): Snapshot {
  return {
    workspaces: [],
    missions: {},
    boards: {},
    tasks: {},
    missionOrder: {},
    boardOrder: {},
  }
}

function normalizeSnapshot(data: unknown): Snapshot {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ...defaultKanban() }
  }
  const d = data as Snapshot
  const merged = { ...defaultKanban(), ...d }
  if (!Array.isArray(merged.workspaces)) merged.workspaces = []
  if (typeof merged.missions !== "object" || merged.missions === null || Array.isArray(merged.missions))
    merged.missions = {}
  if (typeof merged.boards !== "object" || merged.boards === null || Array.isArray(merged.boards))
    merged.boards = {}
  if (typeof merged.tasks !== "object" || merged.tasks === null || Array.isArray(merged.tasks))
    merged.tasks = {}
  if (typeof merged.missionOrder !== "object" || merged.missionOrder === null || Array.isArray(merged.missionOrder))
    merged.missionOrder = {}
  if (typeof merged.boardOrder !== "object" || merged.boardOrder === null || Array.isArray(merged.boardOrder))
    merged.boardOrder = {}
  return merged
}

function cloneState(s: Snapshot): Snapshot {
  return JSON.parse(JSON.stringify(s)) as Snapshot
}

async function readSnapshot<T>(userId: string, fn: (state: Snapshot) => T): Promise<T> {
  const record = await prisma.workspaceSnapshot.findUnique({ where: { userId } })
  const state = normalizeSnapshot(record?.data)
  return fn(cloneState(state))
}

async function withSnapshot<T>(
  userId: string,
  mutate: (state: Snapshot) => { result: T; next: Snapshot },
): Promise<T> {
  const record = await prisma.workspaceSnapshot.findUnique({ where: { userId } })
  const state = normalizeSnapshot(record?.data)
  const { result, next } = mutate(cloneState(state))
  await prisma.workspaceSnapshot.upsert({
    where: { userId },
    create: { userId, data: next as object },
    update: { data: next as object },
  })
  return result
}

function missionsMap(state: Snapshot) {
  return state.missions as Record<string, Mission>
}

function boardsMap(state: Snapshot) {
  return state.boards as Record<string, Board>
}

function boardOrder(state: Snapshot, missionId: string) {
  return ((state.boardOrder as Record<string, string[]>)[missionId] ?? []) as string[]
}

function missionOrder(state: Snapshot, workspaceId: string) {
  return ((state.missionOrder as Record<string, string[]>)[workspaceId] ?? []) as string[]
}

function getOrderedBoards(state: Snapshot, missionId: string): Board[] {
  const boards = boardsMap(state)
  const orderedIds = boardOrder(state, missionId)
  const boardMap = Object.fromEntries(
    Object.values(boards)
      .filter((b) => b.MissionId === missionId)
      .map((b) => [b.BoardId, b]),
  )
  const ordered = orderedIds.map((id) => boardMap[id]).filter(Boolean) as Board[]
  const fallback = Object.values(boards).filter(
    (b) => b.MissionId === missionId && !orderedIds.includes(b.BoardId),
  ) as Board[]
  return [...ordered, ...fallback]
}

function listMissionsImpl(state: Snapshot, workspaceId?: string) {
  const missions = missionsMap(state)
  if (!workspaceId) {
    return Object.values(missions).map((m) => ({
      missionId: m.MissionId,
      title: m.title,
      workSpaceId: m.WorkSpaceId,
      noteCount: (m.Notes ?? []).length,
    }))
  }
  const order = missionOrder(state, workspaceId)
  const seen = new Set<string>()
  const out: { missionId: string; title: string; workSpaceId: string; noteCount: number }[] = []
  for (const id of order) {
    const m = missions[id]
    if (m && m.WorkSpaceId === workspaceId) {
      seen.add(id)
      out.push({
        missionId: m.MissionId,
        title: m.title,
        workSpaceId: m.WorkSpaceId,
        noteCount: (m.Notes ?? []).length,
      })
    }
  }
  for (const m of Object.values(missions)) {
    if (m.WorkSpaceId !== workspaceId || seen.has(m.MissionId)) continue
    out.push({
      missionId: m.MissionId,
      title: m.title,
      workSpaceId: m.WorkSpaceId,
      noteCount: (m.Notes ?? []).length,
    })
  }
  return out
}

function listBoardsImpl(state: Snapshot, missionId: string) {
  const m = missionsMap(state)[missionId]
  if (!m) throw new Error("Mission not found")
  return getOrderedBoards(state, missionId).map((b) => ({
    boardId: b.BoardId,
    title: b.title,
    taskCount: (b.Tasks ?? []).length,
  }))
}

function listTasksImpl(state: Snapshot, boardId: string) {
  const b = boardsMap(state)[boardId]
  if (!b) throw new Error("Board not found")
  return (b.Tasks ?? []).map((t) => ({
    taskId: t.TaskId,
    title: t.title,
    subTaskCount: (t.subTasks ?? []).length,
  }))
}

function listNotesImpl(state: Snapshot, missionId: string) {
  const m = missionsMap(state)[missionId]
  if (!m) throw new Error("Mission not found")
  return (m.Notes ?? []).map((n) => ({
    noteId: n.noteId,
    noteTitle: n.noteTitle,
    blockCount: (n.blocks ?? []).length,
  }))
}

function getNoteImpl(state: Snapshot, noteId: string) {
  for (const m of Object.values(missionsMap(state))) {
    const note = (m.Notes ?? []).find((n) => n.noteId === noteId)
    if (note) return { missionId: m.MissionId, ...note }
  }
  throw new Error("Note not found")
}

function getMissionSnapshotImpl(state: Snapshot, missionId: string) {
  const m = missionsMap(state)[missionId]
  if (!m) throw new Error("Mission not found")
  const boards = getOrderedBoards(state, missionId).map((board) => ({
    ...board,
    tasks: (board.Tasks ?? []).map((task) => ({
      ...task,
      subTasks: task.subTasks ?? [],
      subTaskCount: (task.subTasks ?? []).length,
    })),
  }))
  const notes = (m.Notes ?? []).map((note) => ({
    noteId: note.noteId,
    noteTitle: note.noteTitle,
    relatedTaskId: note.relatedTaskId,
    blockCount: (note.blocks ?? []).length,
  }))
  return { missionId, title: m.title, boards, notes }
}

function nowIso() {
  return new Date().toISOString()
}

function parseBlocks(raw: unknown): { blockType: string; blockContent: string }[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (!item || typeof item !== "object") return { blockType: "markdown", blockContent: "" }
    const o = item as Record<string, unknown>
    const blockType = typeof o.blockType === "string" ? o.blockType : "markdown"
    const blockContent =
      typeof o.blockContent === "string"
        ? o.blockContent
        : typeof o.content === "string"
          ? o.content
          : ""
    return { blockType, blockContent }
  })
}

function ensureWorkspace(state: Snapshot, workspaceId: string) {
  const workspaces = state.workspaces as { workspaceId: string; workspaceName: string }[]
  const w = workspaces.find((x) => x.workspaceId === workspaceId)
  if (!w) throw new Error("Workspace not found")
  return w
}

function findMissionByTitle(state: Snapshot, workspaceId: string, title: string) {
  const t = normalizeText(title)
  return Object.values(missionsMap(state)).find(
    (m) => m.WorkSpaceId === workspaceId && normalizeText(m.title) === t,
  )
}

function findBoardByTitle(state: Snapshot, missionId: string, title: string) {
  const t = normalizeText(title)
  return getOrderedBoards(state, missionId).find((b) => normalizeText(b.title) === t)
}

function findTaskByTitle(state: Snapshot, boardId: string, title: string) {
  const t = normalizeText(title)
  const b = boardsMap(state)[boardId]
  if (!b) return undefined
  return (b.Tasks ?? []).find((x) => normalizeText(x.title) === t)
}

export async function dispatch(
  toolName: string,
  userId: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case "list_workspaces":
      return readSnapshot(userId, (state) => {
        const workspaces = state.workspaces as { workspaceId: string; workspaceName: string }[]
        return workspaces.map((w) => ({ workspaceId: w.workspaceId, workspaceName: w.workspaceName }))
      })
    case "list_missions":
      return readSnapshot(userId, (state) => listMissionsImpl(state, args.workspaceId as string | undefined))
    case "list_boards":
      return readSnapshot(userId, (state) => listBoardsImpl(state, String(args.missionId)))
    case "list_tasks":
      return readSnapshot(userId, (state) => listTasksImpl(state, String(args.boardId)))
    case "list_notes":
      return readSnapshot(userId, (state) => listNotesImpl(state, String(args.missionId)))
    case "get_note":
      return readSnapshot(userId, (state) => getNoteImpl(state, String(args.noteId)))
    case "get_mission_snapshot":
      return readSnapshot(userId, (state) => getMissionSnapshotImpl(state, String(args.missionId)))
    case "create_mission":
      return withSnapshot(userId, (state) => {
        const workspaceId = String(args.workspaceId)
        const title = String(args.title)
        ensureWorkspace(state, workspaceId)
        const existing = findMissionByTitle(state, workspaceId, title)
        if (existing) {
          return {
            result: { missionId: existing.MissionId, created: false },
            next: state,
          }
        }
        const missionId = nanoid()
        const mission: Mission = {
          MissionId: missionId,
          WorkSpaceId: workspaceId,
          activeNoteId: null,
          title,
          Notes: [],
        }
        const missions = { ...missionsMap(state), [missionId]: mission }
        const prev = missionOrder(state, workspaceId)
        const missionOrderNext = { ...(state.missionOrder as Record<string, string[]>), [workspaceId]: [...prev, missionId] }
        return {
          result: { missionId, created: true },
          next: { ...state, missions, missionOrder: missionOrderNext },
        }
      })
    case "create_board":
      return withSnapshot(userId, (state) => {
        const missionId = String(args.missionId)
        const title = String(args.title)
        if (!missionsMap(state)[missionId]) throw new Error("Mission not found")
        const existing = findBoardByTitle(state, missionId, title)
        if (existing) {
          return { result: { boardId: existing.BoardId, created: false }, next: state }
        }
        const boardId = nanoid()
        const board: Board = { BoardId: boardId, MissionId: missionId, title, Tasks: [] }
        const boards = { ...boardsMap(state), [boardId]: board }
        const prev = boardOrder(state, missionId)
        const boardOrderNext = { ...(state.boardOrder as Record<string, string[]>), [missionId]: [...prev, boardId] }
        return {
          result: { boardId, created: true },
          next: { ...state, boards, boardOrder: boardOrderNext },
        }
      })
    case "create_task":
      return withSnapshot(userId, (state) => {
        const boardId = String(args.boardId)
        const title = String(args.title)
        const b = boardsMap(state)[boardId]
        if (!b) throw new Error("Board not found")
        const taskId = nanoid()
        const task: Task = { TaskId: taskId, title, linkedNoteIds: "", subTasks: [] }
        const boards = {
          ...boardsMap(state),
          [boardId]: { ...b, Tasks: [...(b.Tasks ?? []), task] },
        }
        const tasks = { ...(state.tasks as Record<string, Task>), [taskId]: task }
        return {
          result: { taskId, created: true },
          next: { ...state, boards, tasks },
        }
      })
    case "create_subtask":
      return withSnapshot(userId, (state) => {
        const boardId = String(args.boardId)
        const taskId = String(args.taskId)
        const title = String(args.title)
        const b = boardsMap(state)[boardId]
        if (!b) throw new Error("Board not found")
        const task = (b.Tasks ?? []).find((t) => t.TaskId === taskId)
        if (!task) throw new Error("Task not found")
        const subTaskId = nanoid()
        const sub: SubTask = {
          subTaskId,
          title,
          completed: false,
          linkedNoteId: "",
          linkedBlockId: "",
        }
        const nextTasks = (b.Tasks ?? []).map((t) =>
          t.TaskId === taskId ? { ...t, subTasks: [...(t.subTasks ?? []), sub] } : t,
        )
        const boards = { ...boardsMap(state), [boardId]: { ...b, Tasks: nextTasks } }
        return {
          result: { subTaskId, created: true },
          next: { ...state, boards },
        }
      })
    case "create_note":
      return withSnapshot(userId, (state) => {
        const missionId = String(args.missionId)
        const noteTitle = String(args.noteTitle)
        const m = missionsMap(state)[missionId]
        if (!m) throw new Error("Mission not found")
        const noteId = nanoid()
        const t = nowIso()
        const blocksInput = parseBlocks(args.blocks)
        const blocks: Block[] = blocksInput.map((x) => ({
          blockId: nanoid(),
          blockType: x.blockType,
          blockContent: x.blockContent,
          blockCreatedAt: t,
          blockUpdatedAt: t,
          linkedBoardId: "",
          linkedTaskId: "",
          linkedSubTaskId: "",
        }))
        const note: Note = {
          noteId,
          noteTitle,
          noteContent: "",
          noteCreatedAt: t,
          noteUpdatedAt: t,
          relatedTaskId: "",
          blocks,
        }
        const missions = {
          ...missionsMap(state),
          [missionId]: { ...m, Notes: [...(m.Notes ?? []), note] },
        }
        return {
          result: { noteId, created: true },
          next: { ...state, missions },
        }
      })
    case "create_study_note": {
      const workspaceIdArg = args.workspaceId
      const missionTitle = String(args.missionTitle)
      const boardTitle = String(args.boardTitle)
      const taskTitle = String(args.taskTitle)
      const subtaskTitle = String(args.subtaskTitle)
      const noteTitle = String(args.noteTitle)
      const blocksInput = parseBlocks(args.blocks)
      return withSnapshot(userId, (state) => {
        const workspaces = state.workspaces as { workspaceId: string; workspaceName: string }[]
        if (workspaces.length === 0) throw new Error("No workspace")
        const workspaceId =
          typeof workspaceIdArg === "string" && workspaceIdArg
            ? workspaceIdArg
            : workspaces[0].workspaceId
        ensureWorkspace(state, workspaceId)
        let mission = findMissionByTitle(state, workspaceId, missionTitle)
        let missionId: string
        if (mission) {
          missionId = mission.MissionId
        } else {
          missionId = nanoid()
          mission = {
            MissionId: missionId,
            WorkSpaceId: workspaceId,
            activeNoteId: null,
            title: missionTitle,
            Notes: [],
          }
          const missions = { ...missionsMap(state), [missionId]: mission }
          const prev = missionOrder(state, workspaceId)
          state = {
            ...state,
            missions,
            missionOrder: { ...(state.missionOrder as Record<string, string[]>), [workspaceId]: [...prev, missionId] },
          }
        }
        let board = findBoardByTitle(state, missionId, boardTitle)
        let boardId: string
        if (board) {
          boardId = board.BoardId
        } else {
          boardId = nanoid()
          board = { BoardId: boardId, MissionId: missionId, title: boardTitle, Tasks: [] }
          const boards = { ...boardsMap(state), [boardId]: board }
          const prev = boardOrder(state, missionId)
          state = {
            ...state,
            boards,
            boardOrder: { ...(state.boardOrder as Record<string, string[]>), [missionId]: [...prev, boardId] },
          }
        }
        let task = findTaskByTitle(state, boardId, taskTitle)
        let taskId: string
        const b = boardsMap(state)[boardId]!
        if (task) {
          taskId = task.TaskId
        } else {
          taskId = nanoid()
          task = { TaskId: taskId, title: taskTitle, linkedNoteIds: "", subTasks: [] }
          const boards = {
            ...boardsMap(state),
            [boardId]: { ...b, Tasks: [...(b.Tasks ?? []), task] },
          }
          const tasks = { ...(state.tasks as Record<string, Task>), [taskId]: task }
          state = { ...state, boards, tasks }
        }
        const b2 = boardsMap(state)[boardId]!
        const taskRef = (b2.Tasks ?? []).find((t) => t.TaskId === taskId)!
        const subTaskId = nanoid()
        const sub: SubTask = {
          subTaskId,
          title: subtaskTitle,
          completed: false,
          linkedNoteId: "",
          linkedBlockId: "",
        }
        const nextBoardTasks = (b2.Tasks ?? []).map((t) =>
          t.TaskId === taskId ? { ...t, subTasks: [...(t.subTasks ?? []), sub] } : t,
        )
        state = {
          ...state,
          boards: { ...boardsMap(state), [boardId]: { ...b2, Tasks: nextBoardTasks } },
        }
        const m = missionsMap(state)[missionId]!
        const noteId = nanoid()
        const t = nowIso()
        const blocks: Block[] = blocksInput.map((x) => ({
          blockId: nanoid(),
          blockType: x.blockType,
          blockContent: x.blockContent,
          blockCreatedAt: t,
          blockUpdatedAt: t,
          linkedBoardId: "",
          linkedTaskId: "",
          linkedSubTaskId: "",
        }))
        const note: Note = {
          noteId,
          noteTitle,
          noteContent: "",
          noteCreatedAt: t,
          noteUpdatedAt: t,
          relatedTaskId: taskId,
          blocks,
        }
        const missions = {
          ...missionsMap(state),
          [missionId]: { ...m, Notes: [...(m.Notes ?? []), note] },
        }
        state = { ...state, missions }
        return {
          result: { missionId, boardId, taskId, subTaskId, noteId, created: true },
          next: state,
        }
      })
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}
