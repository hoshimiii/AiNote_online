// POST /api/memory/embed-notes
// 读取当前用户的 WorkspaceSnapshot，提取所有笔记块文本，批量向量化存入 NoteEmbedding 表
// 供 Agent 进行工作区知识 RAG 检索
//
// Body: { config: LLMConfig }
// Response: { embedded: number }  — 成功写入的块数量

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/services/EmbeddingService";
import type { LLMConfig } from "@/api/llm";

export const dynamic = "force-dynamic";

interface EmbedNotesBody {
    config: LLMConfig;
}

// WorkspaceSnapshot.data 的简化类型（只取需要的字段）
interface SnapshotBlock {
    blockType?: string;
    blockContent?: string;
}
interface SnapshotNote {
    noteId?: string;
    noteTitle?: string;
    blocks?: SnapshotBlock[];
}
interface SnapshotData {
    notes?: SnapshotNote[];
    [key: string]: unknown;
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    let body: EmbedNotesBody;
    try {
        body = (await req.json()) as EmbedNotesBody;
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.config?.usertoken) {
        return NextResponse.json({ error: "Missing LLM config" }, { status: 400 });
    }

    // 拉取用户的 WorkspaceSnapshot
    const snapshot = await prisma.workspaceSnapshot.findUnique({
        where: { userId },
        select: { data: true },
    });
    if (!snapshot?.data) {
        return NextResponse.json({ embedded: 0, message: "No snapshot found" });
    }

    const data = snapshot.data as SnapshotData;
    const notes: SnapshotNote[] = Array.isArray(data.notes) ? data.notes : [];

    // 清除旧的 NoteEmbedding（重新全量嵌入）
    await prisma.$executeRaw`DELETE FROM "NoteEmbedding" WHERE "userId" = ${userId}`;

    let embedded = 0;
    for (const note of notes) {
        if (!Array.isArray(note.blocks)) continue;
        const noteId = note.noteId ?? note.noteTitle ?? "unknown";
        for (const block of note.blocks) {
            const text = block.blockContent?.trim();
            if (!text || text.length < 10) continue;

            try {
                const embedding = await generateEmbedding(text, body.config);
                const embeddingStr = `[${embedding.join(",")}]`;
                const id = crypto.randomUUID();

                await prisma.$executeRaw`
                    INSERT INTO "NoteEmbedding" (id, "userId", "noteId", "blockContent", embedding, "createdAt")
                    VALUES (${id}, ${userId}, ${noteId}, ${text}, ${embeddingStr}::vector, NOW())
                `;
                embedded++;
            } catch {
                // 跳过单个失败的 block，继续处理其余
            }
        }
    }

    return NextResponse.json({ embedded });
}
