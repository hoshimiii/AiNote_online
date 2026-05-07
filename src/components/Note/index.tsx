import { useWorkSpace, type Note as NoteType } from "@/store/kanban";
import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { DeleteDialog } from "../items/DeleteDialog";
import { RenameDialog } from "../items/RenameDialog";
import { TrashIcon, LinkIcon, PlusIcon } from "lucide-react";
import { PencilIcon } from "lucide-react";
import { Block } from "./Block";
import { LinkTaskDialog } from "../items/LinkTaskDialog";
import { LinkBlockDialog } from "../items/LinkBlockDialog";
import { generateRandomId } from "../utils/RandomGenerator";


export const NoteItem = ({ note, nowmission }: { note: NoteType, nowmission: string }) => {
    const { deleteNote, RenameNote, setActiveNote } = useWorkSpace();
    useEffect(() => {
        const handlePopState = () => {
            // 当用户点击鼠标侧键或浏览器后退按钮时
            // 检查当前 URL 状态，如果回到了任务页，则重置 activeNoteId
            setActiveNote(nowmission, null);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [nowmission, setActiveNote]);
    return (
        <div className="group/note-item ml-1 flex h-8 items-center justify-between gap-1 px-1 text-xs leading-none">
            <div className="min-w-0 flex-1 truncate">{note.noteTitle}</div>
            <div className="flex h-8 items-center gap-0.5 opacity-0 pointer-events-none transition-opacity group-hover/note-item:opacity-100 group-hover/note-item:pointer-events-auto group-focus-within/note-item:opacity-100 group-focus-within/note-item:pointer-events-auto">
                <DeleteDialog
                    title="确定要删除任务吗?"
                    description="此操作无法撤销，相关数据将永久消失"
                    onConfirm={() => deleteNote(nowmission, note.noteId)}
                    trigger={<Button variant="ghost" size="icon-sm" className="cursor-pointer h-8 w-8 text-red-500 hover:text-red-600"><TrashIcon className="w-4 h-4" /></Button>}
                />
                <RenameDialog
                    title="重命名?"
                    initialName={note.noteTitle}
                    onConfirm={(newName) => RenameNote(nowmission, note.noteId, newName)}
                    trigger={<Button variant="ghost" size="icon-sm" className="cursor-pointer h-8 w-8 text-blue-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></Button>}
                />
                </div>
        </div>
    )
}


export const Note = ({ note, activeMissionId, scrollToBlockId }: { note: NoteType, activeMissionId: string, scrollToBlockId?: string }) => {
    const { boards, boardOrder, updateNote, createBlock, insertBlock, deleteBlock, updateBlock, setNoteTaskLink, linkBlock, addSubTask, updataBoard } = useWorkSpace();
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [localContents, setLocalContents] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        note?.blocks?.forEach(b => {
            initial[b.blockId] = b.blockContent;
        });
        return initial;
    });

    useEffect(() => {
        if (!scrollToBlockId) return;
        const el = document.getElementById(`block-${scrollToBlockId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-blue-400', 'rounded');
            const timer = setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400', 'rounded'), 2000);
            return () => clearTimeout(timer);
        }
    }, [scrollToBlockId]);

    // useEffect(() => {
    //     const next: Record<string, string> = {};
    //     note?.blocks?.forEach(b => {
    //         next[b.blockId] = b.blockContent;
    //     });
    //         setLocalContents(next);
    // }, [note?.noteId]);

    const handleBlockChange = (blockId: string, content: string) => {
        setLocalContents(prev => ({ ...prev, [blockId]: content }));
    };
    //防抖保存机制
    useEffect(() => {
        const hasChanged = note.blocks.some(
            b => (localContents[b.blockId] ?? b.blockContent) !== b.blockContent
        );
        if (!hasChanged) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            const updatedNote: NoteType = {
                ...note,
                blocks: note.blocks.map(b => ({
                    ...b,
                    blockContent: localContents[b.blockId] ?? b.blockContent,
                    blockUpdatedAt: new Date().toISOString(),
                })),
                noteUpdatedAt: new Date().toISOString(),
            };
            updateNote(activeMissionId, note.noteId, updatedNote);
        }, 500);
        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [localContents, note, activeMissionId, updateNote]);

    const orderedBoardIds = boardOrder[activeMissionId] ?? [];
    const boardMap = Object.fromEntries(
        Object.values(boards).filter((b) => b.MissionId === activeMissionId).map((b) => [b.BoardId, b])
    );
    const allBoards = [...(orderedBoardIds.map((id: string) => boardMap[id]).filter(Boolean)), ...Object.values(boards).filter((b) => b.MissionId === activeMissionId && !orderedBoardIds.includes(b.BoardId))];

    return (
        <div className="p-4">
            <div className="flex justify-between items-baseline mb-4">
                <h3 className="text-lg font-semibold">{note?.noteTitle}</h3>
                <LinkTaskDialog
                    note={note}
                    activeMissionId={activeMissionId}
                    boards={boards}
                    onConfirm={(taskId) => setNoteTaskLink(activeMissionId, note.noteId, taskId)}
                    trigger={<Button variant="ghost" size="sm">Link to Task</Button>}
                />
            </div>

            {note?.blocks?.map((block, idx) => (
                <div key={block.blockId} className="flex flex-col group/insert">
                    <div className="h-6 flex items-center justify-center opacity-0 hover:opacity-100 group-hover/insert:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                            onClick={() => insertBlock(note, idx, {
                                blockId: generateRandomId(),
                                blockType: 'markdown',
                                blockContent: '',
                                blockCreatedAt: new Date().toISOString(),
                                blockUpdatedAt: new Date().toISOString()
                            })}
                        >
                            <PlusIcon className="w-3 h-3" />
                        </Button>
                    </div>
                    <div id={`block-${block.blockId}`} className="relative group/block p-1">
                        <Block
                            block={block}
                            content={localContents[block.blockId] ?? block.blockContent}
                            onChange={(content) => handleBlockChange(block.blockId, content)}
                            onUpdateBlock={(updates) => updateBlock(activeMissionId, note, block.blockId, { ...block, ...updates })}
                        />
                        <div className="absolute top-2 right-2 flex gap-0.5 items-center opacity-0 group-hover/block:opacity-100 transition-opacity">
                            <select
                                value={block.blockType}
                                onChange={(e) => updateBlock(activeMissionId, note, block.blockId, { ...block, blockType: e.target.value })}
                                className="h-6 px-1.5 text-xs border rounded bg-background cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <option value="markdown">Markdown</option>
                                <option value="code">Code</option>
                            </select>
                            <LinkBlockDialog
                            boards={allBoards}
                            currentBoardId={block.linkedBoardId ?? ""}
                            currentTaskId={block.linkedTaskId ?? ""}
                            currentSubTaskId={block.linkedSubTaskId ?? ""}
                            onConfirm={(boardId, taskId, subTaskId) => linkBlock(activeMissionId, note.noteId, block.blockId, boardId, taskId, subTaskId)}
                            onCreateTask={(boardId) => {
                                const board = allBoards.find((b) => b.BoardId === boardId);
                                if (board) {
                                    const newTaskId = generateRandomId();
                                    updataBoard(boardId, [...board.Tasks, { TaskId: newTaskId, title: 'New Task', linkedNoteIds: '', subTasks: [] }]);
                                    return newTaskId;
                                }
                            }}
                            onCreateSubTask={(boardId, taskId) => {
                                const newSubTaskId = generateRandomId();
                                addSubTask(boardId, taskId, { subTaskId: newSubTaskId, title: 'New SubTask', completed: false, linkedNoteId: '', linkedBlockId: '' });
                                return newSubTaskId;
                            }}
                            trigger={<Button variant="ghost" size="icon" className={`cursor-pointer h-6 w-6 hover:text-blue-500 ${block.linkedTaskId ? 'text-blue-500' : 'text-gray-400'}`}><LinkIcon className="w-3 h-3" /></Button>}
                        />
                        <DeleteDialog
                            title="确定要删除这个块吗?"
                            description="此操作将永久删除块及其所有关联的任务数据。"
                            onConfirm={() => deleteBlock(activeMissionId, note, block.blockId)}
                            trigger={<Button variant="ghost" size="icon" className="cursor-pointer h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"><TrashIcon className="w-3 h-3" /></Button>}
                        />
                        </div>
                    </div>
                </div>
            ))}
            <div className="group/insert h-8 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity border border-dashed border-gray-200 rounded hover:border-blue-300 hover:bg-blue-50/30">
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-gray-500 hover:text-blue-600"
                        onClick={() => createBlock(note, {
                            blockId: generateRandomId(),
                            blockType: 'markdown',
                            blockContent: '',
                            blockCreatedAt: new Date().toISOString(),
                            blockUpdatedAt: new Date().toISOString()
                        })}
                    >
                        <PlusIcon className="w-3 h-3 mr-1" /> Markdown
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-gray-500 hover:text-blue-600"
                        onClick={() => createBlock(note, {
                            blockId: generateRandomId(),
                            blockType: 'code',
                            blockContent: '',
                            blockCreatedAt: new Date().toISOString(),
                            blockUpdatedAt: new Date().toISOString(),
                            language: 'javascript',
                        })}
                    >
                        <PlusIcon className="w-3 h-3 mr-1" /> Code
                    </Button>
                </div>
            </div>
        </div>
    );
}