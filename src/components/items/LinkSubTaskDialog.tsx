import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import type { Note } from "@/store/kanban";

interface LinkSubTaskDialogProps {
    notes: Note[];
    currentNoteId: string;
    currentBlockId: string;
    onConfirm: (noteId: string, blockId: string) => void;
    onCreateNote?: () => string | void;
    trigger?: React.ReactNode;
}

export const LinkSubTaskDialog = ({
    notes,
    currentNoteId,
    currentBlockId,
    onConfirm,
    onCreateNote,
    trigger,
}: LinkSubTaskDialogProps) => {
    const [open, setOpen] = useState(false);
    const [selectedNoteId, setSelectedNoteId] = useState(currentNoteId || "");
    const [selectedBlockId, setSelectedBlockId] = useState(currentBlockId || "");

    const selectedNote = notes.find(n => n.noteId === selectedNoteId);

    const handleNoteChange = (noteId: string) => {
        setSelectedNoteId(noteId);
        setSelectedBlockId("");
    };

    const handleSave = () => {
        onConfirm(selectedNoteId, selectedBlockId);
        setOpen(false);
    };

    const getBlockPreview = (content: string) => {
        const text = content.replace(/^#+\s*/, "").trim();
        return text.length > 40 ? text.slice(0, 40) + "…" : text || "(空白)";
    };

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o);
            if (o) {
                setSelectedNoteId(currentNoteId || "");
                setSelectedBlockId(currentBlockId || "");
            }
        }}>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                {trigger || <Button variant="ghost" size="sm">Link</Button>}
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>链接到 Note Block</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">选择 Note</div>
                        <select
                            value={selectedNoteId}
                            onChange={(e) => handleNoteChange(e.target.value)}
                            className="w-full p-2 border rounded-md text-sm"
                        >
                            <option value="">-- 不链接 --</option>
                            {notes.map(note => (
                                <option key={note.noteId} value={note.noteId}>
                                    {note.noteTitle}
                                </option>
                            ))}
                        </select>
                    </div>
                    {selectedNote && (
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">选择 Block（标题）</div>
                            <select
                                value={selectedBlockId}
                                onChange={(e) => setSelectedBlockId(e.target.value)}
                                className="w-full p-2 border rounded-md text-sm"
                            >
                                <option value="">-- 只链接 Note --</option>
                                {selectedNote.blocks.map(block => (
                                    <option key={block.blockId} value={block.blockId}>
                                        [{block.blockType}] {getBlockPreview(block.blockContent)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {onCreateNote && (
                        <Button variant="outline" size="sm" onClick={() => {
                            const newId = onCreateNote();
                            if (newId) setSelectedNoteId(newId);
                        }}>新建笔记</Button>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
                    <Button variant="outline" onClick={handleSave}>确定</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
