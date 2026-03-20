import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SubTask = {
    subTaskId: string;
    title: string;
    completed: boolean;
    linkedNoteId: string;
    linkedBlockId: string;
}

export type Mission = {
    MissionId: string,
    WorkSpaceId: string,
    activeNoteId: string | null,
    title: string,
    Notes: Note[],
}

export type Note = {
    noteId: string;
    noteTitle: string;
    noteContent: string;
    noteCreatedAt: string;
    noteUpdatedAt: string;
    relatedTaskId: string;
    blocks: Block[];
}

export type Block = {
    blockId: string;
    blockType: string;
    blockContent: string;
    blockCreatedAt: string;
    blockUpdatedAt: string;
    linkedBoardId?: string;
    linkedTaskId?: string;
    linkedSubTaskId?: string;
}

export type Board = {
    BoardId: string,
    MissionId: string,
    title: string,
    Tasks: Task[],
}

export type Task = {
    TaskId: string,
    title: string,
    linkedNoteIds: string,
    subTasks: SubTask[],
}

type WorkSpace = {
    workspaceId: string,
    workspaceName: string,
}

export type CurrentContextSnapshot = {
    activeWorkSpaceId: string | null,
    currentMissionId: string | null,
    currentMissionTitle: string | null,
    currentNoteId: string | null,
    currentNoteTitle: string | null,
    previewMissionId: string | null,
    effectiveMissionId: string | null,
}

export type NoteBlockSnapshot = Block & {
    index: number,
    preview: string,
}

export type NoteSnapshot = {
    missionId: string,
    noteId: string,
    noteTitle: string,
    relatedTaskId: string,
    blocks: NoteBlockSnapshot[],
}

export type MissionSnapshot = {
    missionId: string,
    title: string,
    boards: (Board & {
        tasks: (Task & { subTaskCount: number })[],
    })[],
    notes: {
        noteId: string,
        noteTitle: string,
        relatedTaskId: string,
        blockCount: number,
    }[],
}

interface WorkSpaceProps {
    workspaces: WorkSpace[],
    activeWorkSpaceId: string | null,
    activeMissionId: string | null,
    currentMissionId: string | null,
    currentNoteId: string | null,
    previewMissionId: string | null,

    missionOrder: Record<string, string[]>,
    boardOrder: Record<string, string[]>,

    missions: Record<string, Mission>,
    boards: Record<string, Board>,
    tasks: Record<string, Task>,

    createWorkSpace: (WorkSpace: WorkSpace) => void,
    setWorkSpace: (WorkSpaceId: string | null) => void,
    deleteWorkSpace: (WorkSpaceId: string) => void,
    RenameWorkSpace: (WorkSpaceId: string, newName: string) => void

    createMission: (Mission: Mission) => void,
    setMission: (MissionId: string | null) => void,
    setPreviewMission: (MissionId: string | null) => void,
    clearPreviewMission: () => void,
    deleteMission: (MissionId: string) => void,
    RenameMission: (MissionId: string, newName: string) => void,
    setMissionNotes: (MissionId: string, notes: Note[]) => void,
    addNotesToMission: (MissionId: string, newNote: Note) => void,
    removeNotesFromMission: (MissionId: string, noteIds: string[]) => void,
    updateNotesInMission: (MissionId: string, noteId: string, newNote: Note) => void,
    reorderMissions: (workspaceId: string, orderedIds: string[]) => void,

    createBoard: (Board: Board) => void,
    deleteBoard: (BoardId: string) => void,
    RenameBoard: (BoardId: string, newName: string) => void,
    updataBoard: (BoardId: string, newTask: Task[]) => void,
    moveBoard: (boardId: string, sourceMissionId: string, targetMissionId: string) => void,
    reorderBoards: (missionId: string, orderedIds: string[]) => void,

    createTask: (Task: Task) => void,
    deleteTask: (BoardId: string, TaskId: string) => void,
    RenameTask: (BoardId: string, TaskId: string, newName: string) => void,
    moveTask: (taskId: string, sourceBoardId: string, targetBoardId: string, targetIndex?: number) => void,
    reorderTasks: (boardId: string, orderedIds: string[]) => void,
    setLinkedNoteIds: (boardId: string, taskId: string, linkedNoteIds: string) => void,

    addSubTask: (boardId: string, taskId: string, subTask: SubTask) => void,
    removeSubTask: (boardId: string, taskId: string, subTaskId: string) => void,
    toggleSubTask: (boardId: string, taskId: string, subTaskId: string) => void,
    renameSubTask: (boardId: string, taskId: string, subTaskId: string, newTitle: string) => void,
    linkSubTask: (boardId: string, taskId: string, subTaskId: string, noteId: string, blockId: string) => void,
    linkBlock: (activeMissionId: string, noteId: string, blockId: string, boardId: string, taskId: string, subTaskId: string) => void,

