type ApiMessage = { role: 'user' | 'assistant'; content: string };

export const sendMessage = async (messages: ApiMessage[], usertoken: string, baseurl: string,) => {
    const prompt_builder = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${usertoken}`,
        },
        body: JSON.stringify({
            model: 'deepseek-ai/DeepSeek-V3',
            messages: [...messages],
            // [{},{}] 的形式输出
            "stream": true,
        }),
    }
    // console.log(prompt_builder)
    const response = await fetch(baseurl, prompt_builder);
    return response
}
