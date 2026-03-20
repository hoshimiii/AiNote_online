import { ChatOpenAI } from "@langchain/openai";
import type { LLMConfig } from "@/api/llm";

export const createLangChainModel = (config: LLMConfig) => {
    const baseURL = config.baseurl.replace(/\/chat\/completions$/, "");
    return new ChatOpenAI({
        model: config.model,
        apiKey: config.usertoken,
        configuration: { baseURL },
        temperature: config.temperature ?? 0.7,
    });
};
