import { useWorkSpace } from "@/store/kanban";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React, { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, TrashIcon, LinkIcon, PlusIcon, PencilIcon } from "lucide-react";
import { Button } from "../ui/button";
import { LinkSubTaskDialog } from "../items/LinkSubTaskDialog";
import { generateRandomId } from "../utils/RandomGenerator";
import type { SubTask } from "@/store/kanban";
import { RenameDialog } from "../items/RenameDialog";


interface TaskProps extends React.PropsWithChildren {
    id: string,
    title: string,
    linkedNoteIds: string,
    subTasks: SubTask[],
    setActiveNoteId: (noteId: string, blockId?: string) => void,
    activeMissionId: string,
}


export const Task = (props: TaskProps) => {
    const { missions, RenameTask, addSubTask, removeSubTask, toggleSubTask, renameSubTask, linkSubTask, createNote } = useWorkSpace();
    const { id, title, children, linkedNoteIds, subTasks, setActiveNoteId, activeMissionId } = props;

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        data: { type: 'task' }
    });

    const [, BoardId, TaskId] = id.split('+');
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const childrenArray = React.Children.toArray(children);
    const firstChild = childrenArray[0];
    const restChildren = childrenArray.slice(1);
    const [isEditing, setIsEditing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [editingSubTaskId, setEditingSubTaskId] = useState<string | null>(null);
    const [editingSubTaskTitle, setEditingSubTaskTitle] = useState("");

    const notes = missions[activeMissionId]?.Notes ?? [];

    const handleClick = (e: React.MouseEvent) => {
        if (e.ctrlKey && linkedNoteIds) {
            setActiveNoteId(linkedNoteIds);
        }
    };

    const handleSubTaskClick = (subTask: SubTask, e: React.MouseEvent) => {
        if (subTask.linkedNoteId) {
            e.stopPropagation();
            setActiveNoteId(subTask.linkedNoteId, subTask.linkedBlockId || undefined);
        }
    };

    const handleSubTaskDoubleClick = (subTask: SubTask) => {
        setEditingSubTaskId(subTask.subTaskId);
        setEditingSubTaskTitle(subTask.title);
    };

    const handleSubTaskTitleBlur = () => {
        if (editingSubTaskId) {
            renameSubTask(BoardId, TaskId, editingSubTaskId, editingSubTaskTitle);
            setEditingSubTaskId(null);
        }
    };

    const handleAddSubTask = () => {
        const newSubTask: SubTask = {
            subTaskId: generateRandomId(),
            title: "New SubTask",
            completed: false,
            linkedNoteId: "",
            linkedBlockId: "",
        };
        addSubTask(BoardId, TaskId, newSubTask);
        if (!isExpanded) setIsExpanded(true);
    };

    const completedCount = (subTasks ?? []).filter(s => s.completed).length;
    const totalCount = (subTasks ?? []).length;

    return (
        <div ref={setNodeRef} style={style} className="mb-0.5">
            {isEditing ? (
                <input
                    value={title}
                    onChange={(e) => RenameTask(BoardId, TaskId, e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    className="w-full p-1 border rounded text-sm"
                    autoFocus
                />
            ) : (
                <div className="kanban-item p-2 rounded-md border border-gray-100 bg-white">
                    <div className="flex items-center gap-1">
                        <div {...attributes} {...listeners} className="cursor-grab text-gray-400 select-none px-1">⠿</div>
                        {totalCount > 0 && (
                            <button
                                onClick={() => setIsExpanded(v => !v)}
                                className="text-gray-400 hover:text-gray-600 shrink-0"
                            >
                                {isExpanded
                                    ? <ChevronDownIcon className="w-3 h-3" />
                                    : <ChevronRightIcon className="w-3 h-3" />}
                            </button>
                        )}
                        <div
                            className="flex-1 flex items-center gap-1 cursor-pointer text-sm"
                            onClick={handleClick}
                            onDoubleClick={() => setIsEditing(true)}
                        >
                            {title} {firstChild}
                            {totalCount > 0 && (
                                <span className="text-xs text-gray-400 ml-1">{completedCount}/{totalCount}</span>
                            )}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleAddSubTask(); }}
                            className="opacity-0 group-hover/task:opacity-100 text-gray-400 hover:text-blue-500 shrink-0"
                            title="添加子任务"
                        >
                            <PlusIcon className="w-3 h-3" />
                        </button>
                        {restChildren}
                    </div>

                    {isExpanded && totalCount > 0 && (
                        <div className="mt-1 ml-5 space-y-0.5">
                            {(subTasks ?? []).map(subTask => (
                                <div key={subTask.subTaskId} className="flex items-center gap-1 group/subtask">
                                    <input
                                        type="checkbox"
                                        checked={subTask.completed}
                                        onChange={() => toggleSubTask(BoardId, TaskId, subTask.subTaskId)}
                                        className="shrink-0 cursor-pointer"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    {editingSubTaskId === subTask.subTaskId ? (
                                        <input
                                            type="text"
                                            value={editingSubTaskTitle}
                                            onChange={(e) => setEditingSubTaskTitle(e.target.value)}
                                            onBlur={handleSubTaskTitleBlur}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSubTaskTitleBlur(); }}
                                            className="flex-1 text-xs border rounded px-1 py-0.5"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span
                                            className={`flex-1 text-xs cursor-pointer select-none ${subTask.completed ? 'line-through text-gray-400' : ''} ${subTask.linkedNoteId ? 'text-blue-600 hover:underline' : ''}`}
                                            onClick={(e) => handleSubTaskClick(subTask, e)}
                                            onDoubleClick={() => handleSubTaskDoubleClick(subTask)}
                                            title={subTask.linkedNoteId ? "点击跳转到关联 Note" : "双击编辑"}
                                        >
                                            {subTask.title}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/subtask:opacity-100">
                                        <LinkSubTaskDialog
                                            notes={notes}
                                            currentNoteId={subTask.linkedNoteId}
                                            currentBlockId={subTask.linkedBlockId}
                                            onConfirm={(noteId, blockId) => linkSubTask(BoardId, TaskId, subTask.subTaskId, noteId, blockId)}
                                            onCreateNote={() => {
                                                const n = createNote(activeMissionId, {
                                                    noteId: generateRandomId(),
                                                    noteTitle: 'New Note',
                                                    noteContent: '',
                                                    noteCreatedAt: new Date().toISOString(),
                                                    noteUpdatedAt: new Date().toISOString(),
                                                    relatedTaskId: '',
                                                    blocks: []
                                                });
                                                return n.noteId;
                                            }}
                                            trigger={
                                                <Button variant="ghost" size="icon" className="h-4 w-4 cursor-pointer">
                                                    <LinkIcon className={`w-2.5 h-2.5 ${subTask.linkedNoteId ? 'text-blue-500' : 'text-gray-400'}`} />
                                                </Button>
                                            }
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-4 w-4 cursor-pointer"
                                            onClick={(e) => { e.stopPropagation(); removeSubTask(BoardId, TaskId, subTask.subTaskId); }}
                                        >
                                            <TrashIcon className="w-2.5 h-2.5 text-red-400" />
                                        </Button>
                                        <RenameDialog
                                            initialName={subTask.title}
                                            title="重命名子任务"
                                            onConfirm={(newName: string) => renameSubTask(BoardId, TaskId, subTask.subTaskId, newName)}
                                            trigger={
                                                <Button variant="ghost" size="icon" className="h-4 w-4 cursor-pointer">
                                                    <PencilIcon className="w-2.5 h-2.5 text-blue-500" />
                                                </Button>
                                            }
                                        />
         
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
