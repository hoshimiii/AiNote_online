import { useState } from "react";
import { Button } from "../ui/button";
import { type Note } from "@/store/kanban";
import { LinkManagerSheet } from "./LinkManagerSheet";

interface LinkNoteDialogProps {
    notes: Note[];
    currentNoteId: string;
    taskTitle: string;
    onConfirm: (noteId: string) => void;
    trigger?: React.ReactNode;
}



export const LinkNoteDialog = ({
    notes,
    currentNoteId,
    taskTitle,
    onConfirm,
    trigger
}: LinkNoteDialogProps) => {
    const [open, setOpen] = useState(false);
    const [selectedNoteId, setSelectedNoteId] = useState<string>(currentNoteId || "");

    const currentNote = notes.find((note) => note.noteId === currentNoteId);
    const selectedNote = notes.find((note) => note.noteId === selectedNoteId);

    const getNotePreview = (note: Note) => {
        const firstBlock = note.blocks[0]?.blockContent?.replace(/\s+/g, " ").trim() ?? "";
        if (!firstBlock) return "暂无内容";
        return firstBlock.length > 80 ? `${firstBlock.slice(0, 80)}…` : firstBlock;
    };

    return (
        <LinkManagerSheet
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (nextOpen) {
                    setSelectedNoteId(currentNoteId || "");
                }
            }}
            title="管理 Task 与 Note 关联"
            description="为当前 Task 选择一个主 Note；保存时会由 store 统一同步镜像字段。"
            currentSummary={
                <div className="space-y-1 text-sm">
                    <div className="font-medium">{taskTitle}</div>
                    <div className="text-muted-foreground">{currentNote ? `当前指向 ${currentNote.noteTitle}` : "当前未关联到 Note"}</div>
                </div>
            }
            preview={selectedNote ? (
                <div className="space-y-2 text-sm">
                    <div className="font-medium">{selectedNote.noteTitle}</div>
                    <div className="text-muted-foreground">{selectedNote.blocks.length} 个 Block</div>
                    <p className="text-sm text-muted-foreground">{getNotePreview(selectedNote)}</p>
                </div>
            ) : (
                <div className="text-sm text-muted-foreground">选择 Note 后，这里会显示标题、Block 数量和内容摘要。</div>
            )}
            onSave={() => onConfirm(selectedNoteId)}
            onClear={() => setSelectedNoteId("")}
            trigger={trigger || <Button className="cursor-pointer" variant="ghost" size="sm">Link to Note</Button>}
        >
            <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">选择 Note</div>
                <select
                    value={selectedNoteId}
                    onChange={(event) => setSelectedNoteId(event.target.value)}
                    className="w-full rounded-md border p-2 text-sm"
                >
                    <option value="">-- 暂不关联 --</option>
                    {notes.map((note) => (
                        <option key={note.noteId} value={note.noteId}>
                            {note.noteTitle}
                        </option>
                    ))}
                </select>
            </div>
        </LinkManagerSheet>
    );
};