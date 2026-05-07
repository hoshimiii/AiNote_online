import { beforeEach, describe, expect, it } from "vitest";

import { kanbanTools } from "@/agent/tools/kanbantools";
import { type Block, type Board, type Mission, type Note, type SubTask, type Task, useWorkSpace } from "@/store/kanban";

const resetStore = () => {
    localStorage.clear();
    useWorkSpace.setState((state) => ({
        ...state,
        workspaces: [],
        activeWorkSpaceId: null,
        activeMissionId: null,
        currentMissionId: null,
        currentNoteId: null,
        previewMissionId: null,
        _cloudSyncTime: null,
        missionOrder: {},
        boardOrder: {},
        missions: {},
        boards: {},
        tasks: {},
    }));
};

const makeSeed = () => {
    const ids = {
        ws1: "ws-study",
        ws2: "ws-archive",
        mission1: "mission-study",
        mission2: "mission-archive",
        board1: "board-study",
        board2: "board-archive",
        task1: "task-study",
        task2: "task-archive",
        subTask1: "subtask-study",
        subTask2: "subtask-archive",
        note1: "note-study",
        note2: "note-archive",
        block1: "block-study",
        block2: "block-archive",
    };

    const now = "2026-05-06T00:00:00.000Z";

    const studyBlock: Block = {
        blockId: ids.block1,
        blockType: "markdown",
        blockContent: "study block",
        blockCreatedAt: now,
        blockUpdatedAt: now,
        linkedBoardId: ids.board1,
        linkedTaskId: ids.task1,
        linkedSubTaskId: ids.subTask1,
    };

    const archiveBlock: Block = {
        blockId: ids.block2,
        blockType: "markdown",
        blockContent: "archive block",
        blockCreatedAt: now,
        blockUpdatedAt: now,
    };

    const studyNote: Note = {
        noteId: ids.note1,
        noteTitle: "Study note",
        noteContent: "",
        noteCreatedAt: now,
        noteUpdatedAt: now,
        relatedTaskId: ids.task1,
        blocks: [studyBlock],
    };

    const archiveNote: Note = {
        noteId: ids.note2,
        noteTitle: "Archive note",
        noteContent: "",
        noteCreatedAt: now,
        noteUpdatedAt: now,
        relatedTaskId: "",
        blocks: [archiveBlock],
    };

    const studySubTask: SubTask = {
        subTaskId: ids.subTask1,
        title: "Study subtask",
        completed: false,
        linkedNoteId: ids.note1,
        linkedBlockId: ids.block1,
    };

    const archiveSubTask: SubTask = {
        subTaskId: ids.subTask2,
        title: "Archive subtask",
        completed: false,
        linkedNoteId: ids.note1,
        linkedBlockId: ids.block1,
    };

    const studyTask: Task = {
        TaskId: ids.task1,
        title: "Study task",
        linkedNoteIds: ids.note1,
        subTasks: [studySubTask],
    };

    const archiveTask: Task = {
        TaskId: ids.task2,
        title: "Archive task",
        linkedNoteIds: ids.note1,
        subTasks: [archiveSubTask],
    };

    const studyBoard: Board = {
        BoardId: ids.board1,
        MissionId: ids.mission1,
        title: "Study board",
        Tasks: [studyTask],
    };

    const archiveBoard: Board = {
        BoardId: ids.board2,
        MissionId: ids.mission2,
        title: "Archive board",
        Tasks: [archiveTask],
    };

    const studyMission: Mission = {
        MissionId: ids.mission1,
        WorkSpaceId: ids.ws1,
        activeNoteId: ids.note1,
        title: "Study mission",
        Notes: [studyNote],
    };

    const archiveMission: Mission = {
        MissionId: ids.mission2,
        WorkSpaceId: ids.ws2,
        activeNoteId: ids.note2,
        title: "Archive mission",
        Notes: [archiveNote],
    };

    return {
        ids,
        state: {
            workspaces: [
                { workspaceId: ids.ws1, workspaceName: "study" },
                { workspaceId: ids.ws2, workspaceName: "archive" },
            ],
            activeWorkSpaceId: ids.ws1,
            activeMissionId: ids.mission1,
            currentMissionId: ids.mission1,
            currentNoteId: ids.note1,
            previewMissionId: ids.mission1,
            missionOrder: {
                [ids.ws1]: [ids.mission1],
                [ids.ws2]: [ids.mission2],
            },
            boardOrder: {
                [ids.mission1]: [ids.board1],
                [ids.mission2]: [ids.board2],
            },
            missions: {
                [ids.mission1]: studyMission,
                [ids.mission2]: archiveMission,
            },
            boards: {
                [ids.board1]: studyBoard,
                [ids.board2]: archiveBoard,
            },
            tasks: {
                [ids.task1]: studyTask,
                [ids.task2]: archiveTask,
            },
        },
    };
};

const seedStore = () => {
    const seed = makeSeed();
    useWorkSpace.setState((state) => ({
        ...state,
        ...seed.state,
    }));
    return seed.ids;
};

const getTask = (boardId: string, taskId: string) =>
    useWorkSpace.getState().boards[boardId]?.Tasks.find((task) => task.TaskId === taskId);

const getSubTask = (boardId: string, taskId: string, subTaskId: string) =>
    getTask(boardId, taskId)?.subTasks.find((subTask) => subTask.subTaskId === subTaskId);

const getNote = (missionId: string, noteId: string) =>
    useWorkSpace.getState().missions[missionId]?.Notes.find((note) => note.noteId === noteId);

beforeEach(() => {
    resetStore();
});

