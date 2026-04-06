// POST /api/memory/store
// 接收一轮对话消息，生成 LLM 摘要后向量化存入 ConversationMemory 表
//
// Body: {
//   sessionId: string           - 会话标识（来自 chatbotId）
//   messages:  { role: string, content: string }[]  - 本轮对话内容
//   config:    LLMConfig        - 用户 LLM 配置（含 API Key）
// }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, summarizeDialogueForEmbedding } from "@/services/EmbeddingService";
import type { LLMConfig } from "@/api/llm";

export const dynamic = "force-dynamic";

interface StoreBody {
    sessionId: string;
    messages: { role: string; content: string }[];
    config: LLMConfig;
}

// 使用 services/EmbeddingService.summa rizeDialogueForEmbedding 生成用于嵌入的摘要/代码说明

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    let body: StoreBody;
    try {
        body = (await req.json()) as StoreBody;
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { sessionId, messages, config } = body;
    if (!sessionId || !Array.isArray(messages) || messages.length === 0 || !config?.usertoken) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 原始对话文本
    const content = messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

    try {
        // 先生成用于向量化的摘要/代码说明，再对该摘要做 embedding（避免将原始代码内容直接嵌入）
        const summary = await summarizeDialogueForEmbedding(messages, config);
        const embedding = await generateEmbedding(summary, config);

        const embeddingStr = `[${embedding.join(",")}]`;
        const id = crypto.randomUUID();

        await prisma.$executeRaw`
            INSERT INTO "ConversationMemory" (id, "userId", "sessionId", content, summary, embedding, "createdAt")
            VALUES (${id}, ${userId}, ${sessionId}, ${content}, ${summary}, ${embeddingStr}::vector, NOW())
        `;

        return NextResponse.json({ success: true, id });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
