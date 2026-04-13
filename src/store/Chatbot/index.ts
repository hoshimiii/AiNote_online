import { generateRandomId } from "@/components/utils/RandomGenerator";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sliceContext, type LLMConfig, type ApiMessage } from "@/services/LLMService";
import { runLangChainAgent } from "@/agent/langchain/runner";
import { retrieveMemories, storeSession } from "@/services/MemoryManager";

export type Message = {
    messageId: string;
    messageContent: string;
    role: "user" | "assistant" | "chatbot";
    messageCreatedAt: string;
    messageTimestamp: number;
    tracePhase?: "thought" | "action" | "observation";
    traceStep?: number;
};

export interface ChatbotState {
    chatbotId: string;
    chatbotName: string;
    chatbotDescription: string;
    config: LLMConfig;
    messages: Message[];
    input: string;
    isLoading: boolean;

    setConfig: (config: Partial<LLMConfig>) => void;
    handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (
        e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>,
        input: string
    ) => void;
    sendMessage: (input: string) => Promise<void>;
    getContext: (contextLength: number) => ApiMessage[];
    clearMessages: () => void;
    resetChatbot: () => void;
}

export const useChatbot = create<ChatbotState>()(
    persist(
        (set, get) => ({
            chatbotId: generateRandomId(),
            chatbotName: "Chatbot",
            chatbotDescription: "test",
            config: {
                baseurl: "https://api.siliconflow.cn/v1/chat/completions",
                model: "deepseek-ai/DeepSeek-V3.2",
                usertoken: "",
                temperature: 0.7,
                userRules: "",
            },
            messages: [],
            input: "",
            isLoading: false,

            setConfig: (partial) =>
                set((state) => ({ config: { ...state.config, ...partial } })),

            handleInputChange: (e) => set({ input: e.target.value }),

            handleSubmit: (e, input) => {
                e.preventDefault();
                if (!input.trim()) return;
                set({ input: "" });
                get().sendMessage(input);
            },

            sendMessage: async (input: string) => {
                if (!input.trim()) return;
                if (!get().config.usertoken?.trim()) {
                    const now = new Date().toISOString();
                    set((state) => ({
                        messages: [
                            ...state.messages,
                            {
                                messageId: generateRandomId(),
                                messageContent: input,
                                role: "user",
                                messageCreatedAt: now,
                                messageTimestamp: Date.now(),
                            },
                            {
                                messageId: generateRandomId(),
                                messageContent:
                                    "请先在侧边栏「设置」里填写 API Key（对应 SiliconFlow/OpenAI 兼容的密钥），并确认 Base URL 与模型名正确。",
                                role: "chatbot",
                                messageCreatedAt: now,
                                messageTimestamp: Date.now(),
                            },
                        ],
                    }));
                    return;
                }
                const now = new Date().toISOString();
                const userMsg: Message = {
                    messageId: generateRandomId(),
                    messageContent: input,
                    role: "user",
                    messageCreatedAt: now,
                    messageTimestamp: Date.now(),
                };
                set((state) => ({ messages: [...state.messages, userMsg], isLoading: true }));

                const botMsgId = generateRandomId();
                const botMsg: Message = {
                    messageId: botMsgId,
                    messageContent: "",
                    role: "chatbot",
                    messageCreatedAt: now,
                    messageTimestamp: Date.now(),
                };
                set((state) => ({ messages: [...state.messages, botMsg] }));

                const historyLines = get()
                    .messages
                    .filter((m) => m.role !== "assistant")
                    .slice(-30)
                    .map((m) => `${m.role}: ${m.messageContent}`);

                // 语义检索相关历史记忆（失败时静默降级为空数组）
                const relatedMemories = await retrieveMemories(input, get().config).catch(() => []);

                try {
                    const answer = await runLangChainAgent(get().config, input, historyLines, {
                        relatedMemories,
                        onStreamDelta: (delta) => {
                            set((state) => ({
                                messages: state.messages.map((m) =>
                                    m.messageId === botMsgId
                                        ? { ...m, messageContent: m.messageContent + delta }
                                        : m
                                ),
                            }));
                        },
                        onStreamReset: () => {
                            set((state) => ({
                                messages: state.messages.map((m) =>
                                    m.messageId === botMsgId ? { ...m, messageContent: "" } : m
                                ),
                            }));
                        },
                        onTrace: ({ step, phase, content }) => {
                            const title =
                                phase === "thought"
                                    ? `思考 ${step}`
                                    : phase === "action"
                                        ? `动作 ${step}`
                                        : `观察 ${step}`;
                            set((state) => ({
                                messages: [
                                    ...state.messages,
                                    {
                                        messageId: generateRandomId(),
                                        messageContent: `### ${title}\n${content}`,
                                        role: "assistant",
                                        messageCreatedAt: new Date().toISOString(),
                                        messageTimestamp: Date.now(),
                                        tracePhase: phase,
                                        traceStep: step,
                                    },
                                ],
                            }));
                        },
                    });
                    set((state) => ({
                        messages: state.messages.map((m) =>
                            m.messageId === botMsgId
                                ? { ...m, messageContent: answer }
                                : m
                        ),
                    }));

                    // 异步存储本轮对话到向量记忆库（不阻塞 UI）
                    void storeSession(
                        get().chatbotId,
                        [
                            { role: "user", content: input },
                            { role: "assistant", content: answer },
                        ],
                        get().config
                    );
                } catch (e) {
                    let errMsg = e instanceof Error ? e.message : String(e);
                    if (/401/.test(errMsg)) {
                        errMsg =
                            "401 未授权：密钥无效或未带上。请在设置中检查 API Key，SiliconFlow 需在控制台创建令牌；Base URL 一般为 https://api.siliconflow.cn/v1/chat/completions（保存后会自动去掉末尾路径换成 /v1）。";
                    }
                    set((state) => ({
                        messages: state.messages.map((m) =>
                            m.messageId === botMsgId ? { ...m, messageContent: `错误: ${errMsg}` } : m
                        ),
                    }));
                } finally {
                    set({ isLoading: false });
                }
            },

            getContext: (contextLength: number) => sliceContext(get().messages, contextLength),

            clearMessages: () => set({ messages: [] }),
            resetChatbot: () =>
                set({
                    chatbotId: generateRandomId(),
                    messages: [],
                    input: "",
                    isLoading: false,
                }),
        }),
        { name: "chatbot-storage" }
    )
);
