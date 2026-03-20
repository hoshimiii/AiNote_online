import { ReActAgent } from './main';

import ToolExecutor from '../tools/toolExecutor';
import { createAgentLLM } from '../Agent_LLM';
import { kanbanTools } from '../tools/kanbantools';

const toolExecutor = new ToolExecutor();

kanbanTools.forEach(tool => {
    toolExecutor.registerTool(tool);
});

console.log(toolExecutor.getAvailableTools());

const reActAgent = new ReActAgent(createAgentLLM({
    baseurl: "https://api.siliconflow.cn/v1/chat/completions",
    model: "deepseek-ai/DeepSeek-V3.2",
    usertoken: "sk-vnasjeozmivbxcsjqvijtutshvncclxzwdhrcycolkladrzo",
}), toolExecutor, 5);

const response = await reActAgent.run('mission名字为New Mission 帮我创创建一个新的board 并命名为 agent 测试board');

console.log(response);