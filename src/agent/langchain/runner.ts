import {
    HumanMessage,
    AIMessage,
    AIMessageChunk,
    SystemMessage,
    ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createLangChainModel } from "./model";
import { createOpenAIToolSchemas, createToolMap } from "./tools";
import type { LLMConfig } from "@/api/llm";
import type { AgentTrace } from "@/agent/ReActAgent/main";

const buildSystemPrompt = (userRules?: string, relatedMemories?: string[]) => {
    const base = `你是一个有能力调用外部工具的智能看板笔记助手。
只要任务涉及创建、修改、删除笔记/任务/块等数据，必须先调用对应工具，拿到成功结果后才能说"已完成"。
如果工具报错，禁止声称已经完成。
优先使用批量工具（如 rewrite_note）而不是逐块操作，减少工具调用次数。
写入操作完成后无需再读取验证，直接告知用户结果。`;
    let prompt = userRules?.trim() ? `${base}\n\n用户规则：\n${userRules.trim()}` : base;
    if (relatedMemories && relatedMemories.length > 0) {
        prompt += `\n\n## 相关记忆\n${relatedMemories.map((m) => `- ${m}`).join("\n")}`;
    }
    return prompt;
};

/**
 * 工具执行结果，可用于后续 LangGraph 状态节点判断跳转。
 * onToolError 返回 "retry" 触发重试，返回 "abort" 提前终止。
 */
export interface RunConfig {
    onTrace?: (trace: AgentTrace) => void;
    onStreamDelta?: (delta: string) => void;
    onStreamReset?: () => void;
    onToolError?: (toolName: string, error: string, step: number) => "retry" | "abort" | "continue";
    maxSteps?: number;
    /** RAG 检索到的相关历史记忆摘要，注入 system prompt 的 ## 相关记忆 段落 */
    relatedMemories?: string[];
}

function textDeltaFromChunk(chunk: AIMessageChunk): string {
    const c = chunk.content;
    if (typeof c === "string") return c;
    if (!Array.isArray(c)) return "";
    let s = "";
    for (const block of c) {
        if (
            block &&
            typeof block === "object" &&
            "type" in block &&
            (block as { type: string }).type === "text" &&
            "text" in block
        ) {
            s += String((block as { text: string }).text);
        }
    }
    return s;
}

function chunkToAIMessage(chunk: AIMessageChunk): AIMessage {
    return new AIMessage({
        content: chunk.content,
        tool_calls: chunk.tool_calls ?? [],
        invalid_tool_calls: chunk.invalid_tool_calls ?? [],
        additional_kwargs: chunk.additional_kwargs,
        response_metadata: chunk.response_metadata,
        id: chunk.id,
    });
}

function messageContentString(content: unknown): string {
    if (typeof content === "string") return content.trim();
    if (!Array.isArray(content)) return "";
    return content
        .map((b) =>
            b && typeof b === "object" && "type" in b && (b as { type: string }).type === "text" && "text" in b
                ? String((b as { text: string }).text)
                : ""
        )
        .join("")
        .trim();
}

/**
 * 摘要压缩（Phase 4）：当历史消息总字符数超过阈值时，
 * 调用 LLM 将最旧的一批消息压缩为单条摘要消息，保留最近 6 条不压缩。
 * 系统消息和最新 HumanMessage 始终保留。
 */
