import { fetchLLMStream, type ApiMessage, type LLMConfig } from "@/api/llm";

export type { LLMConfig, ApiMessage };

export async function* streamCompletion(
    messages: ApiMessage[],
    config: LLMConfig
): AsyncGenerator<string> {
    const response = await fetchLLMStream(messages, config);
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let carry = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });
        const lines = carry.split("\n");
        carry = lines.pop() ?? "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (trimmed.startsWith("data: ")) {
                try {
                    const json = JSON.parse(trimmed.slice(6));
                    const content: string = json.choices[0]?.delta?.content ?? "";
                    if (content) yield content;
                } catch {
                    // 忽略解析失败的碎片
                }
            }
        }
    }
    const tail = carry.trim();
    if (tail.startsWith("data: ") && tail !== "data: [DONE]") {
        try {
            const json = JSON.parse(tail.slice(6));
            const content: string = json.choices[0]?.delta?.content ?? "";
            if (content) yield content;
        } catch {
            /* empty */
        }
    }
}

export async function completion(
    messages: ApiMessage[],
    config: LLMConfig
): Promise<string> {
    let full = "";
    for await (const chunk of streamCompletion(messages, config)) {
        full += chunk;
    }
    return full;
}

export function sliceContext(
    messages: { role: "user" | "assistant" | "chatbot"; messageContent: string }[],
    contextLength: number
): ApiMessage[] {
    return messages.slice(-contextLength).map((msg) => ({
        role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
        content: msg.messageContent,
    }));
}
