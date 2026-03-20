import { z } from "zod";
import { kanbanTools } from "@/agent/tools/kanbantools";

export type OpenAIToolSchema = {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    };
};

export const createOpenAIToolSchemas = (): OpenAIToolSchema[] =>
    kanbanTools.map(({ name, description, parameters }) => ({
        type: "function" as const,
        function: {
            name,
            description,
            parameters: z.toJSONSchema(parameters) as Record<string, unknown>,
        },
    }));

export const createToolMap = (): Record<string, (input: unknown) => Promise<string>> =>
    Object.fromEntries(kanbanTools.map(({ name, execute }) => [name, execute]));
