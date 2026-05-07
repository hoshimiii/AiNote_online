import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { type Board, type Note as NoteType, type Task } from "@/store/kanban";
import { LinkManagerSheet } from "./LinkManagerSheet";

interface LinkTaskDialogProps {
    note: NoteType;
    activeMissionId: string;
    boards: Record<string, Board>;
    onConfirm: (taskId: string) => void;
    trigger?: React.ReactNode;
}

export const LinkTaskDialog = ({
    note,
    activeMissionId,
    boards,
    onConfirm,
    trigger
}: LinkTaskDialogProps) => {
    const [open, setOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string>(note?.relatedTaskId ?? "");

    const taskOptions = useMemo(
        () => Object.values(boards)
            .filter((board) => board.MissionId === activeMissionId)
            .flatMap((board) => (board.Tasks || []).map((task: Task) => ({
                boardId: board.BoardId,
                boardTitle: board.title,
                taskId: task.TaskId,
                taskTitle: task.title,
                subTaskCount: (task.subTasks || []).length,
            }))),
        [activeMissionId, boards]
    );

    const currentTask = taskOptions.find((task) => task.taskId === note.relatedTaskId);
    const selectedTask = taskOptions.find((task) => task.taskId === selectedTaskId);

    const currentSummary = (
        <div className="space-y-1 text-sm">
            <div className="font-medium">{note.noteTitle}</div>
            <div className="text-muted-foreground">
                {currentTask ? `已关联到 ${currentTask.boardTitle} / ${currentTask.taskTitle}` : "当前未关联到 Task"}
            </div>
        </div>
    );

    const preview = selectedTask ? (
        <div className="space-y-2 text-sm">
            <div>
                <div className="font-medium">{selectedTask.taskTitle}</div>
                <div className="text-muted-foreground">{selectedTask.boardTitle}</div>
            </div>
            <div className="text-xs text-muted-foreground">包含 {selectedTask.subTaskCount} 个子任务</div>
        </div>
    ) : (
        <div className="text-sm text-muted-foreground">选择 Task 后，这里会显示它所在的 Board 与子任务数量。</div>
    );

    return (
        <LinkManagerSheet
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (nextOpen) {
                    setSelectedTaskId(note.relatedTaskId ?? "");
                }
            }}
            title="管理 Note 与 Task 关联"
            description="为当前 Note 选择一个主 Task；保存时会由 store 统一同步镜像字段。"
            currentSummary={currentSummary}
            preview={preview}
            onSave={() => onConfirm(selectedTaskId)}
            onClear={() => setSelectedTaskId("")}
            trigger={trigger || <Button className="cursor-pointer" variant="ghost" size="sm">Link to Task</Button>}
        >
            <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">选择 Task</div>
                <select
                    value={selectedTaskId}
                    onChange={(event) => setSelectedTaskId(event.target.value)}
                    className="w-full rounded-md border p-2 text-sm"
                >
                    <option value="">-- 暂不关联 --</option>
                    {taskOptions.map((task) => (
                        <option key={task.taskId} value={task.taskId}>
                            {task.boardTitle} / {task.taskTitle}
                        </option>
                    ))}
                </select>
            </div>
        </LinkManagerSheet>
    );
};