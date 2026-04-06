// MemoryManager.ts — 客户端记忆管理器
// 封装 /api/memory/* 路由调用，供 Chatbot store 使用
// 不在此文件做任何向量运算——所有计算都在服务端 API routes 完成

import type { LLMConfig } from "@/api/llm";

export interface MemorySnippet {
    summary: string;
    similarity: number;
}

/**
 * 根据当前用户输入，从历史记忆中语义检索相关片段
 * @returns 摘要文本数组（已按相似度降序排列），失败时返回空数组
 */
export async function retrieveMemories(
    query: string,
    config: LLMConfig,
    topK = 5
): Promise<string[]> {
    try {
        const res = await fetch("/api/memory/retrieve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, topK, config }),
        });
        if (!res.ok) return [];
        const json = (await res.json()) as { memories?: MemorySnippet[] };
        return (json.memories ?? []).map((m) => m.summary);
    } catch {
        return [];
    }
}

/**
 * 异步将对话轮次存入向量记忆库（不阻塞 UI，错误静默处理）
 */
export async function storeSession(
    sessionId: string,
    messages: { role: string; content: string }[],
    config: LLMConfig
): Promise<void> {
    if (messages.length === 0) return;
    try {
        await fetch("/api/memory/store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, messages, config }),
        });
    } catch {
        // 静默失败：记忆存储失败不应影响聊天正常使用
    }
}
