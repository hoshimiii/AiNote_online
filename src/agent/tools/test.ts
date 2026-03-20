import ToolExecutor from './toolExecutor';
import { z } from 'zod';

const toolExecutor = new ToolExecutor();

toolExecutor.registerTool({
    name: 'test',
    description: 'test tool',
    parameters: z.object({
        name: z.string(),
    }),
    execute: async (input) => {
        const { name } = input as { name: string };
        return `Hello, ${name}!`;
    },
});

console.log(toolExecutor.getAvailableTools());
console.log(await toolExecutor.getTool('test')?.('{"name": "John"}'));