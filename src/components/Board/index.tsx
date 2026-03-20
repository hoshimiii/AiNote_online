import { useWorkSpace } from "@/store/kanban";
import { Button } from "../ui/button";
import { DeleteDialog } from "../items/DeleteDialog";
import { RenameDialog } from "../items/RenameDialog";
import { LinkIcon, PencilIcon, TrashIcon } from "lucide-react";
import { Task } from "./Task";
import { BoardItem } from "./BoardItem";
import { generateRandomId } from "../utils/RandomGenerator";
import { LinkNoteDialog } from "../items/LinkNoteDialog";
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy } from "@dnd-kit/sortable";


export const Board = ({ nowMissionId, setActiveNoteId }: { nowMissionId: string, setActiveNoteId: (noteId: string, blockId?: string) => void }) => {
    const { missions, boards, boardOrder, deleteBoard, RenameBoard, updataBoard, deleteTask, setLinkedNoteIds, updateNote } = useWorkSpace();
    const activeMissionId = nowMissionId;
    const orderedBoardIds = boardOrder[activeMissionId] ?? [];
    const boardMap = Object.fromEntries(
        Object.values(boards).filter(b => b.MissionId === activeMissionId).map(b => [b.BoardId, b])
    );
    const activeboards = orderedBoardIds.map(id => boardMap[id]).filter(Boolean);
    const fallbackBoards = Object.values(boards).filter(b => b.MissionId === activeMissionId && !orderedBoardIds.includes(b.BoardId));
    const allBoards = [...activeboards, ...fallbackBoards];

    return (
        <SortableContext items={allBoards.map(b => activeMissionId + '+' + b.BoardId)} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-wrap w-full gap-2">
                {allBoards.map(board => {
                    const boardSortableId = activeMissionId + '+' + board.BoardId;
                    const taskIds = board.Tasks.map(t => activeMissionId + '+' + board.BoardId + '+' + t.TaskId);
                    return (
                        <div className="flex flex-col gap-2 w-[30%] h-fit bg-blue-100 rounded-md p-2 group" key={board.BoardId}>
                            <BoardItem id={boardSortableId} title={board.title}>
                                <div className="flex items-center gap-1 opacity-0 pointer-events-none transition-opacity
                                                group-hover:opacity-100 group-hover:pointer-events-auto
                                                group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                    <DeleteDialog
                                        title="确定要删除吗?"
                                        description="此操作无法撤回，相关数据将永久消失"
                                        onConfirm={() => deleteBoard(board.BoardId)}
                                        trigger={<Button variant="ghost" size="icon" className="cursor-pointer h-fit w-6"><TrashIcon className="w-4 h-4 text-red-500" /></Button>}
                                    />
                                    <RenameDialog
                                        initialName={board.title}
                                        title="重命名"
                                        onConfirm={(newName: string) => RenameBoard(board.BoardId, newName)}
                                        trigger={<Button variant="ghost" size="icon" className="cursor-pointer h-fit w-6"><PencilIcon className="w-4 h-4 text-blue-500" /></Button>}
                                    />
                                </div>

                                <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                                    {board.Tasks.map(task => (
                                        <div key={task.TaskId} className="flex items-start group/task bg-white rounded-md">
                                            <Task
                                                id={activeMissionId + '+' + board.BoardId + '+' + task.TaskId}
                                                title={task.title}
                                                linkedNoteIds={task.linkedNoteIds}
                                                subTasks={task.subTasks ?? []}
                                                setActiveNoteId={setActiveNoteId}
                                                activeMissionId={activeMissionId}
                                            >
                                                <div className="flex bg-gray-100 items-center gap-1 opacity-0 pointer-events-none transition-opacity
                                                        group-hover/task:opacity-100 group-hover/task:pointer-events-auto
                                                        group-focus-within/task:opacity-100 group-focus-within/task:pointer-events-auto">
                                                    <DeleteDialog
                                                        title="确定要删除吗?"
                                                        description="此操作无法撤回，相关数据将永久消失"
                                                        onConfirm={() => deleteTask(board.BoardId, task.TaskId)}
                                                        trigger={<Button variant="ghost" size="icon" className="cursor-pointer h-fit w-6"><TrashIcon className="w-4 h-4 text-red-500" /></Button>}
                                                    />
                                                    <LinkNoteDialog
                                                        noteIds={missions[activeMissionId].Notes.map(note => note.noteId)}
                                                        TaskId={task.TaskId}
                                                        BoardId={board.BoardId}
                                                        activeMissionId={activeMissionId}
                                                        missions={missions}
                                                        boards={allBoards}
                                                        onConfirm={(BoardId: string, taskId: string, noteId: string) => {
                                                            const missionId = boards[BoardId]?.MissionId;
                                                            const currentTask = boards[BoardId]?.Tasks.find(t => t.TaskId === taskId);
                                                            if (missionId && currentTask?.linkedNoteIds) {
                                                                const oldNote = missions[missionId]?.Notes.find(n => n.noteId === currentTask.linkedNoteIds);
                                                                if (oldNote) updateNote(missionId, oldNote.noteId, { ...oldNote, relatedTaskId: "", noteUpdatedAt: new Date().toISOString() });
                                                            }
                                                            setLinkedNoteIds(BoardId, taskId, noteId);
                                                            if (noteId && missionId) {
                                                                const note = missions[missionId]?.Notes.find(n => n.noteId === noteId);
                                                                if (note) updateNote(missionId, noteId, { ...note, relatedTaskId: taskId, noteUpdatedAt: new Date().toISOString() });
                                                            }
                                                        }}
                                                        trigger={<Button variant="ghost" size="icon" className="cursor-pointer h-fit w-6"><LinkIcon className="w-4 h-4 text-blue-500" /></Button>}
                                                    />
                                                </div>
                                            </Task>
                                        </div>
                                    ))}
                                </SortableContext>

                                <Button variant="outline" onClick={() => updataBoard(board.BoardId, [...board.Tasks, {
                                    TaskId: generateRandomId(),
                                    title: 'New Task',
                                    linkedNoteIds: '',
                                    subTasks: [],
                                }])}>New Task</Button>
                            </BoardItem>
                        </div>
                    );
                })}
            </div>
        </SortableContext>
    );
};
