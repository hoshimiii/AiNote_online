import { completion, type LLMConfig } from "@/services/LLMService";
import type { LLMClient } from "./ReActAgent/main";

export const createAgentLLM = (config: LLMConfig): LLMClient => ({
    think: ({ messages }) => completion(messages, config),
});
