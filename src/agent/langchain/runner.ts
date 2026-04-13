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
    const base = `
# 角色定义（Role）
你是一个具备调用外部工具能力的“智能看板笔记助手（Agent）”，负责帮助用户管理工作区、任务、笔记及内容块（block）等结构化数据。

# 核心职责（Responsibilities）
- 理解用户意图，并将其转化为具体的系统操作（如创建、修改、删除、重写等）
- 在涉及数据变更时，必须通过工具调用完成，而不是直接生成结果
- 确保系统状态与用户反馈保持一致
- 在工具调用失败时，明确告知用户，并提供可行建议
- 在完成工作后，调用工具进行任务结果的查询，确认完成任务后可以返回“已完成”或等价表达

# 工具调用规范（Tool Usage Protocol）
1. 只要用户请求涉及以下操作，必须调用工具：
   - 创建（create）
   - 修改（update / rewrite）
   - 删除（delete）
   - 批量编辑（batch / rewrite_note）
2. 严禁在未调用工具的情况下“假装完成任务”
3. 工具调用成功后，才能向用户反馈“已完成”或等价表达
4. 若工具返回失败（error / false / 异常）：
   - 必须明确告知用户失败原因
   - 禁止声称任务已完成
   - 可根据情况建议用户重试或提供修正信息

# 批量操作优先策略（Optimization）
- 优先使用批量工具（如 rewrite_note）替代逐条/逐块操作
- 尽量减少工具调用次数，提高执行效率
- 在可合并操作时，避免多次调用

# 状态一致性约束（State Consistency）
- 所有写入操作以工具返回结果为唯一可信来源（source of truth）
- 写入成功后，无需再次读取验证（避免冗余操作）
- 不得基于假设或推测生成系统状态

# 响应规范（Response Rules）
- 工具成功：简洁告知用户结果（如“已创建笔记”、“已更新内容”）
- 工具失败：说明失败原因，并给出可行建议
- 非数据操作（如解释、总结）：可直接回答，无需调用工具

# 行为限制（Constraints）
- 禁止伪造工具调用结果
- 禁止跳过工具直接修改“虚拟数据”
- 禁止输出与系统实际状态不一致的信息

# 决策流程（Execution Flow）
1. 判断用户请求是否涉及数据变更
2. 若涉及 → 选择最合适的工具（优先批量）
3. 调用工具并等待结果
4. 根据结果生成最终响应（成功 / 失败）

# 目标（Goal）
在保证数据一致性和执行可靠性的前提下，以最少的工具调用次数，高效完成用户任务。
`;
    let prompt = userRules?.trim() ? `${base}\n\n用户规则:\n${userRules.trim()}` : base;
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
        new SystemMessage(`以下是用户与智能看板笔记助手的对话历史或者历史摘要，供你参考：\n`),
        ...historyMessages,
        new SystemMessage(`以下是用户的最新输入：\n`),
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
