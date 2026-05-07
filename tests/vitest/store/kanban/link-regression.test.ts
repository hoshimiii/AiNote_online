import { beforeEach, describe, expect, it } from "vitest";

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

const seedLinkState = () => {
    const ids = {
        workspace: "ws-study",
        mission: "mission-study",
        board: "board-study",
        task1: "task-alpha",
        task2: "task-beta",
        subTask1: "subtask-alpha",
        note1: "note-alpha",
        note2: "note-beta",
        block1: "block-alpha",
        block2: "block-beta",
    };

    const now = "2026-05-06T00:00:00.000Z";

    const subTask1: SubTask = {
        subTaskId: ids.subTask1,
        title: "Alpha SubTask",
        completed: false,
        linkedNoteId: ids.note1,
        linkedBlockId: ids.block1,
    };

    const task1: Task = {
        TaskId: ids.task1,
        title: "Alpha Task",
        linkedNoteIds: ids.note1,
        subTasks: [subTask1],
    };

    const task2: Task = {
        TaskId: ids.task2,
        title: "Beta Task",
        linkedNoteIds: ids.note2,
        subTasks: [],
    };

    const block1: Block = {
        blockId: ids.block1,
        blockType: "markdown",
        blockContent: "Alpha block",
        blockCreatedAt: now,
        blockUpdatedAt: now,
        linkedBoardId: ids.board,
        linkedTaskId: ids.task1,
        linkedSubTaskId: ids.subTask1,
    };

    const block2: Block = {
        blockId: ids.block2,
        blockType: "markdown",
        blockContent: "Beta block",
        blockCreatedAt: now,
        blockUpdatedAt: now,
        linkedBoardId: "",
        linkedTaskId: "",
        linkedSubTaskId: "",
    };

    const note1: Note = {
        noteId: ids.note1,
        noteTitle: "Alpha note",
        noteContent: "",
        noteCreatedAt: now,
        noteUpdatedAt: now,
        relatedTaskId: ids.task1,
        blocks: [block1],
    };

    const note2: Note = {
        noteId: ids.note2,
        noteTitle: "Beta note",
        noteContent: "",
        noteCreatedAt: now,
        noteUpdatedAt: now,
        relatedTaskId: ids.task2,
        blocks: [block2],
    };

    const board: Board = {
        BoardId: ids.board,
        MissionId: ids.mission,
        title: "Study board",
        Tasks: [task1, task2],
    };

    const mission: Mission = {
        MissionId: ids.mission,
        WorkSpaceId: ids.workspace,
        activeNoteId: ids.note1,
        title: "Study mission",
        Notes: [note1, note2],
    };

    useWorkSpace.setState((state) => ({
        ...state,
        workspaces: [{ workspaceId: ids.workspace, workspaceName: "study" }],
        activeWorkSpaceId: ids.workspace,
        activeMissionId: ids.mission,
        currentMissionId: ids.mission,
        currentNoteId: ids.note1,
        previewMissionId: null,
        missionOrder: { [ids.workspace]: [ids.mission] },
        boardOrder: { [ids.mission]: [ids.board] },
        missions: { [ids.mission]: mission },
        boards: { [ids.board]: board },
        tasks: {
            [ids.task1]: task1,
            [ids.task2]: task2,
        },
    }));

    return ids;
};

const getMission = (missionId: string) => useWorkSpace.getState().missions[missionId];
const getBoard = (boardId: string) => useWorkSpace.getState().boards[boardId];
const getTask = (boardId: string, taskId: string) => getBoard(boardId)?.Tasks.find((task) => task.TaskId === taskId);
const getSubTask = (boardId: string, taskId: string, subTaskId: string) => getTask(boardId, taskId)?.subTasks.find((subTask) => subTask.subTaskId === subTaskId);
const getNote = (missionId: string, noteId: string) => getMission(missionId)?.Notes.find((note) => note.noteId === noteId);
const getBlock = (missionId: string, noteId: string, blockId: string) => getNote(missionId, noteId)?.blocks.find((block) => block.blockId === blockId);

beforeEach(() => {
    resetStore();
});

describe("kanban link regression", () => {
    it("setNoteTaskLink moves a note to a new task and clears the old mirrored note owner", () => {
        const ids = seedLinkState();

        useWorkSpace.getState().setNoteTaskLink(ids.mission, ids.note1, ids.task2);

        expect(getNote(ids.mission, ids.note1)?.relatedTaskId).toBe(ids.task2);
        expect(getNote(ids.mission, ids.note2)?.relatedTaskId).toBe("");
        expect(getTask(ids.board, ids.task1)?.linkedNoteIds).toBe("");
        expect(getTask(ids.board, ids.task2)?.linkedNoteIds).toBe(ids.note1);
        expect(useWorkSpace.getState().tasks[ids.task2]?.linkedNoteIds).toBe(ids.note1);
    });

    it("setNoteTaskLink clears both sides when the task link is removed", () => {
        const ids = seedLinkState();

        useWorkSpace.getState().setNoteTaskLink(ids.mission, ids.note1, "");

        expect(getNote(ids.mission, ids.note1)?.relatedTaskId).toBe("");
        expect(getTask(ids.board, ids.task1)?.linkedNoteIds).toBe("");
        expect(useWorkSpace.getState().tasks[ids.task1]?.linkedNoteIds).toBe("");
    });

    it("linkBlock moves the subtask reverse link to the new block and clears the previous block pointer", () => {
        const ids = seedLinkState();

        useWorkSpace.getState().linkBlock(ids.mission, ids.note2, ids.block2, ids.board, ids.task1, ids.subTask1);

        expect(getSubTask(ids.board, ids.task1, ids.subTask1)).toMatchObject({
            linkedNoteId: ids.note2,
            linkedBlockId: ids.block2,
        });
        expect(getBlock(ids.mission, ids.note1, ids.block1)).toMatchObject({
            linkedBoardId: ids.board,
            linkedTaskId: ids.task1,
            linkedSubTaskId: "",
        });
        expect(getBlock(ids.mission, ids.note2, ids.block2)).toMatchObject({
            linkedBoardId: ids.board,
            linkedTaskId: ids.task1,
            linkedSubTaskId: ids.subTask1,
        });
    });

    it("linkSubTask can keep a note-only link while clearing the previous block reverse pointer", () => {
        const ids = seedLinkState();

        useWorkSpace.getState().linkSubTask(ids.board, ids.task1, ids.subTask1, ids.note2, "");

        expect(getSubTask(ids.board, ids.task1, ids.subTask1)).toMatchObject({
            linkedNoteId: ids.note2,
            linkedBlockId: "",
        });
        expect(getBlock(ids.mission, ids.note1, ids.block1)).toMatchObject({
            linkedBoardId: ids.board,
            linkedTaskId: ids.task1,
            linkedSubTaskId: "",
        });
    });
});
