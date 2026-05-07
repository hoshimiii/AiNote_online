import { useState } from "react";
import { Button } from "../ui/button";
import type { Note } from "@/store/kanban";
import { LinkManagerSheet } from "./LinkManagerSheet";

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
    const currentNote = notes.find(n => n.noteId === currentNoteId);
    const currentBlock = currentNote?.blocks.find((block) => block.blockId === currentBlockId);

    const handleNoteChange = (noteId: string) => {
        setSelectedNoteId(noteId);
        setSelectedBlockId("");
    };

    const getBlockPreview = (content: string) => {
        const text = content.replace(/^#+\s*/, "").trim();
        return text.length > 40 ? text.slice(0, 40) + "…" : text || "(空白)";
    };

    return (
        <LinkManagerSheet
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (nextOpen) {
                    setSelectedNoteId(currentNoteId || "");
                    setSelectedBlockId(currentBlockId || "");
                }
            }}
            title="管理 SubTask 与 Note/Block 关联"
            description="可以只关联 Note，也可以进一步精确到某个 Block。"
            currentSummary={
                <div className="space-y-1 text-sm">
                    <div className="font-medium">{currentNote ? currentNote.noteTitle : "当前未关联 Note"}</div>
                    <div className="text-muted-foreground">{currentBlock ? `Block：${getBlockPreview(currentBlock.blockContent)}` : "当前未关联具体 Block"}</div>
                </div>
            }
            preview={selectedNote ? (
                <div className="space-y-3 text-sm">
                    <div>
                        <div className="font-medium">{selectedNote.noteTitle}</div>
                        <div className="text-muted-foreground">{selectedNote.blocks.length} 个 Block</div>
                    </div>
                    <div className="space-y-2">
                        {selectedNote.blocks.length > 0 ? selectedNote.blocks.map((block) => (
                            <div
                                key={block.blockId}
                                className={`rounded-lg border p-2 text-xs ${block.blockId === selectedBlockId ? "border-blue-500 bg-blue-50 text-blue-700" : "border-border text-muted-foreground"}`}
                            >
                                [{block.blockType}] {getBlockPreview(block.blockContent)}
                            </div>
                        )) : <div className="text-sm text-muted-foreground">该 Note 暂无 Block。</div>}
                    </div>
                </div>
            ) : (
                <div className="text-sm text-muted-foreground">选择 Note 后，这里会显示其 Block 列表与摘要。</div>
            )}
            onSave={() => onConfirm(selectedNoteId, selectedBlockId)}
            onClear={() => {
                setSelectedNoteId("");
                setSelectedBlockId("");
            }}
            trigger={trigger || <Button variant="ghost" size="sm">Link</Button>}
        >
            <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">选择 Note</div>
                <select
                    value={selectedNoteId}
                    onChange={(event) => handleNoteChange(event.target.value)}
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

            {selectedNote ? (
                <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">选择 Block</div>
                    <select
                        value={selectedBlockId}
                        onChange={(event) => setSelectedBlockId(event.target.value)}
                        className="w-full rounded-md border p-2 text-sm"
                    >
                        <option value="">-- 仅关联 Note --</option>
                        {selectedNote.blocks.map((block) => (
                            <option key={block.blockId} value={block.blockId}>
                                [{block.blockType}] {getBlockPreview(block.blockContent)}
                            </option>
                        ))}
                    </select>
                </div>
            ) : null}

            {onCreateNote ? (
                <div className="rounded-lg border border-dashed p-3">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">快速操作</div>
                    <Button variant="outline" size="sm" onClick={() => {
                        const newId = onCreateNote();
                        if (newId) {
                            setSelectedNoteId(newId);
                            setSelectedBlockId("");
                        }
                    }}>
                        新建笔记
                    </Button>
                </div>
            ) : null}
        </LinkManagerSheet>
    );
};
