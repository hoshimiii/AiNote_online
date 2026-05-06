import { useWorkSpace, type WorkSpaceProps } from "@/store/kanban";
import type { FormalKanbanCommand, FormalCommandResult } from "@/lib/formalKanbanCommands";

function applySnapshotToStore(snapshot: NonNullable<FormalCommandResult["snapshot"]>) {
  useWorkSpace.getState().applyLoadedSnapshot({
    workspaces: snapshot.workspaces,
    activeWorkSpaceId: snapshot.activeWorkSpaceId ?? null,
    activeMissionId: snapshot.currentMissionId ?? null,
    currentMissionId: snapshot.currentMissionId ?? null,
    currentNoteId: snapshot.currentNoteId ?? null,
    previewMissionId: null,
    missions: snapshot.missions,
    boards: snapshot.boards,
    tasks: snapshot.tasks,
    missionOrder: snapshot.missionOrder,
    boardOrder: snapshot.boardOrder,
    _cloudSyncTime: snapshot._cloudSyncTime ?? null,
  } satisfies Partial<WorkSpaceProps>);
}

export async function executeFormalKanbanCommandClient(command: FormalKanbanCommand): Promise<FormalCommandResult> {
  const response = await fetch("/api/kanban/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });

  const payload = (await response.json()) as FormalCommandResult;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? `正式命令执行失败（${response.status}）`);
  }

  if (payload.snapshot) {
    applySnapshotToStore(payload.snapshot);
  }

  return payload;
}
