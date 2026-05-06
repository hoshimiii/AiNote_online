import type { Board, Mission, Note, Task, WorkSpace, WorkSpaceProps } from './index'

type KanbanCascadeState = Pick<
  WorkSpaceProps,
  | 'workspaces'
  | 'activeWorkSpaceId'
  | 'activeMissionId'
  | 'currentMissionId'
  | 'currentNoteId'
  | 'previewMissionId'
  | 'missionOrder'
  | 'boardOrder'
  | 'missions'
  | 'boards'
  | 'tasks'
>

type RemovalSets = {
  missionIds: Set<string>
  boardIds: Set<string>
  taskIds: Set<string>
  subTaskIds: Set<string>
  noteIds: Set<string>
  blockIds: Set<string>
}

function createEmptyRemovalSets(): RemovalSets {
  return {
    missionIds: new Set<string>(),
    boardIds: new Set<string>(),
    taskIds: new Set<string>(),
    subTaskIds: new Set<string>(),
    noteIds: new Set<string>(),
    blockIds: new Set<string>(),
  }
}

function collectMissionDescendants(state: KanbanCascadeState, missionIds: Set<string>): RemovalSets {
  const removal = createEmptyRemovalSets()
  removal.missionIds = new Set(missionIds)

  for (const missionId of missionIds) {
    const mission = state.missions[missionId]
    if (!mission) continue
    for (const note of mission.Notes ?? []) {
      removal.noteIds.add(note.noteId)
      for (const block of note.blocks ?? []) removal.blockIds.add(block.blockId)
    }
  }

  for (const board of Object.values(state.boards)) {
    if (!missionIds.has(board.MissionId)) continue
    removal.boardIds.add(board.BoardId)
    for (const task of board.Tasks ?? []) {
      removal.taskIds.add(task.TaskId)
      for (const subTask of task.subTasks ?? []) removal.subTaskIds.add(subTask.subTaskId)
    }
  }

  return removal
}

function collectBoardDescendants(state: KanbanCascadeState, boardIds: Set<string>): RemovalSets {
  const removal = createEmptyRemovalSets()
  removal.boardIds = new Set(boardIds)
  for (const boardId of boardIds) {
    const board = state.boards[boardId]
    if (!board) continue
    for (const task of board.Tasks ?? []) {
      removal.taskIds.add(task.TaskId)
      for (const subTask of task.subTasks ?? []) removal.subTaskIds.add(subTask.subTaskId)
    }
  }
  return removal
}

function cleanupBoardTasks(board: Board, removal: RemovalSets): Board {
  return {
    ...board,
    Tasks: (board.Tasks ?? []).map((task) => {
      const linkedNoteIds = task.linkedNoteIds && removal.noteIds.has(task.linkedNoteIds)
        ? ''
        : task.linkedNoteIds
      return {
        ...task,
        linkedNoteIds,
        subTasks: (task.subTasks ?? []).map((subTask) => ({
          ...subTask,
          linkedNoteId: subTask.linkedNoteId && removal.noteIds.has(subTask.linkedNoteId)
            ? ''
            : subTask.linkedNoteId,
          linkedBlockId: subTask.linkedBlockId && removal.blockIds.has(subTask.linkedBlockId)
            ? ''
            : subTask.linkedBlockId,
        })),
      }
    }),
  }
}

function cleanupMissionNotes(mission: Mission, removal: RemovalSets): Mission {
  return {
    ...mission,
    activeNoteId: mission.activeNoteId && removal.noteIds.has(mission.activeNoteId) ? null : mission.activeNoteId,
    Notes: (mission.Notes ?? []).map((note: Note) => ({
      ...note,
      relatedTaskId: removal.taskIds.has(note.relatedTaskId) ? '' : note.relatedTaskId,
      blocks: (note.blocks ?? []).map((block) => ({
        ...block,
        linkedBoardId: block.linkedBoardId && removal.boardIds.has(block.linkedBoardId) ? '' : block.linkedBoardId,
        linkedTaskId: block.linkedTaskId && removal.taskIds.has(block.linkedTaskId) ? '' : block.linkedTaskId,
        linkedSubTaskId: block.linkedSubTaskId && removal.subTaskIds.has(block.linkedSubTaskId) ? '' : block.linkedSubTaskId,
      })),
    })),
  }
}

