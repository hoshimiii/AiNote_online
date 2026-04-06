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
import { generateEmbedding } from "@/services/EmbeddingService";
import type { LLMConfig } from "@/api/llm";

export const dynamic = "force-dynamic";

interface StoreBody {
    sessionId: string;
    messages: { role: string; content: string }[];
    config: LLMConfig;
}

/** 调用 LLM 生成对话摘要（非流式，简单 POST） */
async function summarizeMessages(
    messages: { role: string; content: string }[],
    config: LLMConfig
): Promise<string> {
    const dialogue = messages
        .map((m) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`)
        .join("\n");

    const summaryPrompt = [
        { role: "system", content: "你是一个对话摘要助手，请用不超过 200 字的中文总结以下对话的核心内容和结论。" },
        { role: "user", content: dialogue },
    ];

    const baseurl = config.baseurl.replace(/\/chat\/completions$/, "").replace(/\/$/, "");
    const res = await fetch(`${baseurl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.usertoken}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages: summaryPrompt,
            stream: false,
            max_tokens: 300,
        }),
    });

    if (!res.ok) {
        throw new Error(`Summary LLM error ${res.status}`);
    }

    const json = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() ?? dialogue.slice(0, 200);
}

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
        const [summary, embedding] = await Promise.all([
            summarizeMessages(messages, config),
            generateEmbedding(content, config),
        ]);

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
