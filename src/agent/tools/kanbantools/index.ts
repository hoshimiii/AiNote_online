import { z } from "zod";
import ToolExecutor, { type Tool } from "../toolExecutor";
import { useWorkSpace } from "@/store/kanban";
import { generateRandomId } from "@/components/utils/RandomGenerator";

type KanbanState = ReturnType<typeof useWorkSpace.getState>;

type WorkspaceRefInput = {
    workspaceId?: string;
    workspaceName?: string;
};

type MissionRefInput = {
    missionId?: string;
    missionTitle?: string;
};

type BoardRefInput = MissionRefInput & {
    boardId?: string;
    boardTitle?: string;
};

type TaskRefInput = BoardRefInput & {
    taskId?: string;
    taskTitle?: string;
};

type NoteRefInput = MissionRefInput & {
    noteId?: string;
    noteTitle?: string;
};

type SubTaskRefInput = TaskRefInput & {
    subTaskId?: string;
    subTaskTitle?: string;
};

type BlockRefInput = NoteRefInput & {
    blockId?: string;
    blockIndex?: number;
    blockPreview?: string;
};

const pickOne = <T>(items: T[], label: string) => {
    if (items.length === 0) throw new Error(`${label} not found`);
    if (items.length > 1) throw new Error(`${label} is ambiguous: ${JSON.stringify(items)}`);
    return items[0];
};

const resolveWorkspace = (state: KanbanState, input: WorkspaceRefInput, allowCurrent = true) => {
    if (input.workspaceId) {
        const workspace = state.workspaces.find((item) => item.workspaceId === input.workspaceId);
        if (!workspace) throw new Error(`Workspace ${input.workspaceId} not found`);
        return workspace;
    }
    if (input.workspaceName) {
        return pickOne(
            state.workspaces.filter((item) => item.workspaceName.trim().toLowerCase() === input.workspaceName?.trim().toLowerCase()),
            `Workspace ${input.workspaceName}`
        );
    }
    if (allowCurrent && state.activeWorkSpaceId) {
        return pickOne(state.workspaces.filter((item) => item.workspaceId === state.activeWorkSpaceId), "Current workspace");
    }
    throw new Error("Workspace context not found");
};

const resolveMissionId = (state: KanbanState, input: MissionRefInput, allowCurrent = true) => {
    if (input.missionId) return input.missionId;
    if (input.missionTitle) {
        return pickOne(state.findMissionByTitle(input.missionTitle), `Mission ${input.missionTitle}`).missionId;
    }
    if (allowCurrent) {
        const missionId = state.getCurrentContext().currentMissionId;
        if (missionId) return missionId;
    }
    throw new Error("Mission context not found");
};

const resolveBoard = (state: KanbanState, input: BoardRefInput) => {
    if (input.boardId) {
        const board = state.boards[input.boardId];
        if (!board) throw new Error(`Board ${input.boardId} not found`);
        return { missionId: board.MissionId, boardId: board.BoardId, title: board.title };
    }
    if (!input.boardTitle) throw new Error("boardId or boardTitle is required");
    const missionId = resolveMissionId(state, input);
    return pickOne(state.findBoardByTitle(input.boardTitle, missionId), `Board ${input.boardTitle}`);
};

const resolveTask = (state: KanbanState, input: TaskRefInput) => {
    if (input.taskId) {
        for (const board of Object.values(state.boards)) {
            const task = (board.Tasks || []).find((item) => item.TaskId === input.taskId);
            if (task) return { missionId: board.MissionId, boardId: board.BoardId, taskId: task.TaskId, title: task.title };
        }
        throw new Error(`Task ${input.taskId} not found`);
    }
    if (!input.taskTitle) throw new Error("taskId or taskTitle is required");
    const board = resolveBoard(state, input);
    return pickOne(state.findTaskByTitle(input.taskTitle, { missionId: board.missionId, boardId: board.boardId }), `Task ${input.taskTitle}`);
};

