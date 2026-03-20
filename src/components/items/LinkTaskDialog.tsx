import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { type Note as NoteType, type Task } from "@/store/kanban";

interface LinkTaskDialogProps {
    note: NoteType;
    activeMissionId: string;
    missions: Record<string, any>;
    boards: Record<string, any>;
    onConfirm: (note: NoteType | null, taskId: string | null) => void;
    trigger?: React.ReactNode;
}

export const LinkTaskDialog = ({
    note,
    activeMissionId,
    missions,
    boards,
    onConfirm,
    trigger
}: LinkTaskDialogProps) => {
    const [open, setOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string>(note?.relatedTaskId ?? "");

    const currentMission = missions[activeMissionId];
    if (!currentMission) return null;

    const allTasks: Task[] = [];
    Object.values(boards).forEach((board: any) => {
        if (board.MissionId === activeMissionId && board.Tasks) {
            allTasks.push(...board.Tasks);
        }
    });

    const handleSave = () => {
        onConfirm(note ?? null, selectedTaskId || null);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                {trigger || <Button className="cursor-pointer" variant="ghost" size="sm">Link to Task</Button>}
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>Link Note to Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                        Select a task from current mission boards
                    </div>
                    <select
                        value={selectedTaskId}
                        onChange={(e) => setSelectedTaskId(e.target.value)}
                        className="w-full p-2 border rounded-md"
                    >
                        <option value="">-- No task selected --</option>
                        {allTasks.map(task => (
                            <option key={task.TaskId} value={task.TaskId}>
                                {task.title}
                            </option>
                        ))}
                    </select>
                    <div className="text-xs text-muted-foreground">
                        {note?.relatedTaskId ? `Currently linked to: ${allTasks.find(t => t.TaskId === note?.relatedTaskId)?.title || note?.relatedTaskId}` : 'No task linked'}
                    </div>
                </div>
                <DialogFooter>
                    <Button className="cursor-pointer" variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button className="cursor-pointer" variant="outline" onClick={handleSave}>
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};