"use client";

import { useWorkSpace } from "@/store/kanban";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/items/DeleteDialog";
import { PencilIcon, TrashIcon } from "lucide-react";
import { RenameDialog } from "@/components/items/RenameDialog";
import { DndContext, type DragEndEvent, type DragOverEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MainPage } from "../mainPage/page";
import { MissionItem } from "@/components/Mission";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateRandomId } from "@/components/utils/RandomGenerator";
import { ChatController } from "@/components/ChatBot/ChatBotWindow";
import { type Mission as MissionType } from "@/store/kanban";
import { NoteItem } from "@/components/Note";
import { AgentSettingsPanel } from "@/components/AgentSettings/AgentSettingsPanel";
import { Settings } from "lucide-react";



export const WorkPage = () => {
    const {
        workspaces, activeWorkSpaceId, currentMissionId, previewMissionId, missions, boards, boardOrder, missionOrder,
        setWorkSpace,
        createMission, setMission, setPreviewMission, clearPreviewMission, deleteMission, RenameMission,
        setActiveNote,
        moveTask,
        reorderMissions, reorderBoards, reorderTasks,
        createNote,
        createBoard,
    } = useWorkSpace();
    const router = useRouter();

    const activeMissions = Object.values(missions).filter((mission) => mission.WorkSpaceId === activeWorkSpaceId);
    const activeNoteId = activeMissions.find((mission) => mission.MissionId === currentMissionId)?.activeNoteId;
    const displayedMissionId = previewMissionId ?? currentMissionId;

    const orderedMissionIds = activeWorkSpaceId ? (missionOrder[activeWorkSpaceId] ?? []) : [];
    const missionMap = Object.fromEntries(activeMissions.map(m => [m.MissionId, m]));
    const orderedMissions = [
        ...orderedMissionIds.map(id => missionMap[id]).filter(Boolean),
        ...activeMissions.filter(m => !orderedMissionIds.includes(m.MissionId)),
    ];

    useEffect(() => {
        const onPop = () => {
            if (currentMissionId && activeNoteId) {
                setActiveNote(currentMissionId, null);
            }
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, [currentMissionId, activeNoteId, setActiveNote]);

    const currentHoverIdRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const preMissionIdRef = useRef<string | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const HandleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current?.type === 'task') {
            preMissionIdRef.current = currentMissionId;
        }
    };

    const HandleDragOver = (event: DragOverEvent) => {
        const { over, active } = event;

        if (over?.data.current?.type === 'board') {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
                currentHoverIdRef.current = null;
            }
            setIsPreviewing(false);
            clearPreviewMission();
            return;
        }

        if (!over || over.data.current?.type !== 'mission') {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
                currentHoverIdRef.current = null;
            }
            clearPreviewMission();
            return;
        }

        if (active.data.current?.type === 'mission') return;

        const overId = over.id as string;
        if (overId !== currentHoverIdRef.current) {
            if (timerRef.current) clearTimeout(timerRef.current);
            currentHoverIdRef.current = overId;
            timerRef.current = setTimeout(() => {
                setPreviewMission(overId);
                setIsPreviewing(true);
            }, 500);
        }
    };

    const HandleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        currentHoverIdRef.current = null;
        clearPreviewMission();

        if (!over || active.id === over.id) {
            setIsPreviewing(false);
            preMissionIdRef.current = null;
            return;
        }

        const activeType = active.data.current?.type;
        const overType = over.data.current?.type;

        if (activeType === 'mission') {
            const activeId = String(active.id);
            const overId = String(over.id);
            const wsId = activeWorkSpaceId;
            if (!wsId) return;
            const currentOrder = missionOrder[wsId] ?? orderedMissions.map(m => m.MissionId);
            const oldIndex = currentOrder.indexOf(activeId);
            const newIndex = currentOrder.indexOf(overId);
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                reorderMissions(wsId, arrayMove(currentOrder, oldIndex, newIndex));
            }
        } else if (activeType === 'board') {
            const activeId = String(active.id);
            const overId = String(over.id);
            const [missionId] = activeId.split('+');
            const currentOrder = boardOrder[missionId] ??
                Object.values(boards).filter(b => b.MissionId === missionId).map(b => missionId + '+' + b.BoardId);
            const oldIndex = currentOrder.indexOf(activeId);
            const newIndex = currentOrder.indexOf(overId);
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
                reorderBoards(missionId, newOrder.map(id => id.split('+')[1]));
            }
        } else if (activeType === 'task') {
            const activeIdStr = String(active.id);
            const overIdStr = String(over.id);
            const [activeMissionSortableId, activeBoardId, activeTaskId] = activeIdStr.split('+');

            if (overType === 'task') {
                const [, overBoardId, overTaskId] = overIdStr.split('+');
                if (activeBoardId === overBoardId) {
                    const board = boards[activeBoardId];
                    if (!board) return;
                    const taskIds = board.Tasks.map(t => activeMissionSortableId + '+' + activeBoardId + '+' + t.TaskId);
                    const oldIndex = taskIds.indexOf(activeIdStr);
                    const newIndex = taskIds.indexOf(overIdStr);
                    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                        const newOrder = arrayMove(board.Tasks.map(t => t.TaskId), oldIndex, newIndex);
                        reorderTasks(activeBoardId, newOrder);
                    }
                } else {
                    const targetBoard = boards[overBoardId];
                    if (!targetBoard) return;
                    const overIndex = targetBoard.Tasks.findIndex(t => t.TaskId === overTaskId);
                    moveTask(activeTaskId, activeBoardId, overBoardId, overIndex);
                }
            } else if (overType === 'board') {
                const [, overBoardId] = overIdStr.split('+');
                if (activeBoardId !== overBoardId) {
                    moveTask(activeTaskId, activeBoardId, overBoardId);
                }
            } else {
                clearPreviewMission();
            }
        }

        setIsPreviewing(false);
        preMissionIdRef.current = null;
    };

    const handleClickmission = (missionId: string) => {
        setMission(missionId);
        setActiveNote(missionId, null);
    };
    const handleClicknote = (missionId: string, noteId: string) => {
        setMission(missionId);
        setActiveNote(missionId, noteId);
    };

    return (
        <div>
            <SidebarProvider>
                <DndContext
                    sensors={sensors}
                    onDragStart={HandleDragStart}
                    onDragEnd={HandleDragEnd}
                    onDragOver={HandleDragOver}
                >
                    <Sidebar side="left">
                        <SidebarHeader>{workspaces.find(workspace => workspace.workspaceId === activeWorkSpaceId)?.workspaceName}</SidebarHeader>
                        <Button
                            variant="outline"
                            onClick={() => { setMission(null); setWorkSpace(null); router.push('/pages/workspacesPage'); }}
                            className="cursor-pointer mx-4 mb-2"
                        >
                            返回工作区
                        </Button>

                        <SidebarContent>
                            <Button className="cursor-pointer" variant="outline" onClick={() => createMission({
                                MissionId: generateRandomId(),
                                activeNoteId: null,
                                WorkSpaceId: activeWorkSpaceId || '',
                                title: 'New Mission',
                                Notes: []
                            })}>Create New Mission</Button>

                            <SortableContext items={orderedMissions.map(m => m.MissionId)} strategy={verticalListSortingStrategy}>
                                <SidebarMenu>
                                    {orderedMissions.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                                            <p className="text-sm">还没有任何任务</p>
                                            <Button variant="default" className="cursor-pointer" onClick={() => createMission({
                                                MissionId: generateRandomId(),
                                                activeNoteId: null,
                                                WorkSpaceId: activeWorkSpaceId || '',
                                                title: 'New Mission',
                                                Notes: []
                                            })}>创建第一个 Mission</Button>
                                        </div>
                                    )}
                                    {orderedMissions.map((mission) => (
                                        <SidebarMenuItem className="group/menu-item flex-col bg-gray-100 rounded-md p-1" key={mission.MissionId}>
                                            <div className="flex justify-between items-center">
                                                <SidebarMenuButton className="cursor-pointer w-[70%]" variant="default" onClick={() => handleClickmission(mission.MissionId)}>
                                                    <MissionItem MissionId={mission.MissionId} WorkSpaceId={mission.WorkSpaceId} title={mission.title} Notes={mission.Notes ?? []} />
                                                </SidebarMenuButton>
                                                <SidebarMenuAction asChild>
                                                    <DeleteDialog
                                                        title="确定要删除任务吗?"
                                                        description="此操作无法撤销，相关数据将永久消失"
                                                        onConfirm={() => deleteMission(mission.MissionId)}
                                                        trigger={<Button variant="ghost" size="sm" className="cursor-pointer group-hover/menu-item:block hidden"><TrashIcon className="w-4 h-4 text-red-500" /></Button>} />
                                                </SidebarMenuAction>
                                                <SidebarMenuAction asChild>
                                                    <RenameDialog
                                                        title="重命名?"
                                                        initialName={mission.title}
                                                        onConfirm={(newName) => RenameMission(mission.MissionId, newName)}
                                                        trigger={<Button variant="ghost" size="sm" className="cursor-pointer group-hover/menu-item:block hidden"><PencilIcon className="w-4 h-4 text-blue-500" /></Button>} />
                                                </SidebarMenuAction>
                                            </div>
                                            {mission.MissionId === displayedMissionId && (
                                                <SidebarMenuSub className="group/sub-menu-item flex-col bg-gray-200 rounded-md p-1 mt-1 h-fit cursor-pointer" key={'notes'}>
                                                    <SidebarContent>
                                                        {mission.Notes?.map((note) => (
                                                            <SidebarMenuItem key={note.noteId} className="h-auto py-0.5" onClick={() => handleClicknote(mission.MissionId, note.noteId)}>
                                                                <NoteItem note={note} nowmission={mission.MissionId} />
                                                            </SidebarMenuItem>
                                                        ))}
                                                    </SidebarContent>
                                                    <SidebarMenuSubButton>
                                                        <Button className="cursor-pointer" variant="outline" onClick={() => createNote(mission.MissionId, {
                                                            noteId: generateRandomId(),
                                                            noteTitle: 'New Note',
                                                            noteContent: '',
                                                            noteCreatedAt: new Date().toISOString(),
                                                            noteUpdatedAt: new Date().toISOString(),
                                                            relatedTaskId: '',
                                                            blocks: []
                                                        })}>create new note</Button>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSub>
                                            )}
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SortableContext>

                        </SidebarContent>
                        <SidebarFooter className="mt-auto">
                            <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => setSettingsOpen(true)}>
                                <Settings className="size-4" />
                            </Button>
                        </SidebarFooter>
                    </Sidebar>
                    <AgentSettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />

                    <main className={cn("flex-1 w-full transition-all duration-200", isPreviewing ? "opacity-50 scale-95 blur-in-sm" : "opacity-100 scale-95 blur-0")}>
                        <SidebarTrigger className="bg-gray-200 w-[20px] h-[20px]" />
                        <MainPage
                            nowMissionId={displayedMissionId}
                            nowNoteId={previewMissionId ? null : (activeNoteId ?? null)}
                            Note_item={activeMissions.find((mission: MissionType) => mission.MissionId === currentMissionId)?.Notes?.find((note) => note.noteId === activeNoteId) ?? null} />
                        <ChatController />
                    </main>
                </DndContext>
            </SidebarProvider>
        </div>
    );
};

export default WorkPage;