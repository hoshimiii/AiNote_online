// POST /api/memory/retrieve
// 对用户输入做语义检索，返回 top-K 相关历史记忆片段
//
// Body: {
//   query:  string      - 当前用户输入（用于生成查询向量）
//   topK?:  number      - 返回数量，默认 5
//   config: LLMConfig   - 用户 LLM 配置（含 API Key，用于 embedding）
// }
// Response: { memories: { summary: string; similarity: number }[] }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/services/EmbeddingService";
import type { LLMConfig } from "@/api/llm";

export const dynamic = "force-dynamic";

interface RetrieveBody {
    query: string;
    topK?: number;
    config: LLMConfig;
}

interface MemoryRow {
    id: string;
    summary: string;
    similarity: number;
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    let body: RetrieveBody;
    try {
        body = (await req.json()) as RetrieveBody;
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { query, topK = 5, config } = body;
    if (!query?.trim() || !config?.usertoken) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const safeTopK = Math.min(Math.max(1, topK), 20);
    const SIMILARITY_THRESHOLD = 0.7;

    try {
        const queryEmbedding = await generateEmbedding(query, config);
        const embeddingStr = `[${queryEmbedding.join(",")}]`;

        const rows = await prisma.$queryRaw<MemoryRow[]>`
            SELECT
                id,
                summary,
                1 - (embedding <=> ${embeddingStr}::vector) AS similarity
            FROM "ConversationMemory"
            WHERE
                "userId" = ${userId}
                AND embedding IS NOT NULL
                AND 1 - (embedding <=> ${embeddingStr}::vector) > ${SIMILARITY_THRESHOLD}
            ORDER BY embedding <=> ${embeddingStr}::vector
            LIMIT ${safeTopK}
        `;

        return NextResponse.json({
            memories: rows.map((r) => ({
                summary: r.summary,
                similarity: Number(r.similarity),
            })),
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
