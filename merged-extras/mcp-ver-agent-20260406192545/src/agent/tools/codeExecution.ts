import { z } from "zod";
import type { Tool } from "./toolExecutor";
import { LocalExecutor } from "@/services/CodeExecutor";

const codeTool: Tool = {
    name: "run_code",
    description: "Execute code in supported languages (javascript/typescript/python/cpp/java). Returns JSON with stdout, stderr, exitCode, duration.",
    parameters: z.object({
        code: z.string(),
        language: z.string().optional(),
    }),
    execute: async (input: unknown) => {
        const { code, language } = input as { code: string; language?: string };
        const exec = new LocalExecutor();
        const result = await exec.execute(code, language ?? "javascript");
        return JSON.stringify(result);
    },
};

export const codeExecutionTools: Tool[] = [codeTool];
export default codeExecutionTools;
