// @vitest-environment node
import { AIMessageChunk } from "@langchain/core/messages";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ tool: vi.fn(), stream: vi.fn() }));
vi.mock("@/agent/langchain/model", () => ({ createLangChainModel: () => ({ bindTools: () => ({ stream: mocks.stream }) }) }));
vi.mock("@/agent/langchain/tools", () => ({ createOpenAIToolSchemas: () => [], createToolMap: () => ({ fixture: mocks.tool }) }));
import { runLangChainAgent } from "@/agent/langchain/runner";
const config = { baseurl: "https://provider.example.test/v1", usertoken: "synthetic", model: "fixture" };
beforeEach(() => { vi.resetAllMocks(); mocks.tool.mockResolvedValue("ok"); });
function callChunk() { return new AIMessageChunk({ content: "", tool_calls: [{ name: "fixture", args: {}, id: "fixture", type: "tool_call" }] }); }

it("checks account identity immediately before a delayed model tool mutation", async () => {
    let current = true;
    mocks.stream.mockImplementation(async function* () { yield callChunk(); });
    await runLangChainAgent(config, "fixture", [], { maxSteps: 1, isCurrent: () => current, onTrace: (trace) => { if (trace.phase === "action") current = false; } });
    expect(mocks.tool).not.toHaveBeenCalled();
});
it("rejects stream data after an account change while preserving ordinary tool execution", async () => {
    let current = true;
    mocks.stream.mockImplementation(async function* () { current = false; yield callChunk(); });
    await expect(runLangChainAgent(config, "fixture", [], { maxSteps: 1, isCurrent: () => current })).rejects.toThrow(/Account changed/);
    expect(mocks.tool).not.toHaveBeenCalled();
    current = true;
    mocks.stream.mockImplementation(async function* () { yield callChunk(); });
    await runLangChainAgent(config, "fixture", [], { maxSteps: 1, isCurrent: () => current });
    expect(mocks.tool).toHaveBeenCalledExactlyOnceWith({});
});
