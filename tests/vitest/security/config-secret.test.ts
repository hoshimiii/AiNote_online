// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("MCP editor configuration uses environment references and contains no complete bearer key", () => {
    const text = readFileSync(".vscode/mcp.json", "utf8");
    // Boolean assertions keep configuration values out of failure output.
    expect(/"AINOTE_API_KEY"\s*:\s*"\$\{env:AINOTE_API_KEY\}"/.test(text)).toBe(true);
    expect(/"VERCEL_API_URL"\s*:\s*"\$\{env:VERCEL_API_URL\}"/.test(text)).toBe(true);
    expect(/ainote_(?:[a-f0-9]{64}|v2\.[A-Za-z0-9_-]+\.[a-f0-9]{64})/.test(text)).toBe(false);
});
