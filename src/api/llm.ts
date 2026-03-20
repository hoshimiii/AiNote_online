export type ApiMessage = { role: "user" | "assistant" | "system"; content: string };

export interface LLMConfig {
    baseurl: string;
    usertoken: string;
    model: string;
    temperature?: number;
    userRules?: string;
}

export const fetchLLMStream = async (
    messages: ApiMessage[],
    config: LLMConfig
): Promise<Response> => {
    const response = await fetch(config.baseurl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.usertoken}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages,
            stream: true,
        }),
    });
    return response;
};
