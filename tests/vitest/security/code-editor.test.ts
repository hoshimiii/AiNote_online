import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("@uiw/react-codemirror", () => ({ default: (props: { value: string; onChange: (value: string) => void }) =>
    createElement("textarea", { "aria-label": "code editor", defaultValue: props.value, onInput: (event: { currentTarget: HTMLTextAreaElement }) => props.onChange(event.currentTarget.value) }) }));
import { Block } from "@/components/Note/Block";

it("retains editable code/language controls while execution is explicitly unavailable", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const change = vi.fn(); const update = vi.fn(); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const element = document.createElement("div"); document.body.append(element); const root = createRoot(element);
    await act(async () => root.render(createElement(Block, {
        block: { blockId: "fixture", blockType: "code", blockContent: "original", blockCreatedAt: "fixture", blockUpdatedAt: "fixture" },
        content: "original", onChange: change, onUpdateBlock: update,
    })));
    const editor = element.querySelector("textarea")!;
    expect(editor.disabled).toBe(false);
    await act(async () => { editor.value = "edited code"; editor.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(change).toHaveBeenCalledWith("edited code");
    const select = element.querySelector("select")!;
    await act(async () => { select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(update).toHaveBeenCalledWith({ language: "javascript" });
    const button = element.querySelector("button")!;
    expect(button.disabled).toBe(true); expect(button.textContent).toContain("执行暂不可用"); expect(button.title).toContain("隔离执行环境");
    await act(async () => button.click()); expect(fetcher).not.toHaveBeenCalled();
    await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals();
});
