import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ run: vi.fn(), retrieve: vi.fn(), store: vi.fn(), session: { status: "authenticated", data: { user: { id: "account-a" } } } }));
vi.mock("@/agent/langchain/runner", () => ({ runLangChainAgent: mocks.run }));
vi.mock("@/services/MemoryManager", () => ({ retrieveMemories: mocks.retrieve, storeSession: mocks.store }));
vi.mock("next-auth/react", () => ({ useSession: () => mocks.session }));
import { useWorkSpace } from "@/store/kanban";
import { useChatbot } from "@/store/Chatbot";
import { accountLease, activateAccount, beginAccountTransition, isCurrentAccount } from "@/lib/account-boundary";
import { startCloudSync } from "@/components/auth/CloudSync";
import { ZustandRehydrate } from "@/components/ZustandRehydrate";

async function select(owner: string) {
    const gen = beginAccountTransition();
    useWorkSpace.setState(useWorkSpace.getInitialState(), true);
    useChatbot.setState(useChatbot.getInitialState(), true);
    activateAccount(owner, gen);
    await Promise.all([useWorkSpace.persist.rehydrate(), useChatbot.persist.rehydrate()]);
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
const cloud = (data: unknown = null) => new Response(JSON.stringify({ data, updatedAt: "2026-10-26T00:00:00Z" }));
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(async () => {
    vi.clearAllMocks(); localStorage.clear();
    await select("account-a");
    mocks.retrieve.mockResolvedValue([]);
});
afterEach(() => { beginAccountTransition(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("owner-bound local state and sync lifecycle", () => {
    it("quarantines legacy data and keeps guest and account stores distinct, including credentials", async () => {
        localStorage.setItem("workspace-storage", JSON.stringify({ state: { workspaces: [{ workspaceId: "legacy", workspaceName: "legacy private" }] }, version: 6 }));
        localStorage.setItem("chatbot-storage", JSON.stringify({ state: { config: { usertoken: "legacy-synthetic" } }, version: 0 }));
        await select("guest");
        useWorkSpace.getState().createWorkSpace({ workspaceId: "guest", workspaceName: "guest private" });
        await select("account-a");
        expect(useWorkSpace.getState().workspaces).toEqual([]); expect(useChatbot.getState().config.usertoken).toBe("");
        useWorkSpace.getState().createWorkSpace({ workspaceId: "a", workspaceName: "A private" });
        useChatbot.getState().setConfig({ usertoken: "A-synthetic" });
        await select("account-b");
        expect(useWorkSpace.getState().workspaces).toEqual([]); expect(useChatbot.getState().config.usertoken).toBe("");
        await select("account-a");
        expect(useWorkSpace.getState().workspaces[0].workspaceName).toBe("A private");
        expect(useChatbot.getState().config.usertoken).toBe("A-synthetic");
        expect(localStorage.getItem("workspace-storage")).toContain("legacy private");
    });
    it("does not apply a delayed A cloud pull or auto-upload it into empty B cloud", async () => {
        vi.useFakeTimers(); const pending = deferred<Response>();
        const fetcher = vi.fn().mockReturnValueOnce(pending.promise).mockImplementation(() => Promise.resolve(cloud()));
        vi.stubGlobal("fetch", fetcher);
        const stopA = startCloudSync("account-a", vi.fn());
        await select("account-b"); stopA();
        const stopB = startCloudSync("account-b", vi.fn());
        pending.resolve(cloud({ workspaces: [{ workspaceId: "a", workspaceName: "private" }], missions: {}, boards: {}, tasks: {}, missionOrder: {}, boardOrder: {}, _chatbot: { config: { usertoken: "A-synthetic" } } }));
        await flush(); await vi.advanceTimersByTimeAsync(2100);
        expect(useWorkSpace.getState().workspaces).toEqual([]);
        const uploads = fetcher.mock.calls.filter(([, init]) => init.method === "PUT");
        expect(uploads.length).toBeGreaterThan(0);
        for (const [, init] of uploads) {
            expect(init.headers["X-Workspace-Owner"]).toBe("account-b");
            expect(init.body).not.toContain("A-synthetic"); expect(init.body).not.toContain("private");
        }
        stopB();
    });
    it("cancels pending uploads, debounce and stale completion on logout/account change", async () => {
        vi.useFakeTimers(); const pending = deferred<Response>();
        const fetcher = vi.fn().mockResolvedValueOnce(cloud()).mockReturnValueOnce(pending.promise);
        vi.stubGlobal("fetch", fetcher);
        const stop = startCloudSync("account-a", vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        expect(fetcher.mock.calls[1][1].method).toBe("PUT");
        const signal = fetcher.mock.calls[1][1].signal;
        useWorkSpace.getState().createWorkSpace({ workspaceId: "a", workspaceName: "pending" });
        await select("account-b"); stop();
        expect(signal.aborted).toBe(true);
        pending.resolve(cloud()); await vi.advanceTimersByTimeAsync(4000);
        expect(useWorkSpace.getState()._cloudSyncTime).toBeNull();
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
    it("normal edits still persist and upload; malformed cloud never overwrites valid data", async () => {
        vi.useFakeTimers(); const fetcher = vi.fn().mockImplementation(() => Promise.resolve(cloud())); vi.stubGlobal("fetch", fetcher);
        const stop = startCloudSync("account-a", vi.fn()); await vi.advanceTimersByTimeAsync(0);
        useWorkSpace.getState().createWorkSpace({ workspaceId: "note", workspaceName: "editable note" });
        await vi.advanceTimersByTimeAsync(2100);
        expect(fetcher.mock.calls.at(-1)?.[1].body).toContain("editable note");
        stop(); fetcher.mockClear().mockResolvedValue(cloud({ malformed: true }));
        useWorkSpace.getState().setCloudSyncTime("2025-01-01");
        const stopMalformed = startCloudSync("account-a", vi.fn());
        await vi.advanceTimersByTimeAsync(0);
        expect(useWorkSpace.getState().workspaces[0].workspaceName).toBe("editable note");
        expect(fetcher.mock.calls.some(([, init]) => init.method === "PUT")).toBe(false);
        stopMalformed();
    });
    it("discards delayed chatbot stream/trace/final callbacks and memory writes after switch", async () => {
        useChatbot.getState().setConfig({ usertoken: "A-synthetic" });
        const pending = deferred<string>(); let options: Record<string, unknown> = {};
        mocks.run.mockImplementation((_config, _input, _history, opts) => { options = opts; return pending.promise; });
        const sent = useChatbot.getState().sendMessage("A private input"); await flush();
        expect(mocks.run).toHaveBeenCalledTimes(1);
        await select("account-b");
        (options.onStreamDelta as (s: string) => void)("A private delta");
        (options.onTrace as (s: object) => void)({ step: 1, phase: "thought", content: "A private trace" });
        expect((options.isCurrent as () => boolean)()).toBe(false);
        pending.resolve("A private answer"); await sent;
        expect(useChatbot.getState().messages).toEqual([]); expect(mocks.store).not.toHaveBeenCalled();
    });
    it("invalidates a lease immediately on loading transition", () => {
        const lease = accountLease(); beginAccountTransition();
        expect(lease.signal.aborted).toBe(true); expect(isCurrentAccount(lease)).toBe(false);
    });
    it("the real hydration gate hides stale state during loading and switches both stores", async () => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        useWorkSpace.getState().createWorkSpace({ workspaceId: "a", workspaceName: "A-private" });
        useChatbot.getState().setConfig({ usertoken: "A-synthetic" });
        mocks.session.status = "loading";
        const element = document.createElement("div"); document.body.append(element); const root = createRoot(element);
        const child = () => createElement("p", null, JSON.stringify([useWorkSpace.getState().workspaces, useChatbot.getState().config.usertoken]));
        await act(async () => { root.render(createElement(ZustandRehydrate, null, createElement(child))); });
        expect(element.textContent).not.toContain("A-private");
        mocks.session.status = "authenticated"; mocks.session.data.user.id = "account-b";
        await act(async () => { root.render(createElement(ZustandRehydrate, null, createElement(child))); });
        expect(element.textContent).not.toContain("A-private"); expect(element.textContent).not.toContain("A-synthetic");
        mocks.session.data.user.id = "account-a";
        await act(async () => { root.render(createElement(ZustandRehydrate, null, createElement(child))); });
        expect(element.textContent).toContain("A-private"); expect(element.textContent).toContain("A-synthetic");
        await act(async () => root.unmount()); element.remove();
    });
});