    setActiveNote: (activeMissionId: string, noteId: string | null) => void,
    createNote: (activeMissionId: string, newNote: Note) => Note,
    deleteNote: (activeMissionId: string, noteId: string) => void,
    RenameNote: (activeMissionId: string, noteId: string, newName: string) => void,
    updateNote: (activeMissionId: string, noteId: string, newNote: Note) => void,

    createBlock: (note: Note, newBlock: Block) => Block,
    insertBlock: (note: Note, index: number, newBlock: Block) => Block,
    deleteBlock: (note: Note, blockId: string) => void,
    RenameBlock: (note: Note, blockId: string, newName: string) => void,
    updateBlock: (note: Note, blockId: string, newBlock: Block) => void,

    getCurrentContext: () => CurrentContextSnapshot,
    getMissionSnapshot: (missionId: string) => MissionSnapshot | null,
    getCurrentMissionSnapshot: () => MissionSnapshot | null,
    getNoteSnapshot: (noteId: string) => NoteSnapshot | null,
    getCurrentNoteSnapshot: () => NoteSnapshot | null,
    getNoteBlocks: (noteId: string) => NoteBlockSnapshot[],
    getCurrentNoteBlocks: () => NoteBlockSnapshot[],
    findMissionByTitle: (title: string) => { missionId: string, title: string }[],
    findBoardByTitle: (title: string, missionId?: string | null) => { missionId: string, boardId: string, title: string }[],
    findTaskByTitle: (title: string, options?: { missionId?: string | null, boardId?: string | null }) => { missionId: string, boardId: string, taskId: string, title: string }[],
    findSubTaskByTitle: (title: string, options?: { missionId?: string | null, boardId?: string | null, taskId?: string | null }) => { missionId: string, boardId: string, taskId: string, subTaskId: string, title: string }[],
    findNoteByTitle: (title: string, missionId?: string | null) => { missionId: string, noteId: string, noteTitle: string }[],
    findBlock: (options: { noteId: string, blockId?: string, index?: number, previewText?: string }) => { missionId: string, noteId: string, blockId: string, index: number, blockType: string, preview: string }[],
}

const normalizeText = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const getBlockPreview = (content: string) => {
    const text = content.replace(/\s+/g, " ").trim();
    return text.length > 80 ? text.slice(0, 80) : text;
};

const getOrderedBoards = (state: any, missionId: string) => {
    const orderedBoardIds = state.boardOrder[missionId] ?? [];
    const boardMap = Object.fromEntries(
        Object.values(state.boards).filter((b: any) => b.MissionId === missionId).map((b: any) => [b.BoardId, b])
    );
    const orderedBoards = orderedBoardIds.map((id: string) => boardMap[id]).filter(Boolean);
    const fallbackBoards = Object.values(state.boards).filter((b: any) => b.MissionId === missionId && !orderedBoardIds.includes(b.BoardId));
    return [...orderedBoards, ...fallbackBoards];
};

const buildNoteSnapshotFromState = (state: any, noteId: string): NoteSnapshot | null => {
    for (const missionId of Object.keys(state.missions || {})) {
        const mission = state.missions[missionId];
        const note = (mission.Notes || []).find((item: Note) => item.noteId === noteId);
        if (!note) continue;
        return {
            missionId,
            noteId: note.noteId,
            noteTitle: note.noteTitle,
            relatedTaskId: note.relatedTaskId,
            blocks: (note.blocks || []).map((block: Block, index: number) => ({
                ...block,
                index,
                preview: getBlockPreview(block.blockContent),
            })),
        };
    }
    return null;
};

const buildNoteBlocksFromState = (state: any, noteId: string): NoteBlockSnapshot[] => {
    return buildNoteSnapshotFromState(state, noteId)?.blocks ?? [];
};

const buildMissionSnapshotFromState = (state: any, missionId: string): MissionSnapshot | null => {
    const mission = state.missions?.[missionId];
    if (!mission) return null;
    const boards = getOrderedBoards(state, missionId).map((board: Board) => ({
        ...board,
        tasks: (board.Tasks || []).map((task) => ({
            ...task,
            subTasks: task.subTasks || [],
            subTaskCount: (task.subTasks || []).length,
        })),
    }));
    const notes = (mission.Notes || []).map((note: Note) => ({
        noteId: note.noteId,
        noteTitle: note.noteTitle,
        relatedTaskId: note.relatedTaskId,
        blockCount: (note.blocks || []).length,
    }));
    return {
        missionId,
        title: mission.title,
        boards,
        notes,
    };
};


