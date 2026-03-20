import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createLangChainModel } from "./model";
import { createOpenAIToolSchemas, createToolMap } from "./tools";
import type { LLMConfig } from "@/api/llm";
import type { AgentTrace } from "@/agent/ReActAgent/main";

const buildSystemPrompt = (userRules?: string) => {
    const base = `你是一个有能力调用外部工具的智能看板笔记助手。
只要任务涉及创建、修改、删除笔记/任务/块等数据，必须先调用对应工具，拿到成功结果后才能说"已完成"。
如果工具报错，禁止声称已经完成。
如果是写入类操作，完成后应尽量再调用一次读取工具确认结果。`;
    if (userRules?.trim()) return `${base}\n\n用户规则：\n${userRules.trim()}`;
    return base;
};

/**
 * 工具执行结果，可用于后续 LangGraph 状态节点判断跳转。
 * onToolError 返回 "retry" 触发重试，返回 "abort" 提前终止。
 */
export interface RunConfig {
    onTrace?: (trace: AgentTrace) => void;
    onToolError?: (toolName: string, error: string, step: number) => "retry" | "abort" | "continue";
    maxSteps?: number;
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
    const { onTrace, onToolError, maxSteps: _maxSteps = 20 } = options ?? {};
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

    const messages: BaseMessage[] = [
        new SystemMessage(buildSystemPrompt(config.userRules)),
        ...historyMessages,
        new HumanMessage(input),
    ];

    for (let i = 0; i < maxSteps; i++) {
        const step = i + 1;
        const response = await modelWithTools.invoke(messages);
        messages.push(response);

        const contentText = typeof response.content === "string" ? response.content.trim() : "";
        if (contentText && onTrace) {
            onTrace({ step, phase: "thought", content: contentText });
        }

        const toolCalls = response.tool_calls ?? [];
        if (toolCalls.length === 0) {
            return contentText;
        }

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