async function compressHistory(
    messages: BaseMessage[],
    model: ReturnType<typeof createLangChainModel>,
    charThreshold = 8000
): Promise<BaseMessage[]> {
    const nonSystem = messages.filter((m) => !(m instanceof SystemMessage));
    const totalChars = nonSystem.reduce((s, m) => s + String(m.content).length, 0);
    if (totalChars <= charThreshold) return messages;

    const systemMessages = messages.filter((m) => m instanceof SystemMessage);
    // 保留最近 6 条（约 3 轮对话）
    const toKeep = nonSystem.slice(-6);
    const toCompress = nonSystem.slice(0, -6);
    if (toCompress.length === 0) return messages;

    const dialogueText = toCompress
        .map((m) => `${m._getType()}: ${messageContentString(m.content)}`)
        .join("\n");

    try {
        const summaryMsg = await model.invoke([
            new SystemMessage("请用不超过 300 字的中文概括以下对话的核心主题和结论，输出纯文本摘要。"),
            new HumanMessage(dialogueText),
        ]);
        const summary = messageContentString(summaryMsg.content);
        return [...systemMessages, new AIMessage(`[历史摘要] ${summary}`), ...toKeep];
    } catch {
        // 压缩失败则保持原样，不影响主流程
        return messages;
    }
}

export const runLangChainAgent = async (
    config: LLMConfig,
    input: string,
    chatHistory: string[] = [],
    options?: RunConfig
): Promise<string> => {
    if (!config.usertoken?.trim()) {
        throw new Error("请先在左侧栏设置中配置 API Key");
    }
    const { onTrace, onStreamDelta, onStreamReset, onToolError, maxSteps: _maxSteps = 20, relatedMemories } =
        options ?? {};
    const maxSteps = _maxSteps;
    const model = createLangChainModel(config);
    const toolSchemas = createOpenAIToolSchemas();
    const toolMap = createToolMap();
    const modelWithTools = model.bindTools(toolSchemas);

    const historyMessages: BaseMessage[] = chatHistory.flatMap((line: string): BaseMessage[] => {
        if (line.startsWith("user: ")) return [new HumanMessage(line.slice(6))];
        if (line.startsWith("chatbot: ")) return [new AIMessage(line.slice(9))];
        return [];
    });

    let messages: BaseMessage[] = [
        new SystemMessage(buildSystemPrompt(config.userRules, relatedMemories)),
        ...historyMessages,
        new HumanMessage(input),
    ];

    // Phase 4：摘要压缩 — 当非系统消息总字符超过 8000 时，压缩旧历史防止 context 溢出
    messages = await compressHistory(messages, model);

    for (let i = 0; i < maxSteps; i++) {
        const step = i + 1;
        let gathered: AIMessageChunk | undefined;
        const tokenStream = await modelWithTools.stream(messages);
        for await (const part of tokenStream) {
            gathered = gathered ? gathered.concat(part) : part;
            const delta = textDeltaFromChunk(part);
            if (delta) onStreamDelta?.(delta);
        }
        if (!gathered) throw new Error("模型无响应");
        const response = chunkToAIMessage(gathered);
        messages.push(response);

        const contentText = messageContentString(response.content);
        if (contentText && onTrace) {
            onTrace({ step, phase: "thought", content: contentText });
        }

        const toolCalls = response.tool_calls ?? [];
        if (toolCalls.length === 0) {
            return contentText;
        }

        onStreamReset?.();

        for (const toolCall of toolCalls) {
            onTrace?.({
                step,
                phase: "action",
                content: `${toolCall.name}[${JSON.stringify(toolCall.args)}]`,
            });

            let result: string;
            const executeFn = toolMap[toolCall.name];
            if (!executeFn) {
                result = `错误: 未找到名为 '${toolCall.name}' 的工具。`;
            } else {
                try {
                    result = await executeFn(toolCall.args);
                } catch (e: unknown) {
                    const errMsg = `工具执行出错: ${e instanceof Error ? e.message : String(e)}`;
                    const action = onToolError?.(toolCall.name, errMsg, step) ?? "continue";
                    if (action === "abort") return errMsg;
                    result = errMsg;
                }
            }

            onTrace?.({ step, phase: "observation", content: result });

            messages.push(
                new ToolMessage({
                    content: result,
                    tool_call_id: toolCall.id ?? `call_${step}`,
                    name: toolCall.name,
                })
            );
        }
    }

    return "已达到最大步数，处理终止。";
};
