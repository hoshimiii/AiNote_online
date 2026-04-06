// EmbeddingService.ts
// 服务端 embedding 工具，调用 OpenAI 兼容的 /embeddings 端点
// 支持：SiliconFlow（BAAI/bge-m3，1024 dim）和 OpenAI（text-embedding-3-small，1024 dim truncated）
//
// 设计原则：
// - 仅在服务端（API routes）调用，避免 API Key 被打包进客户端 bundle
// - 所有参数通过 config 对象传入，不依赖环境变量

import type { LLMConfig } from "@/api/llm";

/** 从 chat completions URL 推导出 embeddings URL */
function resolveEmbeddingEndpoint(baseurl: string): string {
    return (
        baseurl
            .replace(/\/chat\/completions$/, "")
            .replace(/\/$/, "") + "/embeddings"
    );
}

/** 根据 baseurl 自动选择合适的 embedding 模型 */
function resolveEmbeddingModel(baseurl: string): string {
    if (baseurl.includes("siliconflow")) return "BAAI/bge-m3";
    // OpenAI text-embedding-3-small 支持 dimensions 参数裁剪到 1024
    return "text-embedding-3-small";
}

/**
 * 将单段文本转换为 1024 维向量。
 * @throws 当 HTTP 响应非 2xx 时抛出包含状态码的错误
 */
export async function generateEmbedding(text: string, config: LLMConfig): Promise<number[]> {
    const endpoint = resolveEmbeddingEndpoint(config.baseurl);
    const model = resolveEmbeddingModel(config.baseurl);

    // OpenAI 新模型支持 dimensions 截断；旧模型仅 BAAI/bge-m3 原生 1024 维
    const body: Record<string, unknown> = { model, input: text };
    if (!baseurl_is_siliconflow(config.baseurl)) {
        // text-embedding-3-small 支持 dimensions 缩减
        body.dimensions = 1024;
    }

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.usertoken}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Embedding API error ${res.status}: ${errorText}`);
    }

    const json = (await res.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
    };

    const embedding = json.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Embedding response contains no vectors");
    }
    return embedding;
}

/** 批量 embed，顺序与输入保持一致 */
export async function generateEmbeddings(texts: string[], config: LLMConfig): Promise<number[][]> {
    return Promise.all(texts.map((t) => generateEmbedding(t, config)));
}

function baseurl_is_siliconflow(baseurl: string): boolean {
    return baseurl.includes("siliconflow");
}

/**
 * 将任意文本或代码转换为用于嵌入的自然语言说明。
 * - 若包含代码块（``` 或 類似代码标记），返回一段中文说明：代码做什么、输入输出、注意点（不包含原代码）。
 * - 否则返回一段不超过 200 字的中文摘要用于向量化。
 */
export async function summarizeTextForEmbedding(text: string, config: LLMConfig, maxTokens = 300): Promise<string> {
    const baseurl = config.baseurl.replace(/\/chat\/completions$/, "").replace(/\/$/, "");
    const endpoint = `${baseurl}/chat/completions`;

    const hasCodeFence = /```|<code>|function\s+\w+\(|=>|\{\s*\n/.test(text);

    const systemPrompt = hasCodeFence
        ? "你是一个精通多种编程语言的助理。下面给出的文本可能包含代码，请用中文用一段不超过200字的话清楚地描述：这段代码的用途、主要逻辑、输入输出和使用时需要注意的点。不要返回原始代码，只返回自然语言说明。"
        : "你是一个文本摘要助手。请用中文用一段不超过200字的话总结以下文本的核心含义，便于后续做语义检索。不要包含原文重复内容。";

    const body = {
        model: config.model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
        ],
        stream: false,
        max_tokens: maxTokens,
    };

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.usertoken}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Summarize API error ${res.status}: ${txt}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const out = json.choices?.[0]?.message?.content?.trim();
    return out && out.length > 0 ? out : text.slice(0, 200);
}

export async function summarizeDialogueForEmbedding(
    messages: { role: string; content: string }[],
    config: LLMConfig
): Promise<string> {
    const dialogue = messages.map((m) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`).join("\n");
    return summarizeTextForEmbedding(dialogue, config, 300);
}
