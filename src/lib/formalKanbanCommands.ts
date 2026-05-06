import {
  sanitizeSyncSnapshotPayload,
  type RepairSummary,
  type SyncBlock,
  type SyncBoard,
  type SyncMission,
  type SyncSnapshotPayload,
  type SyncTask,
} from "@/lib/syncSnapshotIntegrity";
import type { FormalCommandKind } from "@/lib/formalToolContracts";

export type FormalCommandVerification = {
  verified: boolean;
  details: string[];
};

export type FormalCommandResult = {
  success: boolean;
  commandKind: FormalCommandKind;
  affectedIds: Record<string, string | undefined>;
  verification: FormalCommandVerification;
  repairSummary?: RepairSummary;
  snapshot?: SyncSnapshotPayload;
  error?: string;
};

export type FormalKanbanCommand =
  | { kind: "create_workspace"; workspaceId: string; workspaceName: string }
  | { kind: "rename_workspace"; workspaceId: string; newName: string }
  | { kind: "delete_workspace"; workspaceId: string }
  | { kind: "create_mission"; workspaceId: string; missionId: string; title: string }
  | { kind: "rename_mission"; missionId: string; newTitle: string }
  | { kind: "delete_mission"; missionId: string }
  | { kind: "create_board"; missionId: string; boardId: string; title: string }
  | { kind: "rename_board"; boardId: string; newTitle: string }
  | { kind: "delete_board"; boardId: string }
  | { kind: "create_task"; boardId: string; taskId: string; title: string }
  | { kind: "rename_task"; boardId: string; taskId: string; newTitle: string }
  | { kind: "delete_task"; boardId: string; taskId: string }
  | { kind: "create_subtask"; boardId: string; taskId: string; subTaskId: string; title: string }
  | { kind: "rename_subtask"; boardId: string; taskId: string; subTaskId: string; newTitle: string }
  | { kind: "delete_subtask"; boardId: string; taskId: string; subTaskId: string }
  | { kind: "create_note"; missionId: string; noteId: string; title: string }
  | { kind: "rename_note"; missionId: string; noteId: string; newTitle: string }
  | { kind: "delete_note"; missionId: string; noteId: string }
  | { kind: "link_task_note"; boardId: string; taskId: string; noteId?: string; subTaskId?: string; blockId?: string }
  | { kind: "link_block"; missionId: string; noteId: string; blockId: string; boardId: string; taskId: string; subTaskId?: string }
  | { kind: "rewrite_note"; missionId: string; noteId: string; blocks: SyncBlock[] };

