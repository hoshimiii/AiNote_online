"use client";
import { useWorkSpace } from "@/store/kanban";
import { Board } from "@/components/Board";
import { Button } from "@/components/ui/button";
import { generateRandomId } from "@/components/utils/RandomGenerator";
import { Note } from "@/components/Note";
import { type Note as NoteType } from "@/store/kanban";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const MainPage = (
    { nowMissionId, nowNoteId, Note_item }: { nowMissionId: string | null, nowNoteId: string | null, Note_item: NoteType | null }
) => {
    const { createBoard, setActiveNote } = useWorkSpace();
    const router = useRouter();
    const [scrollToBlockId, setScrollToBlockId] = useState<string | undefined>();
    return (

        <div >
            {nowMissionId ?
                nowNoteId && Note_item ? (
                    <div>
                        <Note key={nowNoteId} note={Note_item} activeMissionId={nowMissionId} scrollToBlockId={scrollToBlockId} />
                    </div>
                ) : (
                    <>
                        MISSIONID:{nowMissionId}
                        <div className="flex flex-wrap w-[80vw]">
                            <Board nowMissionId={nowMissionId ?? ''} setActiveNoteId={(noteId, blockId) => {
                                setScrollToBlockId(blockId);
                                setActiveNote(nowMissionId ?? '', noteId);
                                router.push('/pages/workPage');
                            }} />
                            <Button className="cursor-pointer" variant="outline" onClick={() => createBoard({
                                BoardId: generateRandomId(),
                                MissionId: nowMissionId ?? '',
                                title: '未开始',
                                Tasks: []
                            })}>New Board</Button>
                        </div>
                    </>
                ) : (
                    <div>
                        <p>请选择一个任务</p>
                    </div>
                )}

        </div>

    )
}

export default MainPage;