const resolveSubTask = (state: KanbanState, input: SubTaskRefInput) => {
    if (input.subTaskId) {
        for (const board of Object.values(state.boards)) {
            for (const task of board.Tasks || []) {
                const subTask = (task.subTasks || []).find((item) => item.subTaskId === input.subTaskId);
                if (subTask) {
                    return { missionId: board.MissionId, boardId: board.BoardId, taskId: task.TaskId, subTaskId: subTask.subTaskId, title: subTask.title };
                }
            }
        }
        throw new Error(`SubTask ${input.subTaskId} not found`);
    }
    if (!input.subTaskTitle) throw new Error("subTaskId or subTaskTitle is required");
    const task = resolveTask(state, input);
    return pickOne(
        state.findSubTaskByTitle(input.subTaskTitle, { missionId: task.missionId, boardId: task.boardId, taskId: task.taskId }),
        `SubTask ${input.subTaskTitle}`
    );
};

const resolveNote = (state: KanbanState, input: NoteRefInput, allowCurrent = true) => {
    if (input.noteId) {
        const snapshot = state.getNoteSnapshot(input.noteId);
        if (!snapshot) throw new Error(`Note ${input.noteId} not found`);
        return { missionId: snapshot.missionId, noteId: snapshot.noteId, noteTitle: snapshot.noteTitle };
    }
    if (input.noteTitle) {
        const missionId = resolveMissionId(state, input, allowCurrent);
        return pickOne(state.findNoteByTitle(input.noteTitle, missionId), `Note ${input.noteTitle}`);
    }
    if (allowCurrent) {
        const snapshot = state.getCurrentNoteSnapshot();
        if (snapshot) return { missionId: snapshot.missionId, noteId: snapshot.noteId, noteTitle: snapshot.noteTitle };
    }
    throw new Error("Note context not found");
};

const resolveBlock = (state: KanbanState, input: BlockRefInput) => {
    const note = resolveNote(state, input);
    const matches = state.findBlock({
        noteId: note.noteId,
        blockId: input.blockId,
        index: input.blockIndex,
        previewText: input.blockPreview,
    });
    return pickOne(matches, "Block");
};

