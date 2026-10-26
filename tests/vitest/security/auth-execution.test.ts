// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
const db = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn(), auth: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: db.findUnique }, workspaceSnapshot: { findUnique: db.findUnique, upsert: db.upsert } } }));
vi.mock("@/lib/auth", () => ({ auth: db.auth }));
vi.mock("@/lib/mcp-helpers", () => ({ dispatch: db.dispatch }));
import { authenticateMcp, mcpKeyPrefix } from "@/lib/mcp-auth";
import { POST as execute } from "../../../app/api/execute/route";
import { POST as mcp } from "../../../app/api/mcp/route";
import { GET as syncGet, PUT as syncPut } from "../../../app/api/sync/route";
import { LocalExecutor, EXECUTION_UNAVAILABLE } from "@/services/CodeExecutor";
import { codeExecutionTools } from "@/agent/tools/codeExecution";

const raw = "a".repeat(64);
const req = (token: string) => new Request("https://app.example.test/api/mcp", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ toolName: "fixture" }) });

beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); db.auth.mockResolvedValue({ user: { id: "account-a" } }); });

describe("bounded MCP authentication and compatible migration", () => {
    it("rejects the original all-users trigger and oversized/alternate tokens without a DB lookup", async () => {
        for (const token of ["invalid", `ainote_${raw}`, raw, `ainote_v2.account-a.${raw}x`, `ainote_v2.account-a.${"a".repeat(10000)}`]) {
            expect(await authenticateMcp(req(token))).toHaveProperty("status", 401);
        }
        expect(db.findUnique).not.toHaveBeenCalled();
        const response = await mcp(req(`ainote_${raw}`));
        expect(await response.text()).toContain("Legacy API key format");
    });
    it("accepts an existing bcrypt secret with its owner wrapper and performs one indexed lookup/compare", async () => {
        // The original generator hashes the 64 hex characters after optional ainote_.
        db.findUnique.mockResolvedValue({ id: "account-a", mcpApiKey: await bcrypt.hash(raw, 4) });
        const compare = vi.spyOn(bcrypt, "compare");
        expect(await authenticateMcp(req(`${mcpKeyPrefix("account-a")}${raw}`))).toEqual({ userId: "account-a" });
        expect(db.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: "account-a" }, select: { id: true, mcpApiKey: true } });
        expect(compare).toHaveBeenCalledTimes(1);
        db.dispatch.mockResolvedValue({ ok: true });
        expect((await mcp(req(`${mcpKeyPrefix("account-a")}${raw}`))).status).toBe(200);
        expect(db.dispatch).toHaveBeenCalledWith("fixture", "account-a", {});
    });
    it("rejects a wrong secret and admits at most four simultaneous checks", async () => {
        db.findUnique.mockResolvedValue({ id: "account-a", mcpApiKey: await bcrypt.hash(raw, 4) });
        expect(await authenticateMcp(req(`${mcpKeyPrefix("account-a")}${"b".repeat(64)}`))).toHaveProperty("status", 401);
        let finish!: (value: null) => void;
        const pending = new Promise<null>((resolve) => { finish = resolve; });
        db.findUnique.mockReturnValue(pending);
        const checks = Array.from({ length: 4 }, () => authenticateMcp(req(`${mcpKeyPrefix("account-a")}${raw}`)));
        expect(await authenticateMcp(req(`${mcpKeyPrefix("account-a")}${raw}`))).toHaveProperty("status", 429);
        finish(null); await Promise.all(checks);
        db.findUnique.mockResolvedValue(null);
        expect(await authenticateMcp(req(`${mcpKeyPrefix("account-a")}${raw}`))).toHaveProperty("status", 401);
    });
});

describe("host execution is unavailable through every existing entrypoint", () => {
    it("requires login and gives explicit unavailable status to registered users", async () => {
        db.auth.mockResolvedValueOnce(null);
        expect((await execute()).status).toBe(401);
        const response = await execute();
        expect(response.status).toBe(503); expect(await response.text()).toContain(EXECUTION_UNAVAILABLE);
    });
    it("does not evaluate original environment-reading or alternate language payloads", async () => {
        const executor = new LocalExecutor();
        for (const [code, language] of [["console.log(process.env)", "javascript"], ["import os; print(os.environ)", "python"], ["class Main {}", "java"]]) {
            expect(await executor.execute(code, language)).toMatchObject({ stdout: "", stderr: EXECUTION_UNAVAILABLE, exitCode: 1 });
        }
        expect(executor.supportedLanguages()).toEqual([]);
        expect(await codeExecutionTools[0].execute({ code: "throw Error('never')", language: "javascript" })).toContain(EXECUTION_UNAVAILABLE);
    });
});

describe("sync request remains bound to the initiating account across cookie switches", () => {
    it("rejects missing/stale owner for GET and PUT before touching another account", async () => {
        for (const method of [syncGet, syncPut]) {
            for (const owner of ["", "account-b"]) {
                const response = await method(new Request("https://app.example.test/api/sync", { method: "PUT", headers: { "X-Workspace-Owner": owner }, body: "{}" }));
                expect(response.status).toBe(409);
            }
        }
        expect(db.findUnique).not.toHaveBeenCalled(); expect(db.upsert).not.toHaveBeenCalled();
    });
    it("keeps the legitimate same-account read and write path", async () => {
        db.findUnique.mockResolvedValue({ data: { workspaces: [] }, updatedAt: "2026-01-01" });
        db.upsert.mockResolvedValue({ updatedAt: "2026-01-02" });
        const request = () => new Request("https://app.example.test/api/sync", { method: "PUT", headers: { "X-Workspace-Owner": "account-a" }, body: "{}" });
        expect((await syncGet(request())).status).toBe(200);
        expect((await syncPut(request())).status).toBe(200);
        expect(db.upsert.mock.calls[0][0].where).toEqual({ userId: "account-a" });
    });
});
