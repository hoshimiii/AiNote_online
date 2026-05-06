// /api/sync — 看板数据云端同步接口
//
// 核心知识点：
// 1. 服务端用 auth() 直接获取 session，不需要解析 Cookie 或 Header，Auth.js 负责验证 JWT。
// 2. 快照同步策略（Snapshot Sync）：每次 PUT 都存储完整状态，实现简单，
//    不适合大数据（改用增量同步），但对看板这类中小型数据足够。
// 3. upsert：如果快照不存在则创建，存在则更新——等价于 INSERT ... ON CONFLICT DO UPDATE。

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  sanitizeStoredSyncSnapshot,
  sanitizeSyncSnapshotPayload,
} from "@/lib/syncSnapshotIntegrity"

export const dynamic = "force-dynamic"

// GET /api/sync — 拉取当前用户的最新看板快照
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const snapshot = await prisma.workspaceSnapshot.findUnique({
    where: { userId: session.user.id },
    select: { data: true, updatedAt: true },
  })

  if (!snapshot) {
    // 新用户，还没有云端数据
    return NextResponse.json({ data: null, updatedAt: null, repairSummary: null })
  }

  const normalized = sanitizeStoredSyncSnapshot(snapshot.data)
  if (!normalized.ok || !normalized.snapshot) {
    return NextResponse.json(
      {
        error: "Stored snapshot failed integrity validation",
        updatedAt: snapshot.updatedAt,
        repairSummary: normalized.repairSummary,
      },
      { status: 409 },
    )
  }

  if (normalized.repairSummary.status === 'safe_repair') {
    const updated = await prisma.workspaceSnapshot.update({
      where: { userId: session.user.id },
      data: { data: normalized.snapshot as object },
      select: { updatedAt: true, data: true },
    })

    return NextResponse.json({
      data: updated.data,
      updatedAt: updated.updatedAt,
      repairSummary: normalized.repairSummary,
    })
  }

  return NextResponse.json({
    data: normalized.snapshot,
    updatedAt: snapshot.updatedAt,
    repairSummary: normalized.repairSummary,
  })
}

// PUT /api/sync — 保存当前用户的完整看板快照
export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let data: unknown
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const normalized = sanitizeSyncSnapshotPayload(data)
  if (!normalized.ok || !normalized.snapshot) {
    return NextResponse.json(
      {
        error: "Snapshot integrity validation failed",
        repairSummary: normalized.repairSummary,
      },
      { status: 400 },
    )
  }

  const snapshot = await prisma.workspaceSnapshot.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, data: normalized.snapshot as object },
    update: { data: normalized.snapshot as object },
    select: { updatedAt: true },
  })

  return NextResponse.json({
    updatedAt: snapshot.updatedAt,
    repairSummary: normalized.repairSummary,
  })
}
