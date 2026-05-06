export type SyncWorkspace = {
  workspaceId: string
  workspaceName: string
}

export type SyncBlock = {
  blockId: string
  blockType: string
  blockContent: string
  blockCreatedAt?: string
  blockUpdatedAt?: string
  linkedBoardId?: string
  linkedTaskId?: string
  linkedSubTaskId?: string
  language?: string
  executionOutput?: string
  executionError?: string
  executionExitCode?: number
  executionTimestamp?: string
}

export type SyncNote = {
  noteId: string
  noteTitle: string
  noteContent?: string
  noteCreatedAt?: string
  noteUpdatedAt?: string
  relatedTaskId?: string
  blocks: SyncBlock[]
}

export type SyncSubTask = {
  subTaskId: string
  title: string
  completed: boolean
  linkedNoteId?: string
  linkedBlockId?: string
}

export type SyncTask = {
  TaskId: string
  title: string
  description?: string
  linkedNoteIds?: string
  subTasks: SyncSubTask[]
}

export type SyncBoard = {
  BoardId: string
  MissionId?: string
  title: string
  Tasks: SyncTask[]
}

export type SyncMission = {
  MissionId: string
  WorkSpaceId?: string
  activeNoteId?: string | null
  title: string
  Notes: SyncNote[]
}

export type SyncKanbanSnapshot = {
  workspaces: SyncWorkspace[]
  missions: Record<string, SyncMission>
  boards: Record<string, SyncBoard>
  tasks: Record<string, SyncTask>
  missionOrder: Record<string, string[]>
  boardOrder: Record<string, string[]>
  activeWorkSpaceId?: string | null
  currentMissionId?: string | null
  currentNoteId?: string | null
  _cloudSyncTime?: string | null
}

export type SyncSnapshotPayload = SyncKanbanSnapshot & {
  _chatbot?: unknown
}

export type RepairStatus = 'clean' | 'safe_repair' | 'rejected'

export type RepairSummary = {
  status: RepairStatus
  droppedEntityCounts: {
    missions: number
    boards: number
    tasks: number
    invalidReferences: number
    missionOrderEntries: number
    boardOrderEntries: number
  }
  issues: string[]
}

export type SanitizedSyncSnapshotResult = {
  ok: boolean
  snapshot?: SyncSnapshotPayload
  repairSummary: RepairSummary
}

type SnapshotRecord<T> = Record<string, T>

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function asNullableString(value: unknown): string | null | undefined {
  return value === null ? null : asString(value)
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
}

function normalizeWorkspace(value: unknown): SyncWorkspace | null {
  if (!isObject(value)) return null
  const workspaceId = asString(value.workspaceId)
  const workspaceName = asString(value.workspaceName)
  if (!workspaceId || !workspaceName) return null
  return { workspaceId, workspaceName }
}

function normalizeBlock(value: unknown): SyncBlock | null {
  if (!isObject(value)) return null
  const blockId = asString(value.blockId)
  const blockType = asString(value.blockType)
  const blockContent = typeof value.blockContent === 'string' ? value.blockContent : undefined
  if (!blockId || !blockType || blockContent === undefined) return null
  return {
    blockId,
    blockType,
    blockContent,
    blockCreatedAt: asString(value.blockCreatedAt),
    blockUpdatedAt: asString(value.blockUpdatedAt),
    linkedBoardId: asString(value.linkedBoardId),
    linkedTaskId: asString(value.linkedTaskId),
    linkedSubTaskId: asString(value.linkedSubTaskId),
    language: asString(value.language),
    executionOutput: typeof value.executionOutput === 'string' ? value.executionOutput : undefined,
    executionError: typeof value.executionError === 'string' ? value.executionError : undefined,
    executionExitCode: typeof value.executionExitCode === 'number' ? value.executionExitCode : undefined,
    executionTimestamp: asString(value.executionTimestamp),
  }
}

function normalizeNote(value: unknown): SyncNote | null {
  if (!isObject(value)) return null
  const noteId = asString(value.noteId)
  const noteTitle = asString(value.noteTitle)
  if (!noteId || !noteTitle) return null
  return {
    noteId,
    noteTitle,
    noteContent: typeof value.noteContent === 'string' ? value.noteContent : undefined,
    noteCreatedAt: asString(value.noteCreatedAt),
    noteUpdatedAt: asString(value.noteUpdatedAt),
    relatedTaskId: asString(value.relatedTaskId),
    blocks: Array.isArray(value.blocks)
      ? value.blocks.map(normalizeBlock).filter((item): item is SyncBlock => item !== null)
      : [],
  }
}

