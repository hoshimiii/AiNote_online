const REACT_PROMPT_TEMPLATE = `
请注意，你是一个有能力调用外部工具的智能看板笔记助手。

可用工具如下:
{tools}

请严格按照以下格式进行回应:

Thought: 你的思考过程，用于分析问题、拆解任务和规划下一步行动。
Action: 你决定采取的行动，必须是以下格式之一:
- \`{tool_name}[{tool_input}]\`:调用一个可用工具。
- \`Finish[最终答案]\`:当你认为已经获得最终答案时。
- 当你收集到足够的信息，能够回答用户的最终问题时，你必须在Action:字段后使用 Finish[最终答案] 来输出最终答案。

额外规则:
- tool_input 必须是合法 JSON 对象；如果工具没有参数，也必须写成 \`{}\`。
- 只要任务涉及创建、修改、删除笔记/任务/块等数据，必须先调用对应工具，拿到成功 Observation 后才能说“已完成”。
- 如果工具报错或没有执行成功，禁止声称已经完成。
- 如果是写入类操作，完成后应尽量再调用一次读取工具确认结果。

现在，请开始解决以下问题:
Question: {question}
History: {history}
`;

export interface LLMClient {
    think: (params: { messages: { role: "user" | "assistant" | "system"; content: string }[] }) => Promise<string>;
}

export interface ToolExecutor {
    getAvailableTools: () => string;
    getTool: (name: string) => ((input: string) => Promise<string> | string | unknown) | undefined;
}

export interface AgentTrace {
    step: number;
    phase: "thought" | "action" | "observation";
    content: string;
}

export class ReActAgent {
    private llmClient: LLMClient;
    private toolExecutor: ToolExecutor;
    private maxSteps: number;
    private history: string[];

    constructor(llmClient: LLMClient, toolExecutor: ToolExecutor, maxSteps: number = 5) {
        this.llmClient = llmClient;
        this.toolExecutor = toolExecutor;
        this.maxSteps = maxSteps;
        this.history = [];
    }

    async run(
        question: string,
        chatHistory: string[] = [],
        options?: { onTrace?: (trace: AgentTrace) => void }
    ): Promise<string | null> {
        this.history = [];
        let currentStep = 0;

        while (currentStep < this.maxSteps) {
            currentStep += 1;
            const toolsDesc = this.toolExecutor.getAvailableTools();
            const historyStr = [...chatHistory.slice(-10), ...this.history].join("\n");
            const prompt = REACT_PROMPT_TEMPLATE
                .replace("{tools}", toolsDesc)
                .replace("{question}", question)
                .replace("{history}", historyStr);

            const messages = [{ role: "user" as const, content: prompt }];
            const responseText = await this.llmClient.think({ messages });

            if (!responseText) {
                break;
            }

            const { thought, action } = this.parseOutput(responseText);

            if (!action) {
                break;
            }

            if (thought) {
                options?.onTrace?.({ step: currentStep, phase: "thought", content: thought });
            }

            if (action.startsWith("Finish")) {
                const match = action.match(/Finish\[(.*)\]/s);
                const finalAnswer = match ? match[1] : "";
                return finalAnswer;
            }

            const { toolName, toolInput } = this.parseAction(action);
            if (!toolName || toolInput === null) {
                break;
            }

            options?.onTrace?.({ step: currentStep, phase: "action", content: `${toolName}[${toolInput}]` });

            const toolFn = this.toolExecutor.getTool(toolName);
            let observation: unknown;
            if (!toolFn) {
                observation = `错误:未找到名为 '${toolName}' 的工具。`;
            } else {
                try {
                    observation = await toolFn(toolInput);
                } catch (e: any) {
                    observation = `工具执行出错: ${e?.message ?? String(e)}`;
                }
            }

            options?.onTrace?.({
                step: currentStep,
                phase: "observation",
                content: typeof observation === "string" ? observation : JSON.stringify(observation),
            });

            if (thought) {
                this.history.push(`Thought: ${thought}`);
            }
            this.history.push(`Action: ${action}`);
            this.history.push(`Observation: ${typeof observation === "string" ? observation : JSON.stringify(observation)}`);
        }

        return null;
    }

    private parseOutput(text: string): { thought: string | null; action: string | null } {
        const thoughtMatch = text.match(/Thought:\s*(.*?)(?=\nAction:|$)/s);
        const actionMatch = text.match(/Action:\s*(.*?)$/s);
        const thought = thoughtMatch ? thoughtMatch[1].trim() : null;
        const action = actionMatch ? actionMatch[1].trim() : null;
        return { thought, action };
    }

    private parseAction(actionText: string): { toolName: string | null; toolInput: string | null } {
        const match = actionText.match(/(\w+)\[(.*)\]/s);
        if (!match) return { toolName: null, toolInput: null };
        return { toolName: match[1], toolInput: match[2] };
    }
}

export default ReActAgent;