const tools: Tool[] = [
    {
        name: "get_current_context",
        description: "Get current workspace, mission, note and preview context.",
        parameters: z.object({}),
        execute: async () => JSON.stringify(useWorkSpace.getState().getCurrentContext()),
    },
    {
        name: "list_workspaces",
        description: "List all workspaces with ids and names.",
        parameters: z.object({}),
        execute: async () => {
            const state = useWorkSpace.getState();
            return JSON.stringify(
                state.workspaces.map((workspace) => ({
                    workspaceId: workspace.workspaceId,
                    workspaceName: workspace.workspaceName,
                    isCurrent: workspace.workspaceId === state.activeWorkSpaceId,
                }))
            );
        },
    },
    {
        name: "set_active_workspace",
        description: "Set the current active workspace by id or name.",
        parameters: z.object({
            workspaceId: z.string().optional(),
            workspaceName: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const workspace = resolveWorkspace(state, raw as WorkspaceRefInput, false);
            state.setWorkSpace(workspace.workspaceId);
            return JSON.stringify(workspace);
        },
    },
    {
        name: "create_workspace",
        description: "Create a new workspace.",
        parameters: z.object({
            workspaceName: z.string().min(1),
        }),
        execute: async (raw) => {
            const { workspaceName } = raw as { workspaceName: string };
            const state = useWorkSpace.getState();
            const workspaceId = generateRandomId();
            state.createWorkSpace({ workspaceId, workspaceName });
            return JSON.stringify({ workspaceId, workspaceName });
        },
    },
    {
        name: "rename_workspace",
        description: "Rename a workspace by id or name.",
        parameters: z.object({
            workspaceId: z.string().optional(),
            workspaceName: z.string().optional(),
            newName: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as WorkspaceRefInput & { newName: string };
            const state = useWorkSpace.getState();
            const workspace = resolveWorkspace(state, input, false);
            state.RenameWorkSpace(workspace.workspaceId, input.newName);
            return JSON.stringify({ workspaceId: workspace.workspaceId, workspaceName: input.newName });
        },
    },
    {
        name: "delete_workspace",
        description: "Delete a workspace by id or name.",
        parameters: z.object({
            workspaceId: z.string().optional(),
            workspaceName: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const workspace = resolveWorkspace(state, raw as WorkspaceRefInput, false);
            state.deleteWorkSpace(workspace.workspaceId);
            return JSON.stringify(workspace);
        },
    },
    {
        name: "get_active_mission",
        description: "Get the current real mission instead of preview mission.",
        parameters: z.object({}),
        execute: async () => {
            const context = useWorkSpace.getState().getCurrentContext();
            return JSON.stringify({ currentMissionId: context.currentMissionId, currentMissionTitle: context.currentMissionTitle });
        },
    },
    {
        name: "set_active_mission",
        description: "Set the current real mission by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const missionId = resolveMissionId(state, raw as MissionRefInput, false);
            state.setMission(missionId);
            return JSON.stringify(state.getCurrentContext());
        },
    },
    {
        name: "list_missions",
        description: "List all missions in the current workspace.",
        parameters: z.object({}),
        execute: async () => {
            const state = useWorkSpace.getState();
            const ctx = state.getCurrentContext();
            const missions = Object.values(state.missions)
                .filter((mission) => mission.WorkSpaceId === state.activeWorkSpaceId)
                .map((mission) => ({
                    missionId: mission.MissionId,
                    title: mission.title,
                    isCurrent: mission.MissionId === ctx.currentMissionId,
                    isPreview: mission.MissionId === ctx.previewMissionId,
                }));
            return JSON.stringify(missions);
        },
    },
    {
        name: "find_mission",
        description: "Find missions by exact title.",
        parameters: z.object({ title: z.string().min(1) }),
        execute: async (raw) => JSON.stringify(useWorkSpace.getState().findMissionByTitle((raw as { title: string }).title)),
    },
    {
        name: "create_mission",
        description: "Create a mission in the current or specified workspace.",
        parameters: z.object({
            workspaceId: z.string().optional(),
            workspaceName: z.string().optional(),
            title: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as WorkspaceRefInput & { title: string };
            const state = useWorkSpace.getState();
            const workspace = resolveWorkspace(state, input);
            const missionId = generateRandomId();
            state.createMission({
                MissionId: missionId,
                WorkSpaceId: workspace.workspaceId,
                activeNoteId: null,
                title: input.title,
                Notes: [],
            });
            return JSON.stringify({ missionId, workspaceId: workspace.workspaceId, title: input.title });
        },
    },
    {
        name: "rename_mission",
        description: "Rename a mission by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            title: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as MissionRefInput & { title: string };
            const state = useWorkSpace.getState();
            const missionId = resolveMissionId(state, input, false);
            state.RenameMission(missionId, input.title);
            return JSON.stringify({ missionId, title: input.title });
        },
    },
    {
        name: "delete_mission",
        description: "Delete a mission by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const missionId = resolveMissionId(state, raw as MissionRefInput, false);
            state.deleteMission(missionId);
            return JSON.stringify({ missionId });
        },
    },
    {
        name: "get_current_mission_snapshot",
        description: "Get a structured snapshot of the current mission.",
        parameters: z.object({}),
        execute: async () => JSON.stringify(useWorkSpace.getState().getCurrentMissionSnapshot()),
    },
    {
        name: "get_mission_snapshot",
        description: "Get a structured mission snapshot by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const missionId = resolveMissionId(state, raw as MissionRefInput);
            return JSON.stringify(state.getMissionSnapshot(missionId));
        },
    },
    {
        name: "get_current_note_snapshot",
        description: "Get the full current note snapshot with all blocks.",
        parameters: z.object({}),
        execute: async () => JSON.stringify(useWorkSpace.getState().getCurrentNoteSnapshot()),
    },
    {
        name: "get_current_note_blocks",
        description: "Get all blocks in the current note.",
        parameters: z.object({}),
        execute: async () => JSON.stringify(useWorkSpace.getState().getCurrentNoteBlocks()),
    },
    {
        name: "get_note_snapshot",
        description: "Get the full note snapshot by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const note = resolveNote(state, raw as NoteRefInput);
            return JSON.stringify(state.getNoteSnapshot(note.noteId));
        },
    },
    {
        name: "set_active_note",
        description: "Set the current note by id or title inside a mission.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const note = resolveNote(state, raw as NoteRefInput, false);
            state.setActiveNote(note.missionId, note.noteId);
            return JSON.stringify(state.getCurrentContext());
        },
    },
    {
        name: "find_note",
        description: "Find notes by exact title.",
        parameters: z.object({
            title: z.string().min(1),
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const input = raw as { title: string } & MissionRefInput;
            const missionId = input.missionId || input.missionTitle ? resolveMissionId(state, input, false) : undefined;
            return JSON.stringify(state.findNoteByTitle(input.title, missionId));
        },
    },
    {
        name: "create_note",
        description: "Create a note in the current or specified mission.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            title: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as MissionRefInput & { title: string };
            const state = useWorkSpace.getState();
            const missionId = resolveMissionId(state, input);
            const note = state.createNote(missionId, {
                noteId: generateRandomId(),
                noteTitle: input.title,
                noteContent: "",
                noteCreatedAt: new Date().toISOString(),
                noteUpdatedAt: new Date().toISOString(),
                relatedTaskId: "",
                blocks: [],
            });
            return JSON.stringify({ missionId, noteId: note.noteId, noteTitle: input.title });
        },
    },
    {
        name: "rename_note",
        description: "Rename a note by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
            title: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as NoteRefInput & { title: string };
            const state = useWorkSpace.getState();
            const note = resolveNote(state, input);
            state.RenameNote(note.missionId, note.noteId, input.title);
            return JSON.stringify({ ...note, noteTitle: input.title });
        },
    },
    {
        name: "delete_note",
        description: "Delete a note by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const note = resolveNote(state, raw as NoteRefInput);
            state.deleteNote(note.missionId, note.noteId);
            return JSON.stringify(note);
        },
    },
    {
        name: "find_board",
        description: "Find boards by exact title.",
        parameters: z.object({
            title: z.string().min(1),
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const input = raw as { title: string } & MissionRefInput;
            const missionId = input.missionId || input.missionTitle ? resolveMissionId(state, input, false) : undefined;
            return JSON.stringify(state.findBoardByTitle(input.title, missionId));
        },
    },
    {
        name: "create_board",
        description: "Create a board in the current or specified mission.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            title: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as MissionRefInput & { title: string };
            const state = useWorkSpace.getState();
            const missionId = resolveMissionId(state, input);
            const boardId = generateRandomId();
            state.createBoard({ BoardId: boardId, MissionId: missionId, title: input.title, Tasks: [] });
            return JSON.stringify({ missionId, boardId, title: input.title });
        },
    },
    {
        name: "rename_board",
        description: "Rename a board by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            title: z.string().min(1),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const board = resolveBoard(state, raw as BoardRefInput);
            state.RenameBoard(board.boardId, (raw as { title: string }).title);
            return JSON.stringify({ ...board, title: (raw as { title: string }).title });
        },
    },
    {
        name: "delete_board",
        description: "Delete a board by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const board = resolveBoard(state, raw as BoardRefInput);
            state.deleteBoard(board.boardId);
            return JSON.stringify(board);
        },
    },
    {
        name: "find_task",
        description: "Find tasks by exact title.",
        parameters: z.object({
            title: z.string().min(1),
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const input = raw as { title: string } & BoardRefInput;
            const missionId = input.missionId || input.missionTitle ? resolveMissionId(state, input, false) : undefined;
            const boardId = input.boardId || input.boardTitle ? resolveBoard(state, input).boardId : undefined;
            return JSON.stringify(state.findTaskByTitle(input.title, { missionId, boardId }));
        },
    },
    {
        name: "create_task",
        description: "Create a task in a board.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            title: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as BoardRefInput & { title: string };
            const state = useWorkSpace.getState();
            const board = resolveBoard(state, input);
            const boardData = state.boards[board.boardId];
            const taskId = generateRandomId();
            state.updataBoard(board.boardId, [
                ...(boardData.Tasks || []),
                { TaskId: taskId, title: input.title, linkedNoteIds: "", subTasks: [] },
            ]);
            return JSON.stringify({ ...board, taskId, title: input.title });
        },
    },
    {
        name: "rename_task",
        description: "Rename a task by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            taskId: z.string().optional(),
            taskTitle: z.string().optional(),
            title: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as TaskRefInput & { title: string };
            const state = useWorkSpace.getState();
            const task = resolveTask(state, input);
            state.RenameTask(task.boardId, task.taskId, input.title);
            return JSON.stringify({ ...task, title: input.title });
        },
    },
    {
        name: "delete_task",
        description: "Delete a task by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            taskId: z.string().optional(),
            taskTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const task = resolveTask(state, raw as TaskRefInput);
            state.deleteTask(task.boardId, task.taskId);
            return JSON.stringify(task);
        },
    },
    {
        name: "find_subtask",
        description: "Find subtasks by exact title.",
        parameters: z.object({
            title: z.string().min(1),
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            taskId: z.string().optional(),
            taskTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const input = raw as { title: string } & TaskRefInput;
            const missionId = input.missionId || input.missionTitle ? resolveMissionId(state, input, false) : undefined;
            const boardId = input.boardId || input.boardTitle ? resolveBoard(state, input).boardId : undefined;
            const taskId = input.taskId || input.taskTitle ? resolveTask(state, input).taskId : undefined;
            return JSON.stringify(state.findSubTaskByTitle(input.title, { missionId, boardId, taskId }));
        },
    },
    {
        name: "create_subtask",
        description: "Create a subtask in a task.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            taskId: z.string().optional(),
            taskTitle: z.string().optional(),
            title: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as TaskRefInput & { title: string };
            const state = useWorkSpace.getState();
            const task = resolveTask(state, input);
            const subTaskId = generateRandomId();
            state.addSubTask(task.boardId, task.taskId, {
                subTaskId,
                title: input.title,
                completed: false,
                linkedNoteId: "",
                linkedBlockId: "",
            });
            return JSON.stringify({ ...task, subTaskId, title: input.title });
        },
    },
    {
        name: "rename_subtask",
        description: "Rename a subtask by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            taskId: z.string().optional(),
            taskTitle: z.string().optional(),
            subTaskId: z.string().optional(),
            subTaskTitle: z.string().optional(),
            title: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as SubTaskRefInput & { title: string };
            const state = useWorkSpace.getState();
            const subTask = resolveSubTask(state, input);
            state.renameSubTask(subTask.boardId, subTask.taskId, subTask.subTaskId, input.title);
            return JSON.stringify({ ...subTask, title: input.title });
        },
    },
    {
        name: "toggle_subtask",
        description: "Toggle a subtask completed state.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            taskId: z.string().optional(),
            taskTitle: z.string().optional(),
            subTaskId: z.string().optional(),
            subTaskTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const subTask = resolveSubTask(state, raw as SubTaskRefInput);
            state.toggleSubTask(subTask.boardId, subTask.taskId, subTask.subTaskId);
            return JSON.stringify(subTask);
        },
    },
    {
        name: "delete_subtask",
        description: "Delete a subtask by id or title.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            taskId: z.string().optional(),
            taskTitle: z.string().optional(),
            subTaskId: z.string().optional(),
            subTaskTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const subTask = resolveSubTask(state, raw as SubTaskRefInput);
            state.removeSubTask(subTask.boardId, subTask.taskId, subTask.subTaskId);
            return JSON.stringify(subTask);
        },
    },
    {
        name: "link_subtask",
        description: "Link a subtask to a note or a specific block.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            taskId: z.string().optional(),
            taskTitle: z.string().optional(),
            subTaskId: z.string().optional(),
            subTaskTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
            blockId: z.string().optional(),
            blockIndex: z.number().int().min(0).optional(),
            blockPreview: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const input = raw as SubTaskRefInput & BlockRefInput;
            const subTask = resolveSubTask(state, input);
            let noteId = "";
            let blockId = "";
            if (input.noteId || input.noteTitle) {
                const note = resolveNote(state, input, false);
                noteId = note.noteId;
                if (input.blockId || typeof input.blockIndex === "number" || input.blockPreview) {
                    blockId = resolveBlock(state, { ...input, noteId: note.noteId }).blockId;
                }
            }
            state.linkSubTask(subTask.boardId, subTask.taskId, subTask.subTaskId, noteId, blockId);
            return JSON.stringify({ ...subTask, noteId, blockId });
        },
    },
    {
        name: "find_block",
        description: "Find blocks by id, index, or preview text in a note.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
            blockId: z.string().optional(),
            blockIndex: z.number().int().min(0).optional(),
            blockPreview: z.string().optional(),
        }),
        execute: async (raw) => {
            const state = useWorkSpace.getState();
            const input = raw as BlockRefInput;
            const note = resolveNote(state, input);
            return JSON.stringify(state.findBlock({
                noteId: note.noteId,
                blockId: input.blockId,
                index: input.blockIndex,
                previewText: input.blockPreview,
            }));
        },
    },
    {
        name: "create_block",
        description: "Create a block in the current or specified note.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
            blockType: z.enum(["markdown", "code"]),
            content: z.string().default(""),
        }),
        execute: async (raw) => {
            const input = raw as NoteRefInput & { blockType: "markdown" | "code", content: string };
            const state = useWorkSpace.getState();
            const noteRef = resolveNote(state, input);
            const noteSnapshot = state.getNoteSnapshot(noteRef.noteId);
            if (!noteSnapshot) throw new Error(`Note ${noteRef.noteId} not found`);
            const mission = state.missions[noteSnapshot.missionId];
            const note = mission.Notes.find((item) => item.noteId === noteSnapshot.noteId);
            if (!note) throw new Error(`Note ${noteSnapshot.noteId} not found`);
            const block = state.createBlock(note, {
                blockId: generateRandomId(),
                blockType: input.blockType,
                blockContent: input.content,
                blockCreatedAt: new Date().toISOString(),
                blockUpdatedAt: new Date().toISOString(),
            });
            return JSON.stringify({ missionId: noteSnapshot.missionId, noteId: noteSnapshot.noteId, blockId: block.blockId, blockType: block.blockType });
        },
    },
    {
        name: "rename_block",
        description: "Rename block content by block id, index, or preview text.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
            blockId: z.string().optional(),
            blockIndex: z.number().int().min(0).optional(),
            blockPreview: z.string().optional(),
            content: z.string().min(1),
        }),
        execute: async (raw) => {
            const input = raw as BlockRefInput & { content: string };
            const state = useWorkSpace.getState();
            const note = resolveNote(state, input);
            const block = resolveBlock(state, input);
            const noteSnapshot = state.getNoteSnapshot(note.noteId);
            if (!noteSnapshot) throw new Error(`Note ${note.noteId} not found`);
            const mission = state.missions[noteSnapshot.missionId];
            const noteEntity = mission.Notes.find((item) => item.noteId === note.noteId);
            if (!noteEntity) throw new Error(`Note ${note.noteId} not found`);
            state.RenameBlock(noteEntity, block.blockId, input.content);
            return JSON.stringify({ ...block, content: input.content });
        },
    },
    {
        name: "update_block",
        description: "Update block content or type by block id, index, or preview text.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
            blockId: z.string().optional(),
            blockIndex: z.number().int().min(0).optional(),
            blockPreview: z.string().optional(),
            blockType: z.enum(["markdown", "code"]).optional(),
            content: z.string().optional(),
        }),
        execute: async (raw) => {
            const input = raw as BlockRefInput & { blockType?: "markdown" | "code", content?: string };
            const state = useWorkSpace.getState();
            const note = resolveNote(state, input);
            const block = resolveBlock(state, input);
            const noteSnapshot = state.getNoteSnapshot(note.noteId);
            if (!noteSnapshot) throw new Error(`Note ${note.noteId} not found`);
            const mission = state.missions[noteSnapshot.missionId];
            const noteEntity = mission.Notes.find((item) => item.noteId === note.noteId);
            if (!noteEntity) throw new Error(`Note ${note.noteId} not found`);
            const currentBlock = noteEntity.blocks.find((item) => item.blockId === block.blockId);
            if (!currentBlock) throw new Error(`Block ${block.blockId} not found`);
            const nextBlock = {
                ...currentBlock,
                blockUpdatedAt: new Date().toISOString(),
                ...(typeof input.blockType !== "undefined" ? { blockType: input.blockType } : {}),
                ...(typeof input.content !== "undefined" ? { blockContent: input.content } : {}),
            };
            state.updateBlock(noteEntity, block.blockId, nextBlock);
            return JSON.stringify({ ...block, noteId: note.noteId, blockType: input.blockType, content: input.content });
        },
    },
    {
        name: "insert_block",
        description: "Insert a block at a given position in a note.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
            index: z.number().int().min(0),
            blockType: z.enum(["markdown", "code"]),
            content: z.string().default(""),
        }),
        execute: async (raw) => {
            const input = raw as NoteRefInput & { index: number, blockType: "markdown" | "code", content: string };
            const state = useWorkSpace.getState();
            const note = resolveNote(state, input);
            const noteSnapshot = state.getNoteSnapshot(note.noteId);
            if (!noteSnapshot) throw new Error(`Note ${note.noteId} not found`);
            const mission = state.missions[noteSnapshot.missionId];
            const noteEntity = mission.Notes.find((item) => item.noteId === note.noteId);
            if (!noteEntity) throw new Error(`Note ${note.noteId} not found`);
            const block = state.insertBlock(noteEntity, input.index, {
                blockId: generateRandomId(),
                blockType: input.blockType,
                blockContent: input.content,
                blockCreatedAt: new Date().toISOString(),
                blockUpdatedAt: new Date().toISOString(),
            });
            return JSON.stringify({ missionId: noteSnapshot.missionId, noteId: note.noteId, blockId: block.blockId, index: input.index, blockType: input.blockType });
        },
    },
    {
        name: "delete_block",
        description: "Delete a block by id, index, or preview text.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
            blockId: z.string().optional(),
            blockIndex: z.number().int().min(0).optional(),
            blockPreview: z.string().optional(),
        }),
        execute: async (raw) => {
            const input = raw as BlockRefInput;
            const state = useWorkSpace.getState();
            const note = resolveNote(state, input);
            const block = resolveBlock(state, input);
            const noteSnapshot = state.getNoteSnapshot(note.noteId);
            if (!noteSnapshot) throw new Error(`Note ${note.noteId} not found`);
            const mission = state.missions[noteSnapshot.missionId];
            const noteEntity = mission.Notes.find((item) => item.noteId === note.noteId);
            if (!noteEntity) throw new Error(`Note ${note.noteId} not found`);
            state.deleteBlock(noteEntity, block.blockId);
            return JSON.stringify(block);
        },
    },
    {
        name: "link_block",
        description: "Link a block to a task or a subtask.",
        parameters: z.object({
            missionId: z.string().optional(),
            missionTitle: z.string().optional(),
            noteId: z.string().optional(),
            noteTitle: z.string().optional(),
            blockId: z.string().optional(),
            blockIndex: z.number().int().min(0).optional(),
            blockPreview: z.string().optional(),
            boardId: z.string().optional(),
            boardTitle: z.string().optional(),
            taskId: z.string().optional(),
            taskTitle: z.string().optional(),
            subTaskId: z.string().optional(),
            subTaskTitle: z.string().optional(),
        }),
        execute: async (raw) => {
            const input = raw as BlockRefInput & TaskRefInput & SubTaskRefInput;
            const state = useWorkSpace.getState();
            const note = resolveNote(state, input);
            const block = resolveBlock(state, input);
            const task = resolveTask(state, input);
            let subTaskId = "";
            if (input.subTaskId || input.subTaskTitle) {
                subTaskId = resolveSubTask(state, { ...input, boardId: task.boardId, taskId: task.taskId }).subTaskId;
            }
            state.linkBlock(note.missionId, note.noteId, block.blockId, task.boardId, task.taskId, subTaskId);
            return JSON.stringify({ noteId: note.noteId, blockId: block.blockId, boardId: task.boardId, taskId: task.taskId, subTaskId });
        },
    },
];

export const createKanbanToolExecutor = (): ToolExecutor => {
    const executor = new ToolExecutor();
    tools.forEach((tool) => executor.registerTool(tool));
    return executor;
};

export { tools as kanbanTools };