describe("kanban deletion regression", () => {
    it("deleteTask removes the task and clears note/block references", () => {
        const ids = seedStore();

        useWorkSpace.getState().deleteTask(ids.board1, ids.task1);

        const state = useWorkSpace.getState();
        expect(getTask(ids.board1, ids.task1)).toBeUndefined();
        expect(state.tasks[ids.task1]).toBeUndefined();

        const note = getNote(ids.mission1, ids.note1);
        expect(note?.relatedTaskId).toBe("");
        expect(note?.blocks[0]).toMatchObject({
            linkedBoardId: "",
            linkedTaskId: "",
            linkedSubTaskId: "",
        });
    });

    it("removeSubTask clears linkedSubTaskId on affected note blocks", () => {
        const ids = seedStore();

        useWorkSpace.getState().removeSubTask(ids.board1, ids.task1, ids.subTask1);

        expect(getSubTask(ids.board1, ids.task1, ids.subTask1)).toBeUndefined();
        const note = getNote(ids.mission1, ids.note1);
        expect(note?.blocks[0]).toMatchObject({
            linkedBoardId: ids.board1,
            linkedTaskId: ids.task1,
            linkedSubTaskId: "",
        });
    });

    it("deleteBoard removes descendants and clears note/task links", () => {
        const ids = seedStore();

        useWorkSpace.getState().deleteBoard(ids.board1);

        const state = useWorkSpace.getState();
        expect(state.boards[ids.board1]).toBeUndefined();
        expect(state.tasks[ids.task1]).toBeUndefined();
        expect(state.boardOrder[ids.mission1]).toEqual([]);

        const note = getNote(ids.mission1, ids.note1);
        expect(note?.relatedTaskId).toBe("");
        expect(note?.blocks[0]).toMatchObject({
            linkedBoardId: "",
            linkedTaskId: "",
            linkedSubTaskId: "",
        });
    });

    it("deleteNote clears backlinks from tasks and subtasks across boards", () => {
        const ids = seedStore();

        useWorkSpace.getState().deleteNote(ids.mission1, ids.note1);

        const state = useWorkSpace.getState();
        expect(getNote(ids.mission1, ids.note1)).toBeUndefined();
        expect(state.currentNoteId).toBeNull();
        expect(getTask(ids.board1, ids.task1)?.linkedNoteIds).toBe("");
        expect(getSubTask(ids.board1, ids.task1, ids.subTask1)).toMatchObject({
            linkedNoteId: "",
            linkedBlockId: "",
        });
        expect(getTask(ids.board2, ids.task2)?.linkedNoteIds).toBe("");
        expect(getSubTask(ids.board2, ids.task2, ids.subTask2)).toMatchObject({
            linkedNoteId: "",
            linkedBlockId: "",
        });
    });

    it("deleteBlock clears linkedBlockId but preserves linkedNoteId", () => {
        const ids = seedStore();
        const note = getNote(ids.mission1, ids.note1);
        expect(note).toBeDefined();

        useWorkSpace.getState().deleteBlock(ids.mission1, note!, ids.block1);

        expect(getNote(ids.mission1, ids.note1)?.blocks).toEqual([]);
        expect(getSubTask(ids.board1, ids.task1, ids.subTask1)).toMatchObject({
            linkedNoteId: ids.note1,
            linkedBlockId: "",
        });
        expect(getSubTask(ids.board2, ids.task2, ids.subTask2)).toMatchObject({
            linkedNoteId: ids.note1,
            linkedBlockId: "",
        });
    });

    it("deleteMission removes descendants and clears external note links", () => {
        const ids = seedStore();

        useWorkSpace.getState().deleteMission(ids.mission1);

        const state = useWorkSpace.getState();
        expect(state.missions[ids.mission1]).toBeUndefined();
        expect(state.boards[ids.board1]).toBeUndefined();
        expect(state.tasks[ids.task1]).toBeUndefined();
        expect(state.missionOrder[ids.ws1]).toEqual([]);
        expect(state.boardOrder[ids.mission1]).toBeUndefined();
        expect(state.currentMissionId).toBeNull();
        expect(state.currentNoteId).toBeNull();
        expect(getTask(ids.board2, ids.task2)?.linkedNoteIds).toBe("");
        expect(getSubTask(ids.board2, ids.task2, ids.subTask2)).toMatchObject({
            linkedNoteId: "",
            linkedBlockId: "",
        });
    });

    it("delete_workspace tool resolves by name and cascades cleanup", async () => {
        const ids = seedStore();
        const deleteWorkspaceTool = kanbanTools.find((tool) => tool.name === "delete_workspace");
        expect(deleteWorkspaceTool).toBeDefined();

        await deleteWorkspaceTool!.execute({ workspaceName: "study" });

        const state = useWorkSpace.getState();
        expect(state.workspaces.map((workspace) => workspace.workspaceId)).toEqual([ids.ws2]);
        expect(state.activeWorkSpaceId).toBeNull();
        expect(state.missions[ids.mission1]).toBeUndefined();
        expect(state.boards[ids.board1]).toBeUndefined();
        expect(state.tasks[ids.task1]).toBeUndefined();
        expect(state.missionOrder[ids.ws1]).toBeUndefined();
        expect(state.boardOrder[ids.mission1]).toBeUndefined();
        expect(getTask(ids.board2, ids.task2)?.linkedNoteIds).toBe("");
        expect(getSubTask(ids.board2, ids.task2, ids.subTask2)).toMatchObject({
            linkedNoteId: "",
            linkedBlockId: "",
        });
    });
});