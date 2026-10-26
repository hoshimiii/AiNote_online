// @vitest-environment node
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ request: mocks.request }));
vi.mock("node:https", () => ({ request: mocks.request }));

import { isPublicAddress, providerEndpoint, publicProviderPost, readProviderBody } from "@/services/PublicProviderTransport";
import { generateEmbedding, summarizeTextForEmbedding } from "@/services/EmbeddingService";
import { POST } from "../../../app/api/llm/chat/completions/route";
import { NextRequest } from "next/server";

function upstream(status = 200, payload = 'data: hello\n\n') {
    mocks.request.mockImplementation(() => {
        const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void; setTimeout: ReturnType<typeof vi.fn> };
        req.setTimeout = vi.fn();
        req.destroy = () => { req.emit("error", new Error("aborted")); };
        req.end = () => {
            const res = Object.assign(new PassThrough(), { statusCode: status, headers: { "content-type": "text/event-stream" } });
            queueMicrotask(() => { req.emit("response", res); res.end(payload); });
        };
        return req;
    });
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    upstream();
});

describe("public provider socket boundary", () => {
    it.each(["127.0.0.1", "10.2.3.4", "172.16.0.1", "192.168.1.2", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "198.18.0.1", "192.0.2.1", "::1", "::ffff:8.8.8.8", "fc00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::", "3fff::1"])("rejects special address %s", (address) => {
        expect(isPublicAddress(address)).toBe(false);
    });
    it.each(["http://2130706433/v1", "http://0x7f000001/v1", "http://127.1/v1", "http://[::ffff:127.0.0.1]/v1", "https://secret@provider.example.test/v1", "file:///tmp/private"])("rejects alternate URL %s", async (base) => {
        expect(() => providerEndpoint(base, "chat/completions")).toThrow();
        expect(mocks.request).not.toHaveBeenCalled();
    });
    it("rejects DNS private answers and mixed public/private answers before connecting", async () => {
        for (const answers of [[{ address: "127.0.0.1", family: 4 }], [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]]) {
            mocks.lookup.mockResolvedValueOnce(answers);
            await expect(publicProviderPost(providerEndpoint("https://provider.example.test/v1", "embeddings"), "Bearer synthetic", "{}")).rejects.toThrow(/public/);
        }
        expect(mocks.request).not.toHaveBeenCalled();
    });
    it("pins the actual lookup and retains provider hostname/TLS URL and streaming", async () => {
        mocks.lookup.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }]).mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
        const url = providerEndpoint("https://provider.example.test/v1?api-version=test", "chat/completions");
        const res = await publicProviderPost(url, "Bearer synthetic", "{}");
        const [socketUrl, options] = mocks.request.mock.calls[0];
        const callback = vi.fn();
        options.lookup("provider.example.test", {}, callback);
        expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
        expect(mocks.lookup).toHaveBeenCalledTimes(1);
        expect(socketUrl.hostname).toBe("provider.example.test");
        expect(socketUrl.protocol).toBe("https:");
        expect(socketUrl.searchParams.get("api-version")).toBe("test");
        expect(options.agent).toBe(false);
        expect(options.headers.Authorization).toBe("Bearer synthetic");
        expect(await res.text()).toBe('data: hello\n\n');
    });
    it.each([301, 302, 307, 308])("never follows a %s redirect", async (status) => {
        upstream(status);
        await expect(publicProviderPost(providerEndpoint("https://provider.example.test/v1", "chat/completions"), "Bearer synthetic", "{}")).rejects.toThrow(/redirect/);
        expect(mocks.request).toHaveBeenCalledTimes(1);
    });
    it.each([204, 205])("handles null-body status %s without throwing from the response event", async (status) => {
        upstream(status, "");
        const response = await publicProviderPost(providerEndpoint("https://provider.example.test/v1", "embeddings"), "Bearer synthetic", "{}");
        expect(response.status).toBe(status); expect(response.body).toBeNull();
    });
    it("rejects malformed response status as a promise rejection", async () => {
        upstream(700);
        await expect(publicProviderPost(providerEndpoint("https://provider.example.test/v1", "embeddings"), "Bearer synthetic", "{}")).rejects.toThrow(/status/);
    });
    it("snapshots caller-owned URL before asynchronous DNS and safely rejects connection errors", async () => {
        let finish!: (value: { address: string; family: number }[]) => void;
        mocks.lookup.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
        const url = providerEndpoint("https://provider.example.test/v1", "embeddings");
        const response = publicProviderPost(url, "Bearer synthetic", "{}");
        url.hostname = "127.0.0.1";
        finish([{ address: "8.8.8.8", family: 4 }]);
        expect(await (await response).text()).toContain("hello");
        expect(mocks.request.mock.calls[0][0].hostname).toBe("provider.example.test");
        mocks.request.mockImplementation(() => {
            const req = Object.assign(new EventEmitter(), { setTimeout: vi.fn(), end: () => queueMicrotask(() => req.emit("error", new Error("fixture connection error"))), destroy: vi.fn() });
            return req;
        });
        await expect(publicProviderPost(providerEndpoint("https://provider.example.test/v1", "embeddings"), "Bearer synthetic", "{}")).rejects.toThrow(/connection error/);
    });
    it("bounds request bodies and cancels before connection", async () => {
        await expect(publicProviderPost(providerEndpoint("https://provider.example.test/v1", "embeddings"), "Bearer synthetic", "a".repeat(2 * 1024 * 1024 + 1))).rejects.toThrow(/2 MiB/);
        const req = new Request("https://app.example.test", { method: "POST", body: "a".repeat(2 * 1024 * 1024 + 1) });
        await expect(readProviderBody(req)).rejects.toThrow(/2 MiB/);
        const controller = new AbortController(); controller.abort();
        await expect(publicProviderPost(providerEndpoint("https://provider.example.test/v1", "embeddings"), "Bearer synthetic", "{}", controller.signal)).rejects.toThrow();
        expect(mocks.request).not.toHaveBeenCalled();
    });
    it("bounds response bytes and configures header, idle and total connection limits", async () => {
        upstream(200, "x".repeat(32 * 1024 * 1024 + 1));
        const response = await publicProviderPost(providerEndpoint("https://provider.example.test/v1", "embeddings"), "Bearer synthetic", "{}");
        await expect(response.text()).rejects.toThrow(/32 MiB/);
        expect(mocks.request.mock.calls[0][1].maxHeaderSize).toBe(16 * 1024);
        const request = mocks.request.mock.results[0].value;
        expect(request.setTimeout).toHaveBeenCalledWith(30_000, expect.any(Function));
    });
    it("a provider that sends no headers reaches a bounded total timeout", async () => {
        vi.useFakeTimers();
        try {
            mocks.request.mockImplementation(() => {
                const req = Object.assign(new EventEmitter(), { setTimeout: vi.fn(), end: vi.fn(), destroy: (error: Error) => req.emit("error", error) });
                return req;
            });
            const pending = publicProviderPost(providerEndpoint("https://provider.example.test/v1", "embeddings"), "Bearer synthetic", "{}");
            const rejected = expect(pending).rejects.toThrow(/total timeout/);
            await vi.advanceTimersByTimeAsync(120_001);
            await rejected;
        } finally { vi.useRealTimers(); }
    });
    it("cancels DNS wait immediately and bounds a request body that never finishes", async () => {
        mocks.lookup.mockReturnValueOnce(new Promise(() => {}));
        const controller = new AbortController();
        const pending = publicProviderPost(providerEndpoint("https://provider.example.test/v1", "embeddings"), "Bearer synthetic", "{}", controller.signal);
        const rejected = expect(pending).rejects.toThrow(); controller.abort(); await rejected;
        expect(mocks.request).not.toHaveBeenCalled();
        vi.useFakeTimers();
        try {
            const request = new Request("https://app.example.test", { method: "POST", body: new ReadableStream(), duplex: "half" } as RequestInit);
            const reading = expect(readProviderBody(request)).rejects.toThrow(/body timeout/);
            await vi.advanceTimersByTimeAsync(10_001); await reading;
        } finally { vi.useRealTimers(); }
    });
    it("both embedding and summary calls enforce the same destination boundary", async () => {
        const config = { baseurl: "http://10.0.0.1/v1", usertoken: "synthetic", model: "fixture" };
        await expect(generateEmbedding("fixture", config)).rejects.toThrow(/public/);
        await expect(summarizeTextForEmbedding("fixture", config)).rejects.toThrow(/public/);
        expect(mocks.request).not.toHaveBeenCalled();
        upstream(200, JSON.stringify({ data: [{ embedding: [1, 2] }] }));
        expect(await generateEmbedding("fixture", { ...config, baseurl: "https://provider.example.test/v1/chat/completions" })).toEqual([1, 2]);
        expect(mocks.request.mock.calls[0][0].pathname).toBe("/v1/embeddings");
        upstream(200, JSON.stringify({ choices: [{ message: { content: "fixture summary" } }] }));
        expect(await summarizeTextForEmbedding("fixture", { ...config, baseurl: "https://provider.example.test/v1" })).toBe("fixture summary");
    });
    it("the proxy rejects private and redirect inputs and preserves public SSE", async () => {
        const req = (target: string) => new NextRequest("https://app.example.test/api/llm/chat/completions", { method: "POST", headers: { Authorization: "Bearer synthetic", "X-Target-URL": target }, body: "{}" });
        expect((await POST(req("http://169.254.169.254/v1"))).status).toBe(400);
        upstream(307); expect((await POST(req("https://provider.example.test/v1"))).status).toBe(400);
        upstream(); const res = await POST(req("https://provider.example.test/v1"));
        expect(res.status).toBe(200); expect(await res.text()).toContain("data: hello");
    });
});
