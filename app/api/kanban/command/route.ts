import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  executeFormalKanbanCommand,
  type FormalKanbanCommand,
  type FormalCommandResult,
} from "@/lib/formalKanbanCommands";
import { sanitizeStoredSyncSnapshot, type SyncSnapshotPayload } from "@/lib/syncSnapshotIntegrity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" } satisfies Partial<FormalCommandResult>, { status: 401 });
  }

  let command: FormalKanbanCommand;
  try {
    command = (await request.json()) as FormalKanbanCommand;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" } satisfies Partial<FormalCommandResult>, { status: 400 });
  }

  const current = await prisma.workspaceSnapshot.findUnique({
    where: { userId: session.user.id },
    select: { data: true },
  });

  const sanitizedCurrent = current?.data
    ? sanitizeStoredSyncSnapshot(current.data)
    : { ok: true, snapshot: null as SyncSnapshotPayload | null, repairSummary: null };

  if (!sanitizedCurrent.ok) {
    return NextResponse.json(
      {
        success: false,
        error: "Stored snapshot failed integrity validation",
        verification: { verified: false, details: ["现有云端快照校验失败"] },
      } satisfies Partial<FormalCommandResult>,
      { status: 409 },
    );
  }

  const result = executeFormalKanbanCommand(sanitizedCurrent.snapshot, command);
  if (!result.success || !result.snapshot) {
    return NextResponse.json(result, { status: 400 });
  }

  const saved = await prisma.workspaceSnapshot.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, data: result.snapshot as object },
    update: { data: result.snapshot as object },
    select: { updatedAt: true },
  });

  const nextResult: FormalCommandResult = {
    ...result,
    snapshot: {
      ...result.snapshot,
      _cloudSyncTime: saved.updatedAt.toISOString(),
    },
  };

  return NextResponse.json(nextResult);
}
