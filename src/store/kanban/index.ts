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
    language?: string;
    executionOutput?: string;
    executionError?: string;
    executionExitCode?: number;
    executionTimestamp?: string;
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

export type WorkSpace = {
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

export type WorkSpaceSnapshot = {
    workspaceId: string,
    workspaceName: string,
}

export interface WorkSpaceProps {
    workspaces: WorkSpace[],
    activeWorkSpaceId: string | null,
    activeMissionId: string | null,
    currentMissionId: string | null,
    currentNoteId: string | null,
    previewMissionId: string | null,

    _cloudSyncTime: string | null,

    missionOrder: Record<string, string[]>,
    boardOrder: Record<string, string[]>,

    missions: Record<string, Mission>,
    boards: Record<string, Board>,
    tasks: Record<string, Task>,

    createWorkSpace: (WorkSpace: WorkSpace) => void,
    setWorkSpace: (WorkSpaceId: string | null) => void,
    deleteWorkSpace: (WorkSpaceId: string) => void,
    RenameWorkSpace: (WorkSpaceId: string, newName: string) => void,    

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
    setNoteTaskLink: (missionId: string, noteId: string, taskId: string) => void,

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
    deleteBlock: (missionId: string, note: Note, blockId: string) => void,
    RenameBlock: (missionId: string, note: Note, blockId: string, newName: string) => void,
    updateBlock: (missionId: string, note: Note, blockId: string, newBlock: Block) => void,

    setCloudSyncTime: (time: string) => void,

    getCurrentContext: () => CurrentContextSnapshot,
    getWorkSpaceSnapshot: () => WorkSpaceSnapshot | null,
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

/**
 * 获取指定 Mission 下已排序的 Board 列表。
 *
 * 【为什么是外部纯函数而非 store 方法】
 * 此函数仅作为 buildMissionSnapshotFromState 的内部步骤，
 * 通过接收已有的 state 快照避免额外的 get() 调用。
 * 如果改写为 store 方法并在内部调用 get()，
 * 调用方（buildMissionSnapshotFromState）就需要再多调一次 get()，
 * 造成两次快照获取，不如共享同一个 state 参数来得高效。
 *
 * 【排序逻辑】
 * 优先按 boardOrder[missionId] 中记录的 BoardId 顺序排列（用户手动拖拽的顺序）；
 * 未出现在排序列表中的 Board（如旧数据迁移场景）会追加到末尾作为 fallback。
 */
const getOrderedBoards = (state: WorkSpaceProps, missionId: string) => {
    const orderedBoardIds = state.boardOrder[missionId] ?? [];
    const boardMap = Object.fromEntries(
        Object.values(state.boards).filter((b: Board) => b.MissionId === missionId).map((b: Board) => [b.BoardId, b])
    );
    const orderedBoards = orderedBoardIds.map((id: string) => boardMap[id]).filter(Boolean);
    const fallbackBoards = Object.values(state.boards).filter((b: Board) => b.MissionId === missionId && !orderedBoardIds.includes(b.BoardId));
    return [...orderedBoards, ...fallbackBoards];
};

/**
 * 从 state 快照构建指定笔记的完整快照（NoteSnapshot）。
 *
 * 【为什么是外部纯函数而非 store 方法】
 * 此函数同时被 getNoteSnapshot 和 buildNoteBlocksFromState 复用。
 * 两者的调用方（getCurrentNoteSnapshot、getCurrentNoteBlocks）均只调用一次 get()
 * 并将结果作为 state 参数传入，确保整次派生计算基于同一个一致的状态快照。
 * 若改写为 store 方法互调（get().getNoteSnapshot()），则会产生多次 get()，
 * 且 buildNoteBlocksFromState 也无法再复用同一个 state 对象。
 *
 * 【查找方式】
 * 笔记存储在各 Mission 的 Notes 数组中，没有全局 noteId → Mission 的索引，
 * 因此需要遍历所有 Mission 查找。找到后额外附加：
 *  - index：Block 在笔记中的位置（0-based）
 *  - preview：由 getBlockPreview 生成的内容摘要文本
 */
const buildNoteSnapshotFromState = (state: WorkSpaceProps, noteId: string): NoteSnapshot | null => {
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

/**
 * 获取指定笔记的所有 Block 快照列表。
 *
 * 复用 buildNoteSnapshotFromState 提取 blocks 字段，
 * 避免重复实现相同的 Mission 遍历逻辑。
 * 接收 state 参数而非内部调用 get()，
 * 与调用方共享同一个状态快照（参见 buildNoteSnapshotFromState 的说明）。
 */
const buildNoteBlocksFromState = (state: WorkSpaceProps, noteId: string): NoteBlockSnapshot[] => {
    return buildNoteSnapshotFromState(state, noteId)?.blocks ?? [];
};

/**
 * 从 state 快照构建指定 Mission 的完整快照（MissionSnapshot）。
 *
 * 【为什么是外部纯函数而非 store 方法】
 * getMissionSnapshot 和 getCurrentMissionSnapshot 都需要此逻辑。
 * getCurrentMissionSnapshot 只调用一次 get() 得到 state，
 * 然后将 state 和 state.currentMissionId 一并传入，复用同一快照。
 * 若改写为 getMissionSnapshot 内部直接调用 get()，
 * 则 getCurrentMissionSnapshot 中就会出现两次 get() 调用。
 *
 * 【内容说明】
 * - boards：通过 getOrderedBoards 保证有序，并在每个 Task 上附加 subTaskCount 字段
 * - notes：简化为摘要形式（noteId/noteTitle/relatedTaskId/blockCount），
 *   不包含 Block 内容，避免快照体积过大
 */
const buildMissionSnapshotFromState = (state: WorkSpaceProps, missionId: string): MissionSnapshot | null => {
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

const hasRemovedId = (ids: Set<string> | undefined, value: string | null | undefined) => !!value && !!ids?.has(value);

const collectBoardDescendants = (board: Board | undefined) => {
    const taskIds = new Set<string>();
    const subTaskIds = new Set<string>();

    for (const task of board?.Tasks || []) {
        taskIds.add(task.TaskId);
        for (const subTask of task.subTasks || []) {
            subTaskIds.add(subTask.subTaskId);
        }
    }

    return { taskIds, subTaskIds };
};

const collectMissionDescendants = (state: WorkSpaceProps, missionId: string) => {
    const boardIds = new Set<string>();
    const taskIds = new Set<string>();
    const subTaskIds = new Set<string>();
    const noteIds = new Set<string>();

    for (const note of state.missions[missionId]?.Notes || []) {
        noteIds.add(note.noteId);
    }

    for (const [boardId, board] of Object.entries(state.boards)) {
        if (board.MissionId !== missionId) continue;
        boardIds.add(boardId);
        const descendants = collectBoardDescendants(board);
        descendants.taskIds.forEach((taskId) => taskIds.add(taskId));
        descendants.subTaskIds.forEach((subTaskId) => subTaskIds.add(subTaskId));
    }

    return { boardIds, taskIds, subTaskIds, noteIds };
};

const collectWorkspaceDescendants = (state: WorkSpaceProps, workspaceId: string) => {
    const missionIds = new Set<string>();
    const boardIds = new Set<string>();
    const taskIds = new Set<string>();
    const subTaskIds = new Set<string>();
    const noteIds = new Set<string>();

    for (const mission of Object.values(state.missions)) {
        if (mission.WorkSpaceId !== workspaceId) continue;
        missionIds.add(mission.MissionId);
        for (const note of mission.Notes || []) {
            noteIds.add(note.noteId);
        }
    }

    for (const [boardId, board] of Object.entries(state.boards)) {
        if (!missionIds.has(board.MissionId)) continue;
        boardIds.add(boardId);
        const descendants = collectBoardDescendants(board);
        descendants.taskIds.forEach((taskId) => taskIds.add(taskId));
        descendants.subTaskIds.forEach((subTaskId) => subTaskIds.add(subTaskId));
    }

    return { missionIds, boardIds, taskIds, subTaskIds, noteIds };
};

const pruneTaskMap = (tasks: Record<string, Task>, removedTaskIds: Set<string>) => {
    if (removedTaskIds.size === 0) return tasks;
    return Object.fromEntries(Object.entries(tasks).filter(([taskId]) => !removedTaskIds.has(taskId)));
};

const sanitizeBoardsAfterDeletion = (
    boards: Record<string, Board>,
    options: {
        removedNoteIds?: Set<string>,
        removedBlockIds?: Set<string>,
    }
) => {
    return Object.fromEntries(
        Object.entries(boards).map(([boardId, board]) => [
            boardId,
            {
                ...board,
                Tasks: (board.Tasks || []).map((task) => ({
                    ...task,
                    linkedNoteIds: hasRemovedId(options.removedNoteIds, task.linkedNoteIds) ? "" : task.linkedNoteIds,
                    subTasks: (task.subTasks || []).map((subTask) => {
                        const shouldClearNote = hasRemovedId(options.removedNoteIds, subTask.linkedNoteId);
                        const shouldClearBlock = shouldClearNote || hasRemovedId(options.removedBlockIds, subTask.linkedBlockId);
                        if (!shouldClearNote && !shouldClearBlock) return subTask;
                        return {
                            ...subTask,
                            linkedNoteId: shouldClearNote ? "" : subTask.linkedNoteId,
                            linkedBlockId: shouldClearBlock ? "" : subTask.linkedBlockId,
                        };
                    }),
                })),
            },
        ])
    );
};

const sanitizeMissionsAfterDeletion = (
    missions: Record<string, Mission>,
    options: {
        removedBoardIds?: Set<string>,
        removedTaskIds?: Set<string>,
        removedSubTaskIds?: Set<string>,
    }
) => {
    return Object.fromEntries(
        Object.entries(missions).map(([missionId, mission]) => [
            missionId,
            {
                ...mission,
                Notes: (mission.Notes || []).map((note) => ({
                    ...note,
                    relatedTaskId: hasRemovedId(options.removedTaskIds, note.relatedTaskId) ? "" : note.relatedTaskId,
                    blocks: (note.blocks || []).map((block) => {
                        const shouldClearTaskLink =
                            hasRemovedId(options.removedBoardIds, block.linkedBoardId) ||
                            hasRemovedId(options.removedTaskIds, block.linkedTaskId);
                        if (shouldClearTaskLink) {
                            return {
                                ...block,
                                linkedBoardId: "",
                                linkedTaskId: "",
                                linkedSubTaskId: "",
                            };
                        }
                        if (hasRemovedId(options.removedSubTaskIds, block.linkedSubTaskId)) {
                            return {
                                ...block,
                                linkedSubTaskId: "",
                            };
                        }
                        return block;
                    }),
                })),
            },
        ])
    );
};

const findTaskLocation = (boards: Record<string, Board>, taskId: string) => {
    for (const [boardId, board] of Object.entries(boards)) {
        const taskIndex = (board.Tasks || []).findIndex((task) => task.TaskId === taskId);
        if (taskIndex >= 0) {
            return { boardId, taskIndex };
        }
    }
    return null;
};

const findNoteLocation = (missions: Record<string, Mission>, noteId: string) => {
    for (const [missionId, mission] of Object.entries(missions)) {
        const noteIndex = (mission.Notes || []).findIndex((note) => note.noteId === noteId);
        if (noteIndex >= 0) {
            return { missionId, noteIndex };
        }
    }
    return null;
};

const findBlockLocation = (missions: Record<string, Mission>, noteId: string, blockId: string) => {
    const noteLocation = findNoteLocation(missions, noteId);
    if (!noteLocation) return null;
    const note = missions[noteLocation.missionId].Notes[noteLocation.noteIndex];
    const blockIndex = (note.blocks || []).findIndex((block) => block.blockId === blockId);
    if (blockIndex < 0) return null;
    return { ...noteLocation, blockIndex };
};

const findSubTaskLocation = (boards: Record<string, Board>, subTaskId: string) => {
    for (const [boardId, board] of Object.entries(boards)) {
        for (const [taskIndex, task] of (board.Tasks || []).entries()) {
            const subTaskIndex = (task.subTasks || []).findIndex((subTask) => subTask.subTaskId === subTaskId);
            if (subTaskIndex >= 0) {
                return { boardId, taskIndex, subTaskIndex };
            }
        }
    }
    return null;
};

const syncTaskShadow = (tasks: Record<string, Task>, task: Task) => {
    tasks[task.TaskId] = { ...task };
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
            _cloudSyncTime: null,
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
                    const { missionIds, boardIds, taskIds, subTaskIds, noteIds } = collectWorkspaceDescendants(state, workspaceId);
                    const nextWorkspaces = state.workspaces.filter(w => w.workspaceId !== workspaceId);
                    const nextMissionOrder = { ...state.missionOrder };
                    delete nextMissionOrder[workspaceId];
                    const nextBoardOrder = Object.fromEntries(
                        Object.entries(state.boardOrder).filter(([missionId]) => !missionIds.has(missionId))
                    );
                    const nextMissionsBase = Object.fromEntries(
                        Object.entries(state.missions).filter(([missionId]) => !missionIds.has(missionId))
                    );
                    const nextBoardsBase = Object.fromEntries(
                        Object.entries(state.boards).filter(([boardId]) => !boardIds.has(boardId))
                    );
                    const nextMissions = sanitizeMissionsAfterDeletion(nextMissionsBase, {
                        removedBoardIds: boardIds,
                        removedTaskIds: taskIds,
                        removedSubTaskIds: subTaskIds,
                    });
                    const nextBoards = sanitizeBoardsAfterDeletion(nextBoardsBase, { removedNoteIds: noteIds });
                    const removedActiveMission = !!state.activeMissionId && missionIds.has(state.activeMissionId);
                    const removedCurrentMission = !!state.currentMissionId && missionIds.has(state.currentMissionId);
                    const removedCurrentNote = !!state.currentNoteId && noteIds.has(state.currentNoteId);
                    const removedPreviewMission = !!state.previewMissionId && missionIds.has(state.previewMissionId);

                    return {
                        workspaces: nextWorkspaces,
                        activeWorkSpaceId: state.activeWorkSpaceId === workspaceId ? null : state.activeWorkSpaceId,
                        activeMissionId: removedActiveMission ? null : state.activeMissionId,
                        currentMissionId: removedCurrentMission ? null : state.currentMissionId,
                        currentNoteId: removedCurrentNote ? null : state.currentNoteId,
                        previewMissionId: removedPreviewMission ? null : state.previewMissionId,
                        missionOrder: nextMissionOrder,
                        boardOrder: nextBoardOrder,
                        missions: nextMissions,
                        boards: nextBoards,
                        tasks: pruneTaskMap(state.tasks, taskIds),
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

            getWorkSpaceSnapshot: () => {
                const state = get();
                if (!state.activeWorkSpaceId) return null;
                const workspace = state.workspaces.find(w => w.workspaceId === state.activeWorkSpaceId);
                if (!workspace) return null;
                return {
                    workspaceId: workspace.workspaceId,
                    workspaceName: workspace.workspaceName,
                };
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
                    const { boardIds, taskIds, subTaskIds, noteIds } = collectMissionDescendants(state, missionId);
                    const nextMissionOrder = wsId
                        ? { ...state.missionOrder, [wsId]: (state.missionOrder[wsId] ?? []).filter(id => id !== missionId) }
                        : state.missionOrder;
                    const nextBoardOrder = Object.fromEntries(
                        Object.entries(state.boardOrder).filter(([key]) => key !== missionId)
                    );
                    const nextMissionsBase = Object.fromEntries(Object.entries(state.missions).filter(([id]) => id !== missionId));
                    const nextBoardsBase = Object.fromEntries(
                        Object.entries(state.boards).filter(([boardId]) => !boardIds.has(boardId))
                    );
                    const nextMissions = sanitizeMissionsAfterDeletion(nextMissionsBase, {
                        removedBoardIds: boardIds,
                        removedTaskIds: taskIds,
                        removedSubTaskIds: subTaskIds,
                    });
                    const nextBoards = sanitizeBoardsAfterDeletion(nextBoardsBase, { removedNoteIds: noteIds });

                    return {
                        missions: nextMissions,
                        boards: nextBoards,
                        tasks: pruneTaskMap(state.tasks, taskIds),
                        missionOrder: nextMissionOrder,
                        boardOrder: nextBoardOrder,
                        activeMissionId: state.activeMissionId === missionId ? null : state.activeMissionId,
                        currentMissionId: state.currentMissionId === missionId ? null : state.currentMissionId,
                        currentNoteId: state.currentNoteId && noteIds.has(state.currentNoteId) ? null : state.currentNoteId,
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
                    const { taskIds, subTaskIds } = collectBoardDescendants(board);
                    const nextBoardOrder = mId
                        ? { ...state.boardOrder, [mId]: (state.boardOrder[mId] ?? []).filter(id => id !== boardId) }
                        : state.boardOrder;
                    const nextBoards = Object.fromEntries(Object.entries(state.boards).filter(([id]) => id !== boardId));
                    return {
                        boards: nextBoards,
                        tasks: pruneTaskMap(state.tasks, taskIds),
                        missions: sanitizeMissionsAfterDeletion(state.missions, {
                            removedBoardIds: new Set([boardId]),
                            removedTaskIds: taskIds,
                            removedSubTaskIds: subTaskIds,
                        }),
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
                set((state) => {
                    const board = state.boards[boardId];
                    const task = board?.Tasks.find((item) => item.TaskId === taskId);
                    const subTaskIds = new Set<string>((task?.subTasks || []).map((subTask) => subTask.subTaskId));

                    return {
                        boards: {
                            ...state.boards,
                            [boardId]: {
                                ...state.boards[boardId],
                                Tasks: state.boards[boardId].Tasks.filter(t => t.TaskId !== taskId),
                            },
                        },
                        tasks: pruneTaskMap(state.tasks, new Set([taskId])),
                        missions: sanitizeMissionsAfterDeletion(state.missions, {
                            removedTaskIds: new Set([taskId]),
                            removedSubTaskIds: subTaskIds,
                        }),
                    };
                });
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
            setNoteTaskLink: (missionId, noteId, taskId) => {
                set((state) => {
                    const mission = state.missions[missionId];
                    const note = mission?.Notes.find((item) => item.noteId === noteId);
                    if (!mission || !note) return state;

                    const nextTaskId = taskId || "";
                    if (nextTaskId && !findTaskLocation(state.boards, nextTaskId)) return state;

                    const timestamp = new Date().toISOString();
                    const missions = structuredClone(state.missions);
                    const boards = structuredClone(state.boards);
                    const tasks = structuredClone(state.tasks);

                    for (const board of Object.values(boards)) {
                        board.Tasks = (board.Tasks || []).map((taskEntity) => {
                            let nextTask = taskEntity;
                            if ((taskEntity.linkedNoteIds === noteId && taskEntity.TaskId !== nextTaskId) || taskEntity.TaskId === note.relatedTaskId) {
                                nextTask = { ...nextTask, linkedNoteIds: "" };
                            }
                            if (nextTaskId && taskEntity.TaskId === nextTaskId) {
                                nextTask = { ...nextTask, linkedNoteIds: noteId };
                            }
                            syncTaskShadow(tasks, nextTask);
                            return nextTask;
                        });
                    }

                    for (const currentMission of Object.values(missions)) {
                        currentMission.Notes = (currentMission.Notes || []).map((currentNote) => {
                            if (currentNote.noteId === noteId) {
                                return {
                                    ...currentNote,
                                    relatedTaskId: nextTaskId,
                                    noteUpdatedAt: timestamp,
                                };
                            }
                            if (nextTaskId && currentNote.relatedTaskId === nextTaskId) {
                                return {
                                    ...currentNote,
                                    relatedTaskId: "",
                                    noteUpdatedAt: timestamp,
                                };
                            }
                            return currentNote;
                        });
                    }

                    return { missions, boards, tasks };
                });
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
                    missions: sanitizeMissionsAfterDeletion(state.missions, {
                        removedSubTaskIds: new Set([subTaskId]),
                    }),
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
                    const board = state.boards[boardId];
                    const taskIndex = board?.Tasks.findIndex((item) => item.TaskId === taskId) ?? -1;
                    const subTaskIndex = taskIndex >= 0 ? (board?.Tasks[taskIndex].subTasks || []).findIndex((item) => item.subTaskId === subTaskId) : -1;
                    if (!board || taskIndex < 0 || subTaskIndex < 0) return state;

                    const nextNoteId = noteId || "";
                    const nextBlockId = nextNoteId ? (blockId || "") : "";
                    const missions = structuredClone(state.missions);
                    const boards = structuredClone(state.boards);
                    const tasks = structuredClone(state.tasks);

                    const nextTask = boards[boardId].Tasks[taskIndex];
                    const nextSubTask = nextTask.subTasks[subTaskIndex];

                    if (nextSubTask.linkedNoteId && nextSubTask.linkedBlockId) {
                        const previousBlockLocation = findBlockLocation(missions, nextSubTask.linkedNoteId, nextSubTask.linkedBlockId);
                        if (previousBlockLocation) {
                            const previousBlock = missions[previousBlockLocation.missionId].Notes[previousBlockLocation.noteIndex].blocks[previousBlockLocation.blockIndex];
                            if (previousBlock.linkedSubTaskId === subTaskId) {
                                previousBlock.linkedSubTaskId = "";
                            }
                        }
                    }

                    if (nextBlockId) {
                        const targetBlockLocation = findBlockLocation(missions, nextNoteId, nextBlockId);
                        if (!targetBlockLocation) return state;
                        const targetBlock = missions[targetBlockLocation.missionId].Notes[targetBlockLocation.noteIndex].blocks[targetBlockLocation.blockIndex];

                        if (targetBlock.linkedSubTaskId && targetBlock.linkedSubTaskId !== subTaskId) {
                            const linkedSubTaskLocation = findSubTaskLocation(boards, targetBlock.linkedSubTaskId);
                            if (linkedSubTaskLocation) {
                                const linkedTask = boards[linkedSubTaskLocation.boardId].Tasks[linkedSubTaskLocation.taskIndex];
                                const linkedSubTask = linkedTask.subTasks[linkedSubTaskLocation.subTaskIndex];
                                if (linkedSubTask.linkedNoteId === nextNoteId && linkedSubTask.linkedBlockId === nextBlockId) {
                                    linkedSubTask.linkedNoteId = "";
                                    linkedSubTask.linkedBlockId = "";
                                    syncTaskShadow(tasks, linkedTask);
                                }
                            }
                        }

                        targetBlock.linkedBoardId = boardId;
                        targetBlock.linkedTaskId = taskId;
                        targetBlock.linkedSubTaskId = subTaskId;
                    }

                    nextSubTask.linkedNoteId = nextNoteId;
                    nextSubTask.linkedBlockId = nextBlockId;
                    syncTaskShadow(tasks, nextTask);

                    return { missions, boards, tasks };
                });
            },
            linkBlock: (activeMissionId, noteId, blockId, boardId, taskId, subTaskId) => {
                set((state) => {
                    const blockLocation = findBlockLocation(state.missions, noteId, blockId);
                    if (!blockLocation || blockLocation.missionId !== activeMissionId) return state;

                    const nextBoardId = boardId || "";
                    const nextTaskId = nextBoardId ? (taskId || "") : "";
                    const nextSubTaskId = nextTaskId ? (subTaskId || "") : "";

                    if (nextTaskId) {
                        const taskLocation = findTaskLocation(state.boards, nextTaskId);
                        if (!taskLocation || taskLocation.boardId !== nextBoardId) return state;
                    }

                    if (nextSubTaskId) {
                        const selectedBoard = state.boards[nextBoardId];
                        const selectedTask = selectedBoard?.Tasks.find((item) => item.TaskId === nextTaskId);
                        if (!selectedTask || !(selectedTask.subTasks || []).some((item) => item.subTaskId === nextSubTaskId)) return state;
                    }

                    const missions = structuredClone(state.missions);
                    const boards = structuredClone(state.boards);
                    const tasks = structuredClone(state.tasks);

                    const block = missions[blockLocation.missionId].Notes[blockLocation.noteIndex].blocks[blockLocation.blockIndex];

                    if (block.linkedSubTaskId && block.linkedSubTaskId !== nextSubTaskId) {
                        const previousSubTaskLocation = findSubTaskLocation(boards, block.linkedSubTaskId);
                        if (previousSubTaskLocation) {
                            const previousTask = boards[previousSubTaskLocation.boardId].Tasks[previousSubTaskLocation.taskIndex];
                            const previousSubTask = previousTask.subTasks[previousSubTaskLocation.subTaskIndex];
                            if (previousSubTask.linkedNoteId === noteId && previousSubTask.linkedBlockId === blockId) {
                                previousSubTask.linkedNoteId = "";
                                previousSubTask.linkedBlockId = "";
                                syncTaskShadow(tasks, previousTask);
                            }
                        }
                    }

                    if (nextSubTaskId) {
                        const targetBoard = boards[nextBoardId];
                        const targetTaskIndex = targetBoard.Tasks.findIndex((item) => item.TaskId === nextTaskId);
                        const targetTask = targetBoard.Tasks[targetTaskIndex];
                        const targetSubTaskIndex = (targetTask.subTasks || []).findIndex((item) => item.subTaskId === nextSubTaskId);
                        const targetSubTask = targetTask.subTasks[targetSubTaskIndex];

                        if (targetSubTask.linkedNoteId && targetSubTask.linkedBlockId && !(targetSubTask.linkedNoteId === noteId && targetSubTask.linkedBlockId === blockId)) {
                            const previousBlockLocation = findBlockLocation(missions, targetSubTask.linkedNoteId, targetSubTask.linkedBlockId);
                            if (previousBlockLocation) {
                                const previousBlock = missions[previousBlockLocation.missionId].Notes[previousBlockLocation.noteIndex].blocks[previousBlockLocation.blockIndex];
                                if (previousBlock.linkedSubTaskId === nextSubTaskId) {
                                    previousBlock.linkedSubTaskId = "";
                                }
                            }
                        }

                        targetSubTask.linkedNoteId = noteId;
                        targetSubTask.linkedBlockId = blockId;
                        syncTaskShadow(tasks, targetTask);
                    }

                    block.linkedBoardId = nextBoardId;
                    block.linkedTaskId = nextTaskId;
                    block.linkedSubTaskId = nextSubTaskId;

                    return { missions, boards, tasks };
                });
            },

            createNote: (activeMissionId, note) => {
                set((state) => ({ missions: { ...state.missions, [activeMissionId]: { ...state.missions[activeMissionId], Notes: [...state.missions[activeMissionId].Notes, note] } } }));
                return note;
            },
            deleteNote: (activeMissionId, noteId) => {
                set((state) => {
                    const mission = state.missions[activeMissionId];
                    const note = mission?.Notes.find((item) => item.noteId === noteId);
                    const removedBlockIds = new Set<string>((note?.blocks || []).map((block) => block.blockId));

                    return {
                        currentNoteId: state.currentNoteId === noteId ? null : state.currentNoteId,
                        missions: {
                            ...state.missions,
                            [activeMissionId]: {
                                ...state.missions[activeMissionId],
                                Notes: state.missions[activeMissionId].Notes.filter(n => n.noteId !== noteId),
                                activeNoteId: state.missions[activeMissionId].activeNoteId === noteId ? null : state.missions[activeMissionId].activeNoteId,
                            },
                        },
                        boards: sanitizeBoardsAfterDeletion(state.boards, {
                            removedNoteIds: new Set([noteId]),
                            removedBlockIds,
                        }),
                    };
                });
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
            deleteBlock: (missionId, note, blockId) => {
                set((state) => {
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
                        },
                        boards: sanitizeBoardsAfterDeletion(state.boards, {
                            removedBlockIds: new Set([blockId]),
                        }),
                    };
                });
            },
            RenameBlock: (missionId, note, blockId, newName) => {
                set((state) => {
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
            updateBlock: (missionId, note, blockId, newBlock) => {
                set((state) => {
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
            setCloudSyncTime: (time: string) => {
                set({ _cloudSyncTime: time });
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
            version: 6,
            skipHydration: true, // ZustandRehydrate 组件会在客户端手动触发 rehydrate()
            migrate: (persistedState: unknown, version: number): WorkSpaceProps => {
                // 把传入的 unknown 安全地转换为部分 WorkSpaceProps，再与默认数据合并以避免 undefined 访问
                const incoming = (persistedState as Partial<WorkSpaceProps>) ?? {};

                const defaultData: Partial<WorkSpaceProps> = {
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
                };

                // 合并（浅合并），后续迁移基于 stateObj
                let stateObj = { ...defaultData, ...incoming } as Partial<WorkSpaceProps>;

                // 为便于遍历，断言为可索引类型
                const missions = (stateObj.missions || {}) as Record<string, Mission>;
                const boards = (stateObj.boards || {}) as Record<string, Board>;
                const tasks = (stateObj.tasks || {}) as Record<string, Task>;

                if (version < 1) {
                    Object.keys(missions).forEach(missionId => {
                        if (!missions[missionId].Notes) {
                            missions[missionId].Notes = [];
                        }
                    });
                    stateObj = { ...stateObj, missions };
                }

                if (version < 5) {
                    Object.keys(missions).forEach(missionId => {
                        if (missions[missionId].activeNoteId === undefined) {
                            missions[missionId].activeNoteId = null;
                        }
                        (missions[missionId].Notes || []).forEach((note: Note) => {
                            (note.blocks || []).forEach((block: Block) => {
                                if (block.linkedBoardId === undefined) block.linkedBoardId = "";
                                if (block.linkedTaskId === undefined) block.linkedTaskId = "";
                                if (block.linkedSubTaskId === undefined) block.linkedSubTaskId = "";
                            });
                        });
                    });
                    Object.keys(boards).forEach(boardId => {
                        boards[boardId].Tasks = (boards[boardId].Tasks || []).map((task: Task) => ({
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
                    stateObj = {
                        ...stateObj,
                        currentMissionId: stateObj.currentMissionId ?? stateObj.activeMissionId ?? null,
                        currentNoteId: stateObj.currentNoteId ?? null,
                        previewMissionId: null,
                        missions,
                        boards,
                        tasks,
                    };
                }

                if (version < 6) {
                    // 使用明确类型替代 any
                    Object.keys(missions).forEach(missionId => {
                        (missions[missionId].Notes || []).forEach((note: Note) => {
                            (note.blocks || []).forEach((block: Block) => {
                                if (block.blockType === 'code' && !block.language) {
                                    block.language = 'javascript';
                                }
                            });
                        });
                    });
                    stateObj = { ...stateObj, missions };
                }

                // 返回时断言为 WorkSpaceProps，运行时 persist 存储的仅是数据部分，zustand 会把方法从初始 store 合并回来
                return stateObj as WorkSpaceProps;
            }
        }
    )
);