export const useWorkSpace = create<WorkSpaceProps>()(
    persist(
        (set, get) => ({
            workspaces: [],
            activeWorkSpaceId: null,
            activeMissionId: null,
            currentMissionId: null,
            currentNoteId: null,
            previewMissionId: null,
            activeNoteId: null,
            missionOrder: {},
            boardOrder: {},
            missions: {},
            boards: {},
            tasks: {},

            createWorkSpace: (workspace) => {
                set((state) => ({ workspaces: [...state.workspaces, workspace] }));
            },

            setWorkSpace: (workspaceId) => {
                set((state) => {
                    const currentMission = state.currentMissionId ? state.missions[state.currentMissionId] : null;
                    const keepCurrentMission = !!workspaceId && currentMission?.WorkSpaceId === workspaceId;
                    return {
                        activeWorkSpaceId: workspaceId,
                        activeMissionId: keepCurrentMission ? state.activeMissionId : null,
                        currentMissionId: keepCurrentMission ? state.currentMissionId : null,
                        currentNoteId: keepCurrentMission ? state.currentNoteId : null,
                        previewMissionId: null,
                    };
                });
            },
            deleteWorkSpace: (workspaceId) => {
                set((state) => {
                    // 1. 过滤掉目标空间
                    const nextWorkspaces = state.workspaces.filter(w => w.workspaceId !== workspaceId);

                    // 2. 如果删掉的是当前选中的空间，把 activeWorkspaceId 重置为 null (回到列表页)
                    const nextActiveId = state.activeWorkSpaceId === workspaceId ? null : state.activeWorkSpaceId;
                    const nextMissionOrder = { ...state.missionOrder };
                    delete nextMissionOrder[workspaceId];
                    return {
                        workspaces: nextWorkspaces,
                        activeWorkSpaceId: nextActiveId,
                        activeMissionId: state.activeWorkSpaceId === workspaceId ? null : state.activeMissionId,
                        currentMissionId: state.activeWorkSpaceId === workspaceId ? null : state.currentMissionId,
                        currentNoteId: state.activeWorkSpaceId === workspaceId ? null : state.currentNoteId,
                        previewMissionId: state.activeWorkSpaceId === workspaceId ? null : state.previewMissionId,
                        missionOrder: nextMissionOrder,
                    };
                });
            },
            RenameWorkSpace: (workspaceId, newName) => {
                set((state) => ({
                    workspaces: state.workspaces.map((w) =>
                        w.workspaceId === workspaceId ? { ...w, workspaceName: newName } : w
                    )
                }));
            },


            createMission: (mission) => {
                set((state) => {
                    const prevOrder = state.missionOrder[mission.WorkSpaceId] ?? [];
                    return {
                        missions: { ...state.missions, [mission.MissionId]: mission },
                        missionOrder: {
                            ...state.missionOrder,
                            [mission.WorkSpaceId]: [...prevOrder, mission.MissionId],
                        },
                    };
                });
            },
            setMission: (missionId) => {
                set({
                    activeMissionId: missionId,
                    currentMissionId: missionId,
                    currentNoteId: null,
                    previewMissionId: null,
                });
            },
            setPreviewMission: (missionId) => {
                set((state) => ({
                    previewMissionId: missionId,
                    activeMissionId: missionId ?? state.currentMissionId,
                }));
            },
            clearPreviewMission: () => {
                set((state) => ({
                    previewMissionId: null,
                    activeMissionId: state.currentMissionId,
                }));
            },
            deleteMission: (missionId) => {
                set((state) => {
                    const mission = state.missions[missionId];
                    const wsId = mission?.WorkSpaceId;
                    const nextMissionOrder = wsId
                        ? { ...state.missionOrder, [wsId]: (state.missionOrder[wsId] ?? []).filter(id => id !== missionId) }
                        : state.missionOrder;
                    return {
                        missions: Object.fromEntries(Object.entries(state.missions).filter(([id]) => id !== missionId)),
                        missionOrder: nextMissionOrder,
                        activeMissionId: state.activeMissionId === missionId ? null : state.activeMissionId,
                        currentMissionId: state.currentMissionId === missionId ? null : state.currentMissionId,
                        currentNoteId: state.currentMissionId === missionId ? null : state.currentNoteId,
                        previewMissionId: state.previewMissionId === missionId ? null : state.previewMissionId,
                    };
                });
            },
            RenameMission: (missionId, newName) => {
                set((state) => ({ missions: { ...state.missions, [missionId]: { ...state.missions[missionId], title: newName } } }));
            },
            reorderMissions: (workspaceId, orderedIds) => {
                set((state) => ({
                    missionOrder: { ...state.missionOrder, [workspaceId]: orderedIds },
                }));
            },

            setMissionNotes: (missionId, notes) => {
                set((state) => ({ missions: { ...state.missions, [missionId]: { ...state.missions[missionId], Notes: notes } } }));
            },

            addNotesToMission: (missionId, newNote) => {
                set((state) => ({ missions: { ...state.missions, [missionId]: { ...state.missions[missionId], Notes: [...(state.missions[missionId].Notes ?? []), newNote] } } }));
            },
            removeNotesFromMission: (missionId, noteIds) => {
                set((state) => ({ missions: { ...state.missions, [missionId]: { ...state.missions[missionId], Notes: (state.missions[missionId].Notes ?? []).filter(n => !noteIds.includes(n.noteId)) } } }));
            },
            updateNotesInMission: (missionId, noteId, newNote) => {
                set((state) => ({ missions: { ...state.missions, [missionId]: { ...state.missions[missionId], Notes: (state.missions[missionId].Notes ?? []).map(n => n.noteId === noteId ? { ...n, newNote } : n) } } }));
            },


            setActiveNote: (activeMissionId, noteId) => {
                set((state) => ({
                    activeMissionId,
                    currentMissionId: activeMissionId,
                    currentNoteId: noteId,
                    previewMissionId: null,
                    missions: { ...state.missions, [activeMissionId]: { ...state.missions[activeMissionId], activeNoteId: noteId } }
                }));
            },

            createBoard: (board) => {
                set((state) => {
                    const prevOrder = state.boardOrder[board.MissionId] ?? [];
                    return {
                        boards: { ...state.boards, [board.BoardId]: board },
                        boardOrder: {
                            ...state.boardOrder,
                            [board.MissionId]: [...prevOrder, board.BoardId],
                        },
                    };
                });
            },
            deleteBoard: (boardId) => {
                set((state) => {
                    const board = state.boards[boardId];
                    const mId = board?.MissionId;
                    const nextBoardOrder = mId
                        ? { ...state.boardOrder, [mId]: (state.boardOrder[mId] ?? []).filter(id => id !== boardId) }
                        : state.boardOrder;
                    return {
                        boards: Object.fromEntries(Object.entries(state.boards).filter(([id]) => id !== boardId)),
                        boardOrder: nextBoardOrder,
                    };
                });
            },
            RenameBoard: (boardId, newName) => {
                set((state) => ({ boards: { ...state.boards, [boardId]: { ...state.boards[boardId], title: newName } } }));
            },
            updataBoard: (boardId, newTask) => {
                set((state) => ({ boards: { ...state.boards, [boardId]: { ...state.boards[boardId], Tasks: newTask } } }));
            },
            moveBoard: (boardId, sourceMissionId, targetMissionId) => {
                set((state) => {
                    if (sourceMissionId === targetMissionId) return state;
                    const board = state.boards[boardId];
                    if (!board) return state;
                    const nextSourceOrder = (state.boardOrder[sourceMissionId] ?? []).filter(id => id !== boardId);
                    const nextTargetOrder = [...(state.boardOrder[targetMissionId] ?? []), boardId];
                    return {
                        boards: { ...state.boards, [boardId]: { ...board, MissionId: targetMissionId } },
                        boardOrder: {
                            ...state.boardOrder,
                            [sourceMissionId]: nextSourceOrder,
                            [targetMissionId]: nextTargetOrder,
                        },
                    };
                });
            },
            reorderBoards: (missionId, orderedIds) => {
                set((state) => ({
                    boardOrder: { ...state.boardOrder, [missionId]: orderedIds },
                }));
            },

            createTask: (task) => {
                set((state) => ({ tasks: { ...state.tasks, [task.TaskId]: task } }));
            },
            deleteTask: (boardId, taskId) => {
                set((state) => ({ boards: { ...state.boards, [boardId]: { ...state.boards[boardId], Tasks: state.boards[boardId].Tasks.filter(t => t.TaskId !== taskId) } } }));
            },
            RenameTask: (boardId, taskId, newName) => {
                set((state) => ({ boards: { ...state.boards, [boardId]: { ...state.boards[boardId], Tasks: state.boards[boardId].Tasks.map(t => t.TaskId === taskId ? { ...t, title: newName } : t) } } }));
            },
            moveTask: (taskId, sourceBoardId, targetBoardId, targetIndex) => {
                set((state) => {
                    if (sourceBoardId === targetBoardId) {
                        const board = state.boards[sourceBoardId];
                        if (!board) return state;
                        const tasks = board.Tasks.filter(t => t.TaskId !== taskId);
                        const task = board.Tasks.find(t => t.TaskId === taskId);
                        if (!task) return state;
                        const idx = targetIndex !== undefined ? targetIndex : tasks.length;
                        const newTasks = [...tasks.slice(0, idx), task, ...tasks.slice(idx)];
                        return { boards: { ...state.boards, [sourceBoardId]: { ...board, Tasks: newTasks } } };
                    }
                    const sourceBoard = state.boards[sourceBoardId];
                    const targetBoard = state.boards[targetBoardId];
                    if (!sourceBoard || !targetBoard) return state;
                    const task = sourceBoard.Tasks.find(t => t.TaskId === taskId);
                    if (!task) return state;
                    const newTargetTasks = [...targetBoard.Tasks];
                    const idx = targetIndex !== undefined ? targetIndex : newTargetTasks.length;
                    newTargetTasks.splice(idx, 0, task);
                    return {
                        boards: {
                            ...state.boards,
                            [sourceBoardId]: { ...sourceBoard, Tasks: sourceBoard.Tasks.filter(t => t.TaskId !== taskId) },
                            [targetBoardId]: { ...targetBoard, Tasks: newTargetTasks },
                        }
                    };
                });
            },
            reorderTasks: (boardId, orderedIds) => {
                set((state) => {
                    const board = state.boards[boardId];
                    if (!board) return state;
                    const taskMap = Object.fromEntries(board.Tasks.map(t => [t.TaskId, t]));
                    const newTasks = orderedIds.map(id => taskMap[id]).filter(Boolean);
                    return { boards: { ...state.boards, [boardId]: { ...board, Tasks: newTasks } } };
                });
            },
            setLinkedNoteIds: (boardId, taskId, linkedNoteIds) => {
                set((state) => ({ boards: { ...state.boards, [boardId]: { ...state.boards[boardId], Tasks: state.boards[boardId].Tasks.map(t => t.TaskId === taskId ? { ...t, linkedNoteIds } : t) } } }));
            },

            addSubTask: (boardId, taskId, subTask) => {
                set((state) => ({
                    boards: {
                        ...state.boards,
                        [boardId]: {
                            ...state.boards[boardId],
                            Tasks: state.boards[boardId].Tasks.map(t =>
                                t.TaskId === taskId
                                    ? { ...t, subTasks: [...(t.subTasks ?? []), subTask] }
                                    : t
                            ),
                        },
                    },
                }));
            },
            removeSubTask: (boardId, taskId, subTaskId) => {
                set((state) => ({
                    boards: {
                        ...state.boards,
                        [boardId]: {
                            ...state.boards[boardId],
                            Tasks: state.boards[boardId].Tasks.map(t =>
                                t.TaskId === taskId
                                    ? { ...t, subTasks: (t.subTasks ?? []).filter(s => s.subTaskId !== subTaskId) }
                                    : t
                            ),
                        },
                    },
                }));
            },
            toggleSubTask: (boardId, taskId, subTaskId) => {
                set((state) => ({
                    boards: {
                        ...state.boards,
                        [boardId]: {
                            ...state.boards[boardId],
                            Tasks: state.boards[boardId].Tasks.map(t =>
                                t.TaskId === taskId
                                    ? { ...t, subTasks: (t.subTasks ?? []).map(s => s.subTaskId === subTaskId ? { ...s, completed: !s.completed } : s) }
                                    : t
                            ),
                        },
                    },
                }));
            },
            renameSubTask: (boardId, taskId, subTaskId, newTitle) => {
                set((state) => ({
                    boards: {
                        ...state.boards,
                        [boardId]: {
                            ...state.boards[boardId],
                            Tasks: state.boards[boardId].Tasks.map(t =>
                                t.TaskId === taskId
                                    ? { ...t, subTasks: (t.subTasks ?? []).map(s => s.subTaskId === subTaskId ? { ...s, title: newTitle } : s) }
                                    : t
                            ),
                        },
                    },
                }));
            },
            linkSubTask: (boardId, taskId, subTaskId, noteId, blockId) => {
                set((state) => {
                    const nextBoards = {
                        ...state.boards,
                        [boardId]: {
                            ...state.boards[boardId],
                            Tasks: state.boards[boardId].Tasks.map(t =>
                                t.TaskId === taskId
                                    ? { ...t, subTasks: (t.subTasks ?? []).map(s => s.subTaskId === subTaskId ? { ...s, linkedNoteId: noteId, linkedBlockId: blockId } : s) }
                                    : t
                            ),
                        },
                    };
                    let nextMissions = state.missions;
                    if (blockId && noteId) {
                        const missionId = Object.keys(state.missions).find(id =>
                            state.missions[id].Notes.some(n => n.noteId === noteId)
                        );
                        if (missionId) {
                            const mission = state.missions[missionId];
                            nextMissions = {
                                ...state.missions,
                                [missionId]: {
                                    ...mission,
                                    Notes: mission.Notes.map(n =>
                                        n.noteId === noteId
                                            ? { ...n, blocks: n.blocks.map(b => b.blockId === blockId ? { ...b, linkedBoardId: boardId, linkedTaskId: taskId, linkedSubTaskId: subTaskId } : b) }
                                            : n
                                    )
                                }
                            };
                        }
                    }
                    return { boards: nextBoards, missions: nextMissions };
                });
            },
            linkBlock: (activeMissionId, noteId, blockId, boardId, taskId, subTaskId) => {
                set((state) => {
                    const mission = state.missions[activeMissionId];
                    if (!mission) return state;
                    const board = state.boards[boardId];
                    if (!board || board.MissionId !== activeMissionId) return state;
                    const task = board.Tasks.find(t => t.TaskId === taskId);
                    if (!task) return state;
                    const hasSubTask = subTaskId && (task.subTasks ?? []).some(s => s.subTaskId === subTaskId);
                    const nextNotes = mission.Notes.map(n => {
                        if (n.noteId !== noteId) return n;
                        return {
                            ...n,
                            blocks: n.blocks.map(b =>
                                b.blockId === blockId ? { ...b, linkedBoardId: boardId, linkedTaskId: taskId, linkedSubTaskId: subTaskId || "" } : b
                            )
                        };
                    });
                    let nextBoards = state.boards;
                    if (hasSubTask) {
                        nextBoards = {
                            ...state.boards,
                            [boardId]: {
                                ...board,
                                Tasks: board.Tasks.map(t =>
                                    t.TaskId === taskId
                                        ? { ...t, subTasks: (t.subTasks ?? []).map(s => s.subTaskId === subTaskId ? { ...s, linkedNoteId: noteId, linkedBlockId: blockId } : s) }
                                        : t
                                ),
                            },
                        };
                    }
                    return {
                        missions: { ...state.missions, [activeMissionId]: { ...mission, Notes: nextNotes } },
                        boards: nextBoards,
                    };
                });
            },

            createNote: (activeMissionId, note) => {
                set((state) => ({ missions: { ...state.missions, [activeMissionId]: { ...state.missions[activeMissionId], Notes: [...state.missions[activeMissionId].Notes, note] } } }));
                return note;
            },
            deleteNote: (activeMissionId, noteId) => {
                set((state) => ({
                    currentNoteId: state.currentNoteId === noteId ? null : state.currentNoteId,
                    missions: { ...state.missions, [activeMissionId]: { ...state.missions[activeMissionId], Notes: state.missions[activeMissionId].Notes.filter(n => n.noteId !== noteId), activeNoteId: state.missions[activeMissionId].activeNoteId === noteId ? null : state.missions[activeMissionId].activeNoteId } }
                }));
            },
            RenameNote: (activeMissionId, noteId, newName) => {
                set((state) => ({ missions: { ...state.missions, [activeMissionId]: { ...state.missions[activeMissionId], Notes: state.missions[activeMissionId].Notes.map(n => n.noteId === noteId ? { ...n, noteTitle: newName } : n) } } }));
            },
            updateNote: (activeMissionId, noteId, newNote) => {
                set((state) => ({ missions: { ...state.missions, [activeMissionId]: { ...state.missions[activeMissionId], Notes: state.missions[activeMissionId].Notes.map(n => n.noteId === noteId ? { ...n, ...newNote } : n) } } }));
            },

            createBlock: (note, newBlock) => {
                set((state) => {
                    const missionId = Object.keys(state.missions).find(id =>
                        state.missions[id].Notes.some(n => n.noteId === note.noteId)
                    );
                    if (!missionId) return state;
                    const mission = state.missions[missionId];
                    return {
                        missions: {
                            ...state.missions,
                            [missionId]: {
                                ...mission,
                                Notes: mission.Notes.map(n =>
                                    n.noteId === note.noteId
                                        ? { ...n, blocks: [...n.blocks, newBlock] }
                                        : n
                                )
                            }
                        }
                    };
                });
                return newBlock;
            },
            insertBlock: (note, index, newBlock) => {
                set((state) => {
                    const missionId = Object.keys(state.missions).find(id =>
                        state.missions[id].Notes.some(n => n.noteId === note.noteId)
                    );
                    if (!missionId) return state;
                    const mission = state.missions[missionId];
                    const noteData = mission.Notes.find(n => n.noteId === note.noteId);
                    if (!noteData) return state;
                    const blocks = [...noteData.blocks];
                    blocks.splice(Math.max(0, index), 0, newBlock);
                    return {
                        missions: {
                            ...state.missions,
                            [missionId]: {
                                ...mission,
                                Notes: mission.Notes.map(n =>
                                    n.noteId === note.noteId ? { ...n, blocks } : n
                                )
                            }
                        }
                    };
                });
                return newBlock;
            },
            deleteBlock: (note, blockId) => {
                set((state) => {
                    const missionId = Object.keys(state.missions).find(id =>
                        state.missions[id].Notes.some(n => n.noteId === note.noteId)
                    );
                    if (!missionId) return state;
                    const mission = state.missions[missionId];
                    return {
                        missions: {
                            ...state.missions,
                            [missionId]: {
                                ...mission,
                                Notes: mission.Notes.map(n =>
                                    n.noteId === note.noteId
                                        ? { ...n, blocks: n.blocks.filter(b => b.blockId !== blockId) }
                                        : n
                                )
                            }
                        }
                    };
                });
            },
            RenameBlock: (note, blockId, newName) => {
                set((state) => {
                    const missionId = Object.keys(state.missions).find(id =>
                        state.missions[id].Notes.some(n => n.noteId === note.noteId)
                    );
                    if (!missionId) return state;
                    const mission = state.missions[missionId];
                    return {
                        missions: {
                            ...state.missions,
                            [missionId]: {
                                ...mission,
                                Notes: mission.Notes.map(n =>
                                    n.noteId === note.noteId
                                        ? { ...n, blocks: n.blocks.map(b => b.blockId === blockId ? { ...b, blockContent: newName } : b) }
                                        : n
                                )
                            }
                        }
                    };
                });
            },
            updateBlock: (note, blockId, newBlock) => {
                set((state) => {
                    const missionId = Object.keys(state.missions).find(id =>
                        state.missions[id].Notes.some(n => n.noteId === note.noteId)
                    );
                    if (!missionId) return state;
                    const mission = state.missions[missionId];
                    return {
                        missions: {
                            ...state.missions,
                            [missionId]: {
                                ...mission,
                                Notes: mission.Notes.map(n =>
                                    n.noteId === note.noteId
                                        ? { ...n, blocks: n.blocks.map(b => b.blockId === blockId ? { ...b, ...newBlock } : b) }
                                        : n
                                )
                            }
                        }
                    };
                });
            },
            getCurrentContext: () => {
                const state = get();
                const currentMission = state.currentMissionId ? state.missions[state.currentMissionId] : null;
                const currentNote = state.currentNoteId ? currentMission?.Notes.find(n => n.noteId === state.currentNoteId) : null;
                return {
                    activeWorkSpaceId: state.activeWorkSpaceId,
                    currentMissionId: state.currentMissionId,
                    currentMissionTitle: currentMission?.title ?? null,
                    currentNoteId: state.currentNoteId,
                    currentNoteTitle: currentNote?.noteTitle ?? null,
                    previewMissionId: state.previewMissionId,
                    effectiveMissionId: state.previewMissionId ?? state.currentMissionId,
                };
            },
            getMissionSnapshot: (missionId) => buildMissionSnapshotFromState(get(), missionId),
            getCurrentMissionSnapshot: () => {
                const state = get();
                return state.currentMissionId ? buildMissionSnapshotFromState(state, state.currentMissionId) : null;
            },
            getNoteSnapshot: (noteId) => buildNoteSnapshotFromState(get(), noteId),
            getCurrentNoteSnapshot: () => {
                const state = get();
                return state.currentNoteId ? buildNoteSnapshotFromState(state, state.currentNoteId) : null;
            },
            getNoteBlocks: (noteId) => buildNoteBlocksFromState(get(), noteId),
            getCurrentNoteBlocks: () => {
                const state = get();
                return state.currentNoteId ? buildNoteBlocksFromState(state, state.currentNoteId) : [];
            },
            findMissionByTitle: (title) => {
                const target = normalizeText(title);
                return Object.values(get().missions)
                    .filter((mission) => normalizeText(mission.title) === target)
                    .map((mission) => ({ missionId: mission.MissionId, title: mission.title }));
            },
            findBoardByTitle: (title, missionId) => {
                const state = get();
                const target = normalizeText(title);
                const missionIds = missionId ? [missionId] : Object.keys(state.missions);
                return missionIds.flatMap((currentMissionId) =>
                    getOrderedBoards(state, currentMissionId)
                        .filter((board: Board) => normalizeText(board.title) === target)
                        .map((board: Board) => ({ missionId: currentMissionId, boardId: board.BoardId, title: board.title }))
                );
            },
            findTaskByTitle: (title, options) => {
                const state = get();
                const target = normalizeText(title);
                const missionIds = options?.missionId ? [options.missionId] : Object.keys(state.missions);
                return missionIds.flatMap((missionId) =>
                    getOrderedBoards(state, missionId)
                        .filter((board: Board) => !options?.boardId || board.BoardId === options.boardId)
                        .flatMap((board: Board) =>
                            (board.Tasks || [])
                                .filter((task) => normalizeText(task.title) === target)
                                .map((task) => ({ missionId, boardId: board.BoardId, taskId: task.TaskId, title: task.title }))
                        )
                );
            },
            findSubTaskByTitle: (title, options) => {
                const state = get();
                const target = normalizeText(title);
                const missionIds = options?.missionId ? [options.missionId] : Object.keys(state.missions);
                return missionIds.flatMap((missionId) =>
                    getOrderedBoards(state, missionId)
                        .filter((board: Board) => !options?.boardId || board.BoardId === options.boardId)
                        .flatMap((board: Board) =>
                            (board.Tasks || [])
                                .filter((task) => !options?.taskId || task.TaskId === options.taskId)
                                .flatMap((task) =>
                                    (task.subTasks || [])
                                        .filter((subTask) => normalizeText(subTask.title) === target)
                                        .map((subTask) => ({
                                            missionId,
                                            boardId: board.BoardId,
                                            taskId: task.TaskId,
                                            subTaskId: subTask.subTaskId,
                                            title: subTask.title,
                                        }))
                                )
                        )
                );
            },
            findNoteByTitle: (title, missionId) => {
                const state = get();
                const target = normalizeText(title);
                const missionIds = missionId ? [missionId] : Object.keys(state.missions);
                return missionIds.flatMap((currentMissionId) =>
                    (state.missions[currentMissionId]?.Notes || [])
                        .filter((note: Note) => normalizeText(note.noteTitle) === target)
                        .map((note: Note) => ({ missionId: currentMissionId, noteId: note.noteId, noteTitle: note.noteTitle }))
                );
            },
            findBlock: ({ noteId, blockId, index, previewText }) => {
                const snapshot = buildNoteSnapshotFromState(get(), noteId);
                if (!snapshot) return [];
                return snapshot.blocks
                    .filter((block) => {
                        if (blockId && block.blockId !== blockId) return false;
                        if (typeof index === "number" && block.index !== index) return false;
                        if (previewText && !normalizeText(block.preview).includes(normalizeText(previewText))) return false;
                        return true;
                    })
                    .map((block) => ({
                        missionId: snapshot.missionId,
                        noteId: snapshot.noteId,
                        blockId: block.blockId,
                        index: block.index,
                        blockType: block.blockType,
                        preview: block.preview,
                    }));
            },
        }),
        {
            name: 'workspace-storage',
            version: 5,
            migrate: (persistedState: any, version: number) => {
                let state = persistedState;
                if (version < 1) {
                    const missions = state.missions || {};
                    Object.keys(missions).forEach(missionId => {
                        if (!missions[missionId].Notes) {
                            missions[missionId].Notes = [];
                        }
                    });
                    state = { ...state, missions };
                }
                if (version < 5) {
                    const missions = state.missions || {};
                    const boards = state.boards || {};
                    const tasks = state.tasks || {};
                    Object.keys(missions).forEach(missionId => {
                        if (missions[missionId].activeNoteId === undefined) {
                            missions[missionId].activeNoteId = missions[missionId].activateNoteId ?? null;
                        }
                        delete missions[missionId].activateNoteId;
                        (missions[missionId].Notes || []).forEach((note: any) => {
                            (note.blocks || []).forEach((block: any) => {
                                if (block.linkedBoardId === undefined) block.linkedBoardId = "";
                                if (block.linkedTaskId === undefined) block.linkedTaskId = "";
                                if (block.linkedSubTaskId === undefined) block.linkedSubTaskId = "";
                            });
                        });
                    });
                    Object.keys(boards).forEach(boardId => {
                        boards[boardId].Tasks = (boards[boardId].Tasks || []).map((task: any) => ({
                            ...task,
                            subTasks: Array.isArray(task.subTasks) ? task.subTasks : [],
                        }));
                    });
                    Object.keys(tasks).forEach(taskId => {
                        tasks[taskId] = {
                            ...tasks[taskId],
                            subTasks: Array.isArray(tasks[taskId]?.subTasks) ? tasks[taskId].subTasks : [],
                        };
                    });
                    state = {
                        ...state,
                        currentMissionId: state.currentMissionId ?? state.activeMissionId ?? null,
                        currentNoteId: state.currentNoteId ?? null,
                        previewMissionId: null,
                        missions,
                        boards,
                        tasks,
                    };
                }
                return state;
            }
        }
    )
)