function normalizeSubTask(value: unknown): SyncSubTask | null {
  if (!isObject(value)) return null
  const subTaskId = asString(value.subTaskId)
  const title = asString(value.title)
  if (!subTaskId || !title) return null
  return {
    subTaskId,
    title,
    completed: !!value.completed,
    linkedNoteId: asString(value.linkedNoteId),
    linkedBlockId: asString(value.linkedBlockId),
  }
}

function normalizeTask(value: unknown): SyncTask | null {
  if (!isObject(value)) return null
  const TaskId = asString(value.TaskId)
  const title = asString(value.title)
  if (!TaskId || !title) return null
  return {
    TaskId,
    title,
    description: typeof value.description === 'string' ? value.description : undefined,
    linkedNoteIds: asString(value.linkedNoteIds),
    subTasks: Array.isArray(value.subTasks)
      ? value.subTasks.map(normalizeSubTask).filter((item): item is SyncSubTask => item !== null)
      : [],
  }
}

function normalizeBoard(value: unknown): SyncBoard | null {
  if (!isObject(value)) return null
  const BoardId = asString(value.BoardId)
  const title = asString(value.title)
  if (!BoardId || !title) return null
  return {
    BoardId,
    MissionId: asString(value.MissionId),
    title,
    Tasks: Array.isArray(value.Tasks)
      ? value.Tasks.map(normalizeTask).filter((item): item is SyncTask => item !== null)
      : [],
  }
}

function normalizeMission(value: unknown): SyncMission | null {
  if (!isObject(value)) return null
  const MissionId = asString(value.MissionId)
  const title = asString(value.title)
  if (!MissionId || !title) return null
  return {
    MissionId,
    WorkSpaceId: asString(value.WorkSpaceId),
    activeNoteId: asNullableString(value.activeNoteId),
    title,
    Notes: Array.isArray(value.Notes)
      ? value.Notes.map(normalizeNote).filter((item): item is SyncNote => item !== null)
      : [],
  }
}

function normalizeRecord<T>(
  value: unknown,
  normalizeItem: (item: unknown) => T | null,
): SnapshotRecord<T> {
  if (!isObject(value)) return {}
  const entries: Array<[string, T]> = []
  for (const [key, item] of Object.entries(value)) {
    const normalized = normalizeItem(item)
    if (normalized) entries.push([key, normalized])
  }
  return Object.fromEntries(entries)
}

function normalizeOrder(ids: string[], preferredOrder: string[]): { orderedIds: string[]; removedCount: number } {
  const ordered = preferredOrder.filter((id) => ids.includes(id))
  const missing = ids.filter((id) => !ordered.includes(id))
  return {
    orderedIds: [...ordered, ...missing],
    removedCount: preferredOrder.length - ordered.length,
  }
}

function emptyRepairSummary(status: RepairStatus = 'clean'): RepairSummary {
  return {
    status,
    droppedEntityCounts: {
      missions: 0,
      boards: 0,
      tasks: 0,
      invalidReferences: 0,
      missionOrderEntries: 0,
      boardOrderEntries: 0,
    },
    issues: [],
  }
}

function rejected(issues: string[]): SanitizedSyncSnapshotResult {
  return {
    ok: false,
    repairSummary: {
      ...emptyRepairSummary('rejected'),
      issues,
    },
  }
}

function cloneSummary(summary: RepairSummary): RepairSummary {
  return {
    status: summary.status,
    droppedEntityCounts: { ...summary.droppedEntityCounts },
    issues: [...summary.issues],
  }
}

export function formatRepairSummary(summary?: RepairSummary | null): string | null {
  if (!summary || summary.status === 'clean') return null
  const counts = summary.droppedEntityCounts
  const parts: string[] = []
  if (counts.missions > 0) parts.push(`任务区 ${counts.missions} 个`)
  if (counts.boards > 0) parts.push(`看板 ${counts.boards} 个`)
  if (counts.tasks > 0) parts.push(`任务 ${counts.tasks} 个`)
  if (counts.invalidReferences > 0) parts.push(`无效关联 ${counts.invalidReferences} 处`)
  if (counts.missionOrderEntries > 0) parts.push(`任务区排序 ${counts.missionOrderEntries} 处`)
  if (counts.boardOrderEntries > 0) parts.push(`看板排序 ${counts.boardOrderEntries} 处`)
  const detail = parts.length > 0 ? `：已处理 ${parts.join('、')}` : ''
  const issueText = summary.issues.length > 0 ? `（${summary.issues.join('；')}）` : ''
  if (summary.status === 'rejected') {
    return `快照关系校验失败，无法安全应用${issueText}`
  }
  return `快照已自动修复${detail}${issueText}`
}

