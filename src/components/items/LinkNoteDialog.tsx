import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { type Note } from "@/store/kanban";
// import { Input } from "../ui/input";

interface LinkNoteDialogProps {
    noteIds: string[];
    BoardId: string;
    TaskId: string;
    activeMissionId: string;
    missions: Record<string, any>;
    boards: Record<string, any>;
    onConfirm: (BoardId: string, taskId: string, noteId: string) => void;
    trigger?: React.ReactNode;
}



export const LinkNoteDialog = ({
    noteIds,
    BoardId,
    TaskId,
    activeMissionId,
    missions,
    // boards,
    onConfirm,
    trigger
}: LinkNoteDialogProps) => {
    const [open, setOpen] = useState(false);
    const [selectedNoteId, setSelectedNoteId] = useState<string>(noteIds[0] || "");

    const currentMission = missions[activeMissionId];
    if (!currentMission) return null;

    const allNotes: Note[] = [];
    Object.values(missions).forEach((mission: any) => {
        if (mission.MissionId === activeMissionId) {
            allNotes.push(...mission.Notes);
        }
    });

    const handleSave = () => {
        onConfirm(BoardId, TaskId, selectedNoteId);
        setOpen(false);
        console.log(`set note id : ${selectedNoteId}`);
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
                        value={selectedNoteId}
                        onChange={(e) => setSelectedNoteId(e.target.value)}
                        className="w-full p-2 border rounded-md"
                    >
                        <option value="">-- No task selected --</option>
                        {allNotes.map(note => (
                            <option key={note.noteId} value={note.noteId}>
                                {note.noteTitle}
                            </option>
                        ))}
                    </select>
                    <div className="text-xs text-muted-foreground">
                        {noteIds.includes(selectedNoteId) ? `Currently linked to: ${selectedNoteId}` : 'No note linked'}
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