const createEmptySnapshot = (): SyncSnapshotPayload => ({
  workspaces: [],
  missions: {},
  boards: {},
  tasks: {},
  missionOrder: {},
  boardOrder: {},
  activeWorkSpaceId: null,
  currentMissionId: null,
  currentNoteId: null,
  _cloudSyncTime: null,
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const fail = (commandKind: FormalCommandKind, message: string): FormalCommandResult => ({
  success: false,
  commandKind,
  affectedIds: {},
  verification: { verified: false, details: [message] },
  error: message,
});

const ok = (
  commandKind: FormalCommandKind,
  snapshot: SyncSnapshotPayload,
  affectedIds: Record<string, string | undefined>,
  details: string[],
  repairSummary?: RepairSummary,
): FormalCommandResult => ({
  success: true,
  commandKind,
  affectedIds,
  snapshot,
  repairSummary,
  verification: {
    verified: true,
    details,
  },
});

const getMission = (snapshot: SyncSnapshotPayload, missionId: string) => snapshot.missions[missionId];
const getBoard = (snapshot: SyncSnapshotPayload, boardId: string) => snapshot.boards[boardId];
const getTask = (snapshot: SyncSnapshotPayload, boardId: string, taskId: string) =>
  snapshot.boards[boardId]?.Tasks.find((task) => task.TaskId === taskId);
const getNote = (snapshot: SyncSnapshotPayload, missionId: string, noteId: string) =>
  snapshot.missions[missionId]?.Notes.find((note) => note.noteId === noteId);

const removeTaskLinks = (snapshot: SyncSnapshotPayload, taskId: string, subTaskIds: string[]) => {
  const subTaskSet = new Set(subTaskIds);
  for (const mission of Object.values(snapshot.missions)) {
    mission.Notes = mission.Notes.map((note) => ({
      ...note,
      relatedTaskId: note.relatedTaskId === taskId ? undefined : note.relatedTaskId,
      blocks: note.blocks.map((block) => ({
        ...block,
        linkedTaskId: block.linkedTaskId === taskId ? undefined : block.linkedTaskId,
        linkedSubTaskId: block.linkedSubTaskId && subTaskSet.has(block.linkedSubTaskId)
          ? undefined
          : block.linkedSubTaskId,
      })),
    }));
  }
};

const removeNoteLinks = (snapshot: SyncSnapshotPayload, noteId: string, blockIds: string[]) => {
  const blockIdSet = new Set(blockIds);
  for (const board of Object.values(snapshot.boards)) {
    board.Tasks = board.Tasks.map((task) => ({
      ...task,
      linkedNoteIds: task.linkedNoteIds === noteId ? undefined : task.linkedNoteIds,
      subTasks: task.subTasks.map((subTask) => ({
        ...subTask,
        linkedNoteId: subTask.linkedNoteId === noteId ? undefined : subTask.linkedNoteId,
        linkedBlockId: subTask.linkedBlockId && blockIdSet.has(subTask.linkedBlockId)
          ? undefined
          : subTask.linkedBlockId,
      })),
    }));
  }
};

const ensureSnapshot = (snapshot?: SyncSnapshotPayload | null) => clone(snapshot ?? createEmptySnapshot());

export function applyFormalKanbanCommand(
  inputSnapshot: SyncSnapshotPayload | null | undefined,
  command: FormalKanbanCommand,
): FormalCommandResult {
  const snapshot = ensureSnapshot(inputSnapshot);

  switch (command.kind) {
    case "create_workspace": {
      snapshot.workspaces.push({ workspaceId: command.workspaceId, workspaceName: command.workspaceName });
      snapshot.missionOrder[command.workspaceId] = snapshot.missionOrder[command.workspaceId] ?? [];
      return ok(command.kind, snapshot, { workspaceId: command.workspaceId }, ["工作区已创建"]);
    }
    case "rename_workspace": {
      const workspace = snapshot.workspaces.find((item) => item.workspaceId === command.workspaceId);
      if (!workspace) return fail(command.kind, `Workspace ${command.workspaceId} not found`);
      workspace.workspaceName = command.newName;
      return ok(command.kind, snapshot, { workspaceId: command.workspaceId }, ["工作区名称已更新"]);
    }
    case "delete_workspace": {
      const targetMissionIds = Object.values(snapshot.missions)
        .filter((mission) => mission.WorkSpaceId === command.workspaceId)
        .map((mission) => mission.MissionId);
      for (const missionId of targetMissionIds) {
        const boardIds = Object.values(snapshot.boards)
          .filter((board) => board.MissionId === missionId)
          .map((board) => board.BoardId);
        for (const boardId of boardIds) {
          const board = snapshot.boards[boardId];
          for (const task of board?.Tasks ?? []) {
            removeTaskLinks(snapshot, task.TaskId, task.subTasks.map((subTask) => subTask.subTaskId));
            delete snapshot.tasks[task.TaskId];
          }
          delete snapshot.boards[boardId];
        }
        const mission = snapshot.missions[missionId];
        for (const note of mission?.Notes ?? []) {
          removeNoteLinks(snapshot, note.noteId, note.blocks.map((block) => block.blockId));
        }
        delete snapshot.missions[missionId];
        delete snapshot.boardOrder[missionId];
      }
      snapshot.workspaces = snapshot.workspaces.filter((workspace) => workspace.workspaceId !== command.workspaceId);
      delete snapshot.missionOrder[command.workspaceId];
      if (snapshot.activeWorkSpaceId === command.workspaceId) snapshot.activeWorkSpaceId = null;
      if (targetMissionIds.includes(snapshot.currentMissionId ?? "")) snapshot.currentMissionId = null;
      return ok(command.kind, snapshot, { workspaceId: command.workspaceId }, ["工作区及其下属结构已删除"]);
    }
    case "create_mission": {
      if (!snapshot.workspaces.some((item) => item.workspaceId === command.workspaceId)) {
        return fail(command.kind, `Workspace ${command.workspaceId} not found`);
      }
      snapshot.missions[command.missionId] = {
        MissionId: command.missionId,
        WorkSpaceId: command.workspaceId,
        activeNoteId: null,
        title: command.title,
        Notes: [],
      };
      snapshot.missionOrder[command.workspaceId] = [...(snapshot.missionOrder[command.workspaceId] ?? []), command.missionId];
      snapshot.boardOrder[command.missionId] = snapshot.boardOrder[command.missionId] ?? [];
      snapshot.currentMissionId = command.missionId;
      return ok(command.kind, snapshot, { workspaceId: command.workspaceId, missionId: command.missionId }, ["任务区已创建"]);
    }
    case "rename_mission": {
      const mission = getMission(snapshot, command.missionId);
      if (!mission) return fail(command.kind, `Mission ${command.missionId} not found`);
      mission.title = command.newTitle;
      return ok(command.kind, snapshot, { missionId: command.missionId }, ["任务区名称已更新"]);
    }
    case "delete_mission": {
      const mission = getMission(snapshot, command.missionId);
      if (!mission) return fail(command.kind, `Mission ${command.missionId} not found`);
      const boardIds = Object.values(snapshot.boards)
        .filter((board) => board.MissionId === command.missionId)
        .map((board) => board.BoardId);
      for (const boardId of boardIds) {
        const board = snapshot.boards[boardId];
        for (const task of board?.Tasks ?? []) {
          removeTaskLinks(snapshot, task.TaskId, task.subTasks.map((subTask) => subTask.subTaskId));
          delete snapshot.tasks[task.TaskId];
        }
        delete snapshot.boards[boardId];
      }
      for (const note of mission.Notes) {
        removeNoteLinks(snapshot, note.noteId, note.blocks.map((block) => block.blockId));
      }
      delete snapshot.missions[command.missionId];
      delete snapshot.boardOrder[command.missionId];
      snapshot.missionOrder[mission.WorkSpaceId] = (snapshot.missionOrder[mission.WorkSpaceId] ?? []).filter((id) => id !== command.missionId);
      if (snapshot.currentMissionId === command.missionId) snapshot.currentMissionId = null;
      if (snapshot.currentNoteId && mission.Notes.some((note) => note.noteId === snapshot.currentNoteId)) snapshot.currentNoteId = null;
      return ok(command.kind, snapshot, { missionId: command.missionId }, ["任务区及其下属结构已删除"]);
    }
    case "create_board": {
      const mission = getMission(snapshot, command.missionId);
      if (!mission) return fail(command.kind, `Mission ${command.missionId} not found`);
      snapshot.boards[command.boardId] = { BoardId: command.boardId, MissionId: command.missionId, title: command.title, Tasks: [] };
      snapshot.boardOrder[command.missionId] = [...(snapshot.boardOrder[command.missionId] ?? []), command.boardId];
      return ok(command.kind, snapshot, { missionId: command.missionId, boardId: command.boardId }, ["看板已创建"]);
    }
    case "rename_board": {
      const board = getBoard(snapshot, command.boardId);
      if (!board) return fail(command.kind, `Board ${command.boardId} not found`);
      board.title = command.newTitle;
      return ok(command.kind, snapshot, { boardId: command.boardId }, ["看板名称已更新"]);
    }
    case "delete_board": {
      const board = getBoard(snapshot, command.boardId);
      if (!board) return fail(command.kind, `Board ${command.boardId} not found`);
      for (const task of board.Tasks) {
        removeTaskLinks(snapshot, task.TaskId, task.subTasks.map((subTask) => subTask.subTaskId));
        delete snapshot.tasks[task.TaskId];
      }
      delete snapshot.boards[command.boardId];
      snapshot.boardOrder[board.MissionId] = (snapshot.boardOrder[board.MissionId] ?? []).filter((id) => id !== command.boardId);
      return ok(command.kind, snapshot, { missionId: board.MissionId, boardId: command.boardId }, ["看板已删除"]);
    }
    case "create_task": {
      const board = getBoard(snapshot, command.boardId);
      if (!board) return fail(command.kind, `Board ${command.boardId} not found`);
      const task: SyncTask = { TaskId: command.taskId, title: command.title, linkedNoteIds: undefined, subTasks: [] };
      board.Tasks = [...board.Tasks, task];
      snapshot.tasks[command.taskId] = task;
      return ok(command.kind, snapshot, { boardId: command.boardId, taskId: command.taskId }, ["任务已创建"]);
    }
    case "rename_task": {
      const task = getTask(snapshot, command.boardId, command.taskId);
      if (!task) return fail(command.kind, `Task ${command.taskId} not found`);
      task.title = command.newTitle;
      snapshot.tasks[command.taskId] = clone(task);
      return ok(command.kind, snapshot, { boardId: command.boardId, taskId: command.taskId }, ["任务名称已更新"]);
    }
    case "delete_task": {
      const board = getBoard(snapshot, command.boardId);
      const task = getTask(snapshot, command.boardId, command.taskId);
      if (!board || !task) return fail(command.kind, `Task ${command.taskId} not found`);
      removeTaskLinks(snapshot, command.taskId, task.subTasks.map((subTask) => subTask.subTaskId));
      board.Tasks = board.Tasks.filter((item) => item.TaskId !== command.taskId);
      delete snapshot.tasks[command.taskId];
      return ok(command.kind, snapshot, { boardId: command.boardId, taskId: command.taskId }, ["任务已删除"]);
    }
    case "create_subtask": {
      const task = getTask(snapshot, command.boardId, command.taskId);
      if (!task) return fail(command.kind, `Task ${command.taskId} not found`);
      task.subTasks = [
        ...task.subTasks,
        {
          subTaskId: command.subTaskId,
          title: command.title,
          completed: false,
          linkedNoteId: undefined,
          linkedBlockId: undefined,
        },
      ];
      snapshot.tasks[command.taskId] = clone(task);
      return ok(command.kind, snapshot, { boardId: command.boardId, taskId: command.taskId, subTaskId: command.subTaskId }, ["子任务已创建"]);
    }
    case "rename_subtask": {
      const task = getTask(snapshot, command.boardId, command.taskId);
      if (!task) return fail(command.kind, `Task ${command.taskId} not found`);
      task.subTasks = task.subTasks.map((subTask) =>
        subTask.subTaskId === command.subTaskId ? { ...subTask, title: command.newTitle } : subTask,
      );
      snapshot.tasks[command.taskId] = clone(task);
      return ok(command.kind, snapshot, { boardId: command.boardId, taskId: command.taskId, subTaskId: command.subTaskId }, ["子任务名称已更新"]);
    }
    case "delete_subtask": {
      const task = getTask(snapshot, command.boardId, command.taskId);
      if (!task) return fail(command.kind, `Task ${command.taskId} not found`);
      task.subTasks = task.subTasks.map((subTask) =>
        subTask.subTaskId === command.subTaskId
          ? { ...subTask, linkedNoteId: undefined, linkedBlockId: undefined }
          : subTask,
      ).filter((subTask) => subTask.subTaskId !== command.subTaskId);
      snapshot.tasks[command.taskId] = clone(task);
      removeTaskLinks(snapshot, command.taskId, [command.subTaskId]);
      return ok(command.kind, snapshot, { boardId: command.boardId, taskId: command.taskId, subTaskId: command.subTaskId }, ["子任务已删除"]);
    }
    case "create_note": {
      const mission = getMission(snapshot, command.missionId);
      if (!mission) return fail(command.kind, `Mission ${command.missionId} not found`);
      mission.Notes = [
        ...mission.Notes,
        {
          noteId: command.noteId,
          noteTitle: command.title,
          noteContent: "",
          noteCreatedAt: new Date().toISOString(),
          noteUpdatedAt: new Date().toISOString(),
          relatedTaskId: undefined,
          blocks: [],
        },
      ];
      snapshot.currentMissionId = command.missionId;
      snapshot.currentNoteId = command.noteId;
      return ok(command.kind, snapshot, { missionId: command.missionId, noteId: command.noteId }, ["笔记已创建"]);
    }
    case "rename_note": {
      const note = getNote(snapshot, command.missionId, command.noteId);
      if (!note) return fail(command.kind, `Note ${command.noteId} not found`);
      note.noteTitle = command.newTitle;
      note.noteUpdatedAt = new Date().toISOString();
      return ok(command.kind, snapshot, { missionId: command.missionId, noteId: command.noteId }, ["笔记名称已更新"]);
    }
    case "delete_note": {
      const mission = getMission(snapshot, command.missionId);
      const note = getNote(snapshot, command.missionId, command.noteId);
      if (!mission || !note) return fail(command.kind, `Note ${command.noteId} not found`);
      removeNoteLinks(snapshot, command.noteId, note.blocks.map((block) => block.blockId));
      mission.Notes = mission.Notes.filter((item) => item.noteId !== command.noteId);
      if (mission.activeNoteId === command.noteId) mission.activeNoteId = null;
      if (snapshot.currentNoteId === command.noteId) snapshot.currentNoteId = null;
      return ok(command.kind, snapshot, { missionId: command.missionId, noteId: command.noteId }, ["笔记已删除"]);
    }
    case "link_task_note": {
      const board = getBoard(snapshot, command.boardId);
      const task = getTask(snapshot, command.boardId, command.taskId);
      if (!board || !task) return fail(command.kind, `Task ${command.taskId} not found`);
      task.linkedNoteIds = command.noteId;
      if (command.subTaskId) {
        task.subTasks = task.subTasks.map((subTask) =>
          subTask.subTaskId === command.subTaskId
            ? { ...subTask, linkedNoteId: command.noteId, linkedBlockId: command.blockId }
            : subTask,
        );
      }
      snapshot.tasks[command.taskId] = clone(task);
      return ok(command.kind, snapshot, { boardId: command.boardId, taskId: command.taskId, noteId: command.noteId }, ["任务链接已更新"]);
    }
    case "link_block": {
      const mission = getMission(snapshot, command.missionId);
      const board = getBoard(snapshot, command.boardId);
      const task = getTask(snapshot, command.boardId, command.taskId);
      const note = getNote(snapshot, command.missionId, command.noteId);
      if (!mission || !board || !task || !note) return fail(command.kind, "Link target not found");
      note.blocks = note.blocks.map((block) =>
        block.blockId === command.blockId
          ? {
              ...block,
              linkedBoardId: command.boardId,
              linkedTaskId: command.taskId,
              linkedSubTaskId: command.subTaskId,
            }
          : block,
      );
      if (command.subTaskId) {
        task.subTasks = task.subTasks.map((subTask) =>
          subTask.subTaskId === command.subTaskId
            ? { ...subTask, linkedNoteId: command.noteId, linkedBlockId: command.blockId }
            : subTask,
        );
        snapshot.tasks[command.taskId] = clone(task);
      }
      return ok(command.kind, snapshot, {
        missionId: command.missionId,
        noteId: command.noteId,
        blockId: command.blockId,
        boardId: command.boardId,
        taskId: command.taskId,
      }, ["块链接已更新"]);
    }
    case "rewrite_note": {
      const note = getNote(snapshot, command.missionId, command.noteId);
      if (!note) return fail(command.kind, `Note ${command.noteId} not found`);
      note.blocks = command.blocks;
      note.noteUpdatedAt = new Date().toISOString();
      return ok(command.kind, snapshot, { missionId: command.missionId, noteId: command.noteId }, ["笔记内容已重写"]);
    }
    default:
      return fail(command.kind, "Unsupported command");
  }
}

export function executeFormalKanbanCommand(
  inputSnapshot: SyncSnapshotPayload | null | undefined,
  command: FormalKanbanCommand,
): FormalCommandResult {
  const executed = applyFormalKanbanCommand(inputSnapshot, command);
  if (!executed.success || !executed.snapshot) return executed;
  const sanitized = sanitizeSyncSnapshotPayload(executed.snapshot);
  if (!sanitized.ok || !sanitized.snapshot) {
    return fail(command.kind, "Snapshot verification failed after command execution");
  }
  return {
    ...executed,
    snapshot: sanitized.snapshot,
    repairSummary: sanitized.repairSummary,
    verification: {
      verified: true,
      details: [
        ...executed.verification.details,
        sanitized.repairSummary.status === "clean" ? "快照关系校验通过" : `快照已自动修复：${sanitized.repairSummary.status}`,
      ],
    },
  };
}
