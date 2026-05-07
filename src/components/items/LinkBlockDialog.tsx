import { useState } from "react";
import { Button } from "../ui/button";
import type { Board, Task, SubTask } from "@/store/kanban";
import { LinkManagerSheet } from "./LinkManagerSheet";

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

    const handleNewTask = () => {
        const boardId = selectedBoardId || boards[0]?.BoardId || "";
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

    const currentBoard = boards.find((board) => board.BoardId === currentBoardId);
    const currentTask = currentBoard?.Tasks.find((task) => task.TaskId === currentTaskId);
    const currentSubTask = currentTask?.subTasks.find((subTask) => subTask.subTaskId === currentSubTaskId);

    const preview = selectedTask ? (
        <div className="space-y-3 text-sm">
            <div>
                <div className="font-medium">{selectedTask.title}</div>
                <div className="text-muted-foreground">{selectedBoard?.title}</div>
            </div>
            <div className="text-xs text-muted-foreground">{subTasks.length} 个可选 SubTask</div>
            {selectedSubTaskId ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                    已选 SubTask：{subTasks.find((subTask) => subTask.subTaskId === selectedSubTaskId)?.title}
                </div>
            ) : (
                <div className="text-sm text-muted-foreground">当前将仅关联到 Task，不关联具体 SubTask。</div>
            )}
        </div>
    ) : (
        <div className="text-sm text-muted-foreground">选择 Task 后，这里会显示其所在 Board 与可选的 SubTask 数量。</div>
    );

    return (
        <LinkManagerSheet
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (nextOpen) {
                    setSelectedBoardId(currentBoardId || "");
                    setSelectedTaskId(currentTaskId || "");
                    setSelectedSubTaskId(currentSubTaskId || "");
                }
            }}
            title="管理 Block 与 Task/SubTask 关联"
            description="可将当前 Block 关联到一个 Task，并可选绑定到具体 SubTask。"
            currentSummary={
                <div className="space-y-1 text-sm">
                    <div className="font-medium">{currentTask ? `${currentBoard?.title} / ${currentTask.title}` : "当前未关联 Task"}</div>
                    <div className="text-muted-foreground">{currentSubTask ? `SubTask：${currentSubTask.title}` : "当前未关联具体 SubTask"}</div>
                </div>
            }
            preview={preview}
            onSave={() => onConfirm(selectedBoardId, selectedTaskId, selectedSubTaskId)}
            onClear={() => onConfirm("", "", "")}
            saveDisabled={!!selectedBoardId && !selectedTaskId}
            trigger={trigger || <Button variant="ghost" size="sm">Link</Button>}
        >
            <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">选择 Board</div>
                <select
                    value={selectedBoardId}
                    onChange={(event) => handleBoardChange(event.target.value)}
                    className="w-full rounded-md border p-2 text-sm"
                >
                    <option value="">-- 暂不关联 --</option>
                    {boards.map((board) => (
                        <option key={board.BoardId} value={board.BoardId}>{board.title}</option>
                    ))}
                </select>
            </div>

            {selectedBoard ? (
                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">选择 Task</div>
                    <select
                        value={selectedTaskId}
                        onChange={(event) => handleTaskChange(event.target.value)}
                        className="w-full rounded-md border p-2 text-sm"
                    >
                        <option value="">-- 请选择 Task --</option>
                        {selectedBoard.Tasks.map((task: Task) => (
                            <option key={task.TaskId} value={task.TaskId}>{task.title}</option>
                        ))}
                    </select>
                </div>
            ) : null}

            {selectedTask ? (
                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">选择 SubTask</div>
                    <select
                        value={selectedSubTaskId}
                        onChange={(event) => setSelectedSubTaskId(event.target.value)}
                        className="w-full rounded-md border p-2 text-sm"
                    >
                        <option value="">-- 仅关联 Task --</option>
                        {subTasks.map((subTask: SubTask) => (
                            <option key={subTask.subTaskId} value={subTask.subTaskId}>{subTask.title}</option>
                        ))}
                    </select>
                </div>
            ) : null}

            <div className="flex flex-wrap gap-2 rounded-lg border border-dashed p-3">
                {onCreateTask ? (
                    <Button variant="outline" size="sm" onClick={handleNewTask}>新建 Task</Button>
                ) : null}
                {selectedBoardId && selectedTaskId && onCreateSubTask ? (
                    <Button variant="outline" size="sm" onClick={handleNewSubTask}>新建 SubTask</Button>
                ) : null}
            </div>
        </LinkManagerSheet>
    );
};