export function sanitizeSyncSnapshotPayload(payload: unknown): SanitizedSyncSnapshotResult {
  if (!isObject(payload)) {
    return rejected(['同步快照必须是对象。'])
  }

  const raw = payload as Record<string, unknown>
  const requiredKeys = ['workspaces', 'missions', 'boards', 'tasks', 'missionOrder', 'boardOrder']
  const missingKeys = requiredKeys.filter((key) => !(key in raw))
  if (missingKeys.length > 0) {
    return rejected([`同步快照缺少必要字段：${missingKeys.join(', ')}`])
  }

  const workspaces = Array.isArray(raw.workspaces)
    ? raw.workspaces.map(normalizeWorkspace).filter((item): item is SyncWorkspace => item !== null)
    : []
  const missionInput = normalizeRecord(raw.missions, normalizeMission)
  const boardInput = normalizeRecord(raw.boards, normalizeBoard)
  const taskInput = normalizeRecord(raw.tasks, normalizeTask)
  const missionOrderInput = isObject(raw.missionOrder) ? raw.missionOrder : {}
  const boardOrderInput = isObject(raw.boardOrder) ? raw.boardOrder : {}

  const summary = emptyRepairSummary('clean')
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.workspaceId))
  const soleWorkspaceId = workspaces.length === 1 ? workspaces[0]?.workspaceId : undefined
  const missions: SnapshotRecord<SyncMission> = {}

  for (const [missionId, mission] of Object.entries(missionInput)) {
    let workspaceId = mission.WorkSpaceId
    if (!workspaceId) {
      if (!soleWorkspaceId) {
        summary.issues.push(`Mission ${missionId} 缺少 WorkSpaceId，且无法安全推断归属。`)
        return rejected(summary.issues)
      }
      workspaceId = soleWorkspaceId
      summary.droppedEntityCounts.invalidReferences += 1
      summary.issues.push(`Mission ${missionId} 缺少 WorkSpaceId，已按唯一工作区自动归属。`)
    }
    if (!workspaceIds.has(workspaceId)) {
      summary.droppedEntityCounts.missions += 1
      summary.issues.push(`Mission ${missionId} 引用了不存在的 WorkSpaceId: ${workspaceId}`)
      continue
    }
    missions[missionId] = {
      ...mission,
      WorkSpaceId: workspaceId,
    }
  }

  const missionIds = new Set(Object.keys(missions))
  const soleMissionId = missionIds.size === 1 ? Array.from(missionIds)[0] : undefined
  const boards: SnapshotRecord<SyncBoard> = {}

  for (const [boardId, board] of Object.entries(boardInput)) {
    let missionId = board.MissionId
    if (!missionId) {
      if (!soleMissionId) {
        summary.issues.push(`Board ${boardId} 缺少 MissionId，且无法安全推断归属。`)
        return rejected(summary.issues)
      }
      missionId = soleMissionId
      summary.droppedEntityCounts.invalidReferences += 1
      summary.issues.push(`Board ${boardId} 缺少 MissionId，已按唯一任务区自动归属。`)
    }
    if (!missionIds.has(missionId)) {
      summary.droppedEntityCounts.boards += 1
      summary.issues.push(`Board ${boardId} 引用了不存在的 MissionId: ${missionId}`)
      continue
    }
    boards[boardId] = {
      ...board,
      MissionId: missionId,
    }
  }

  const validBoardIds = new Set(Object.keys(boards))
  const noteIds = new Set<string>()
  const blockIds = new Set<string>()

  for (const mission of Object.values(missions)) {
    for (const note of mission.Notes) {
      noteIds.add(note.noteId)
      for (const block of note.blocks) blockIds.add(block.blockId)
    }
  }

  const tasks: SnapshotRecord<SyncTask> = {}
  const validTaskIds = new Set<string>()
  const validSubTaskIds = new Set<string>()
  const cleanedBoards: SnapshotRecord<SyncBoard> = {}

  for (const [boardId, board] of Object.entries(boards)) {
    const cleanedTasks = board.Tasks.map((task) => {
      validTaskIds.add(task.TaskId)
      let linkedNoteIds = task.linkedNoteIds
      if (linkedNoteIds && !noteIds.has(linkedNoteIds)) {
        linkedNoteIds = undefined
        summary.droppedEntityCounts.invalidReferences += 1
      }

      const subTasks = task.subTasks.map((subTask) => {
        validSubTaskIds.add(subTask.subTaskId)
        let linkedNoteId = subTask.linkedNoteId
        let linkedBlockId = subTask.linkedBlockId
        if (linkedNoteId && !noteIds.has(linkedNoteId)) {
          linkedNoteId = undefined
          linkedBlockId = undefined
          summary.droppedEntityCounts.invalidReferences += 1
        }
        if (linkedBlockId && !blockIds.has(linkedBlockId)) {
          linkedBlockId = undefined
          summary.droppedEntityCounts.invalidReferences += 1
        }
        return {
          ...subTask,
          linkedNoteId,
          linkedBlockId,
        }
      })

      const cleanedTask: SyncTask = {
        ...task,
        linkedNoteIds,
        subTasks,
      }
      tasks[task.TaskId] = cleanedTask
      return cleanedTask
    })

    cleanedBoards[boardId] = {
      ...board,
      Tasks: cleanedTasks,
    }
  }

  const cleanedMissions: SnapshotRecord<SyncMission> = {}
  for (const [missionId, mission] of Object.entries(missions)) {
    cleanedMissions[missionId] = {
      ...mission,
      activeNoteId: mission.activeNoteId && noteIds.has(mission.activeNoteId) ? mission.activeNoteId : null,
      Notes: mission.Notes.map((note) => ({
        ...note,
        relatedTaskId: note.relatedTaskId && validTaskIds.has(note.relatedTaskId) ? note.relatedTaskId : undefined,
        blocks: note.blocks.map((block) => {
          let linkedBoardId = block.linkedBoardId
          let linkedTaskId = block.linkedTaskId
          let linkedSubTaskId = block.linkedSubTaskId

          if (linkedBoardId && !validBoardIds.has(linkedBoardId)) {
            linkedBoardId = undefined
            linkedTaskId = undefined
            linkedSubTaskId = undefined
            summary.droppedEntityCounts.invalidReferences += 1
          }
          if (linkedTaskId && !validTaskIds.has(linkedTaskId)) {
            linkedTaskId = undefined
            linkedSubTaskId = undefined
            summary.droppedEntityCounts.invalidReferences += 1
          }
          if (linkedSubTaskId && !validSubTaskIds.has(linkedSubTaskId)) {
            linkedSubTaskId = undefined
            summary.droppedEntityCounts.invalidReferences += 1
          }

          return {
            ...block,
            linkedBoardId,
            linkedTaskId,
            linkedSubTaskId,
          }
        }),
      })),
    }
  }

  const missionOrder = Object.fromEntries(
    workspaces.map((workspace) => {
      const missionIdsForWorkspace = Object.values(cleanedMissions)
        .filter((mission) => mission.WorkSpaceId === workspace.workspaceId)
        .map((mission) => mission.MissionId)
      const normalized = normalizeOrder(missionIdsForWorkspace, asStringArray(missionOrderInput[workspace.workspaceId]))
      summary.droppedEntityCounts.missionOrderEntries += normalized.removedCount
      return [workspace.workspaceId, normalized.orderedIds]
    }),
  ) as Record<string, string[]>

  const boardOrder = Object.fromEntries(
    Object.values(cleanedMissions).map((mission) => {
      const boardIdsForMission = Object.values(cleanedBoards)
        .filter((board) => board.MissionId === mission.MissionId)
        .map((board) => board.BoardId)
      const normalized = normalizeOrder(boardIdsForMission, asStringArray(boardOrderInput[mission.MissionId]))
      summary.droppedEntityCounts.boardOrderEntries += normalized.removedCount
      return [mission.MissionId, normalized.orderedIds]
    }),
  ) as Record<string, string[]>

  const activeWorkSpaceId = asNullableString(raw.activeWorkSpaceId)
  const currentMissionId = asNullableString(raw.currentMissionId)
  const currentNoteId = asNullableString(raw.currentNoteId)

  const sanitizedSnapshot: SyncSnapshotPayload = {
    workspaces,
    missions: cleanedMissions,
    boards: cleanedBoards,
    tasks: Object.fromEntries(Object.entries(tasks).filter(([taskId]) => validTaskIds.has(taskId))),
    missionOrder,
    boardOrder,
    activeWorkSpaceId: activeWorkSpaceId && workspaceIds.has(activeWorkSpaceId) ? activeWorkSpaceId : null,
    currentMissionId: currentMissionId && missionIds.has(currentMissionId) ? currentMissionId : null,
    currentNoteId: currentNoteId && noteIds.has(currentNoteId) ? currentNoteId : null,
    _cloudSyncTime: typeof raw._cloudSyncTime === 'string' ? raw._cloudSyncTime : null,
    ...(raw._chatbot !== undefined ? { _chatbot: raw._chatbot } : {}),
  }

  const changed = Object.values(summary.droppedEntityCounts).some((count) => count > 0)
    || summary.issues.length > 0
  const repairSummary = cloneSummary({
    ...summary,
    status: changed ? 'safe_repair' : 'clean',
  })

  return {
    ok: true,
    snapshot: sanitizedSnapshot,
    repairSummary,
  }
}

export function sanitizeStoredSyncSnapshot(payload: unknown): SanitizedSyncSnapshotResult {
  return sanitizeSyncSnapshotPayload(payload)
}