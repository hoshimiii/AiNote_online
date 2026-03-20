import { z } from "zod";

export interface Tool {
    name: string;
    description: string;
    parameters: z.ZodSchema<any>;
    returns?: string;
    execute: (input: unknown) => Promise<string>;
}

const formatSchemaType = (schema: any): string => {
    if (!schema) return "unknown";
    if (Array.isArray(schema.type)) return schema.type.join(" | ");
    if (schema.enum) return schema.enum.map((item: unknown) => JSON.stringify(item)).join(" | ");
    if (schema.type === "array") {
        return `array<${formatSchemaType(schema.items)}>`;
    }
    if (schema.type === "object") return "object";
    return schema.type ?? "unknown";
};

const formatToolParameters = (schema: any): string => {
    const properties = schema?.properties ?? {};
    const required = new Set<string>(schema?.required ?? []);
    const entries = Object.entries(properties);

    if (entries.length === 0) {
        return "- none";
    }

    return entries
        .map(([name, value]) => {
            const property = value as any;
            const typeText = formatSchemaType(property);
            const requiredText = required.has(name) ? "required" : "optional";
            const defaultText = property.default !== undefined ? `, default=${JSON.stringify(property.default)}` : "";
            return `- ${name}: ${typeText} (${requiredText}${defaultText})`;
        })
        .join("\n");
};

const stripCodeFence = (input: string) => {
    const trimmed = input.trim();
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return match ? match[1].trim() : trimmed;
};

const extractFirstJsonValue = (input: string) => {
    const text = input.trim();
    if (!text) return text;
    const start = text.search(/[\{\[]/);
    if (start === -1) return text;

    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i += 1) {
        const char = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === "\"") {
                inString = false;
            }
            continue;
        }

        if (char === "\"") {
            inString = true;
            continue;
        }

        if (char === "{" || char === "[") {
            stack.push(char);
            continue;
        }

        if (char === "}" || char === "]") {
            const last = stack[stack.length - 1];
            if ((char === "}" && last === "{") || (char === "]" && last === "[")) {
                stack.pop();
                if (stack.length === 0) {
                    return text.slice(start, i + 1);
                }
            }
        }
    }

    return text.slice(start);
};

const parseToolInput = (rawInput: string) => {
    const normalizedInput = stripCodeFence(rawInput);
    if (!normalizedInput) return {};

    try {
        return JSON.parse(normalizedInput);
    } catch {
        const extracted = extractFirstJsonValue(normalizedInput);
        return extracted ? JSON.parse(extracted) : {};
    }
};

export class ToolExecutor {
    private tools: Tool[];

    constructor(tools: Tool[] = []) {
        this.tools = tools;
    }

    registerTool(tool: Tool) {
        this.tools.push(tool);
        console.log(`Tool ${tool.name} registered successfully`);
        // return 'Tool registered successfully';
    }

    getAvailableTools(): string {
        return this.tools
            .map((tool) => {
                const schema = z.toJSONSchema(tool.parameters);
                const params = formatToolParameters(schema);
                const returns = tool.returns ?? "JSON string result in Observation.";
                return [
                    `tool: ${tool.name}`,
                    `description: ${tool.description}`,
                    `parameters:`,
                    params,
                    `returns: ${returns}`,
                ].join("\n");
            })
            .join("\n\n");
    }

    getTool(name: string): ((input: string) => Promise<string>) | undefined {
        const tool = this.tools.find((tool) => tool.name === name);
        if (!tool) return undefined;
        return async (rawInput: string) => {
            const jsonInput = parseToolInput(rawInput);
            const parsed = tool.parameters.parse(jsonInput);
            return tool.execute(parsed);
        };
    }

    async executeTool(name: string, input: string): Promise<string> {
        const fn = this.getTool(name);
        if (!fn) {
            throw new Error(`Tool ${name} not found`);
        }
        return await fn(input);
    }
}

export default ToolExecutor;