function applyRemoval(state: KanbanCascadeState, removal: RemovalSets): Partial<KanbanCascadeState> {
  const workspaces = state.workspaces.filter((workspace: WorkSpace) => !removal.missionIds.has(workspace.workspaceId))
  const missions = Object.fromEntries(
    Object.entries(state.missions)
      .filter(([missionId]) => !removal.missionIds.has(missionId))
      .map(([missionId, mission]) => [missionId, cleanupMissionNotes(mission, removal)]),
  ) as Record<string, Mission>
  const boards = Object.fromEntries(
    Object.entries(state.boards)
      .filter(([boardId]) => !removal.boardIds.has(boardId))
      .map(([boardId, board]) => [boardId, cleanupBoardTasks(board, removal)]),
  ) as Record<string, Board>
  const tasks = Object.fromEntries(
    Object.entries(state.tasks).filter(([taskId]) => !removal.taskIds.has(taskId)),
  ) as Record<string, Task>

  const missionOrder = Object.fromEntries(
    Object.entries(state.missionOrder)
      .filter(([workspaceId]) => !removal.missionIds.has(workspaceId))
      .map(([workspaceId, missionIds]) => [workspaceId, missionIds.filter((missionId) => !removal.missionIds.has(missionId))]),
  ) as Record<string, string[]>

  const boardOrder = Object.fromEntries(
    Object.entries(state.boardOrder)
      .filter(([missionId]) => !removal.missionIds.has(missionId))
      .map(([missionId, boardIds]) => [missionId, boardIds.filter((boardId) => !removal.boardIds.has(boardId))]),
  ) as Record<string, string[]>

  return {
    workspaces,
    missions,
    boards,
    tasks,
    missionOrder,
    boardOrder,
    activeWorkSpaceId: state.activeWorkSpaceId,
    activeMissionId: removal.missionIds.has(state.activeMissionId ?? '') ? null : state.activeMissionId,
    currentMissionId: removal.missionIds.has(state.currentMissionId ?? '') ? null : state.currentMissionId,
    currentNoteId: removal.noteIds.has(state.currentNoteId ?? '') ? null : state.currentNoteId,
    previewMissionId: removal.missionIds.has(state.previewMissionId ?? '') ? null : state.previewMissionId,
  }
}

export function cascadeDeleteWorkspaceState(state: KanbanCascadeState, workspaceId: string): Partial<KanbanCascadeState> {
  const missionIds = new Set(
    Object.values(state.missions)
      .filter((mission) => mission.WorkSpaceId === workspaceId)
      .map((mission) => mission.MissionId),
  )
  const removal = collectMissionDescendants(state, missionIds)
  const next = applyRemoval(state, removal)
  return {
    ...next,
    workspaces: (next.workspaces ?? state.workspaces).filter((workspace) => workspace.workspaceId !== workspaceId),
    activeWorkSpaceId: state.activeWorkSpaceId === workspaceId ? null : state.activeWorkSpaceId,
    activeMissionId: state.activeWorkSpaceId === workspaceId ? null : next.activeMissionId,
    currentMissionId: state.activeWorkSpaceId === workspaceId ? null : next.currentMissionId,
    currentNoteId: state.activeWorkSpaceId === workspaceId ? null : next.currentNoteId,
    previewMissionId: state.activeWorkSpaceId === workspaceId ? null : next.previewMissionId,
    missionOrder: Object.fromEntries(
      Object.entries(next.missionOrder ?? state.missionOrder).filter(([currentWorkspaceId]) => currentWorkspaceId !== workspaceId),
    ) as Record<string, string[]>,
  }
}

export function cascadeDeleteMissionState(state: KanbanCascadeState, missionId: string): Partial<KanbanCascadeState> {
  const removal = collectMissionDescendants(state, new Set([missionId]))
  return applyRemoval(state, removal)
}

export function cascadeDeleteBoardState(state: KanbanCascadeState, boardId: string): Partial<KanbanCascadeState> {
  const removal = collectBoardDescendants(state, new Set([boardId]))
  return applyRemoval(state, removal)
}