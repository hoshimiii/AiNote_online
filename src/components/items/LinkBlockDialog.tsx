import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import type { Board, Task, SubTask } from "@/store/kanban";

interface LinkBlockDialogProps {
    boards: Board[];
    currentBoardId: string;
    currentTaskId: string;
    currentSubTaskId: string;
    onConfirm: (boardId: string, taskId: string, subTaskId: string) => void;
    onCreateTask?: (boardId: string) => string | void;
    onCreateSubTask?: (boardId: string, taskId: string) => string | void;
    trigger?: React.ReactNode;
}

export const LinkBlockDialog = ({
    boards,
    currentBoardId,
    currentTaskId,
    currentSubTaskId,
    onConfirm,
    onCreateTask,
    onCreateSubTask,
    trigger,
}: LinkBlockDialogProps) => {
    const [open, setOpen] = useState(false);
    const [selectedBoardId, setSelectedBoardId] = useState(currentBoardId || "");
    const [selectedTaskId, setSelectedTaskId] = useState(currentTaskId || "");
    const [selectedSubTaskId, setSelectedSubTaskId] = useState(currentSubTaskId || "");

    const selectedBoard = boards.find(b => b.BoardId === selectedBoardId);
    const selectedTask = selectedBoard?.Tasks.find((t: Task) => t.TaskId === selectedTaskId);
    const subTasks = selectedTask?.subTasks ?? [];

    const handleBoardChange = (boardId: string) => {
        setSelectedBoardId(boardId);
        setSelectedTaskId("");
        setSelectedSubTaskId("");
    };

    const handleTaskChange = (taskId: string) => {
        setSelectedTaskId(taskId);
        setSelectedSubTaskId("");
    };

    const handleSave = () => {
        onConfirm(selectedBoardId, selectedTaskId, selectedSubTaskId);
        setOpen(false);
    };

    const handleNewTask = () => {
        const boardId = boards[0]?.BoardId || selectedBoardId;
        if (boardId && onCreateTask) {
            const newTaskId = onCreateTask(boardId);
            if (newTaskId) {
                setSelectedBoardId(boardId);
                setSelectedTaskId(newTaskId);
                setSelectedSubTaskId("");
            }
        }
    };

    const handleNewSubTask = () => {
        if (selectedBoardId && selectedTaskId && onCreateSubTask) {
            const newSubTaskId = onCreateSubTask(selectedBoardId, selectedTaskId);
            if (newSubTaskId) setSelectedSubTaskId(newSubTaskId);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (o) {
                setSelectedBoardId(currentBoardId || "");
                setSelectedTaskId(currentTaskId || "");
                setSelectedSubTaskId(currentSubTaskId || "");
            }
        }}>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                {trigger || <Button variant="ghost" size="sm">Link</Button>}
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>链接到 Task SubTask</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">选择 Board</div>
                        <select
                            value={selectedBoardId}
                            onChange={(e) => handleBoardChange(e.target.value)}
                            className="w-full p-2 border rounded-md text-sm"
                        >
                            <option value="">-- 不链接 --</option>
                            {boards.map(b => (
                                <option key={b.BoardId} value={b.BoardId}>{b.title}</option>
                            ))}
                        </select>
                    </div>
                    {selectedBoard && (
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">选择 Task</div>
                            <select
                                value={selectedTaskId}
                                onChange={(e) => handleTaskChange(e.target.value)}
                                className="w-full p-2 border rounded-md text-sm"
                            >
                                <option value="">-- 不链接 --</option>
                                {selectedBoard.Tasks.map((t: Task) => (
                                    <option key={t.TaskId} value={t.TaskId}>{t.title}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {selectedTask && (
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">选择 SubTask</div>
                            <select
                                value={selectedSubTaskId}
                                onChange={(e) => setSelectedSubTaskId(e.target.value)}
                                className="w-full p-2 border rounded-md text-sm"
                            >
                                <option value="">-- 只链接 Task --</option>
                                {subTasks.map((s: SubTask) => (
                                    <option key={s.subTaskId} value={s.subTaskId}>{s.title}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex gap-2">
                        {onCreateTask && (
                            <Button variant="outline" size="sm" onClick={handleNewTask}>新建 Task</Button>
                        )}
                        {selectedBoardId && selectedTaskId && onCreateSubTask && (
                            <Button variant="outline" size="sm" onClick={handleNewSubTask}>新建 SubTask</Button>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
                    <Button variant="outline" onClick={handleSave}>确定</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
