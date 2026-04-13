import { ChatOpenAI } from "@langchain/openai";
import type { LLMConfig } from "@/api/llm";

export const createLangChainModel = (config: LLMConfig) => {
    const actualBaseURL = config.baseurl.replace(/\/chat\/completions$/, "");

    // 在浏览器环境中通过同域代理转发，避免 Vercel 生产环境的 CORS 问题。
    // 浏览器 → /api/llm（同域，无 CORS）→ 真实 LLM 供应商（服务端，无 CORS）
    const proxyBaseURL =
        typeof window !== "undefined"
            ? `${window.location.origin}/api/llm`
            : actualBaseURL;

    return new ChatOpenAI({
        model: config.model,
        apiKey: config.usertoken,
        configuration: {
            baseURL: proxyBaseURL,
            dangerouslyAllowBrowser: true,
            defaultHeaders: {
                "X-Target-URL": actualBaseURL,
            },
        },
        temperature: config.temperature ?? 0.7,
    });
};
