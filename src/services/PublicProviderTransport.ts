import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { Readable } from "node:stream";

const blocked = new BlockList();
for (const [ip, prefix] of [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
    ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
    ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) blocked.addSubnet(ip, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [ip, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
    blocked.addSubnet(ip, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
    const family = isIP(address);
    if (family === 4) return !blocked.check(address, "ipv4");
    return family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

export class ProviderDestinationError extends Error {}

function providerURL(base: string): URL {
    let url: URL;
    try { url = new URL(base); } catch { throw new ProviderDestinationError("Invalid provider URL"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
        throw new ProviderDestinationError("Provider URL must be HTTP(S), without credentials or a fragment");
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(hostname) && !isPublicAddress(hostname)) {
        throw new ProviderDestinationError("Provider destination must be a public address; local models are unavailable through this server");
    }
    return url;
}

export function providerEndpoint(base: string, operation: "chat/completions" | "embeddings"): URL {
    const url = providerURL(base);
    url.pathname = `${url.pathname.replace(/\/chat\/completions\/?$/, "").replace(/\/$/, "")}/${operation}`;
    return url;
}

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

export async function readProviderBody(req: Request): Promise<string> {
    if (!req.body) return "";
    const reader = req.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let result = "";
    let cancelRead!: (reason: unknown) => void;
    const cancelled = new Promise<never>((_, reject) => { cancelRead = reject; });
    const abort = () => cancelRead(req.signal.reason);
    const timer = setTimeout(() => cancelRead(new ProviderDestinationError("Provider request body timeout")), 10_000);
    req.signal.addEventListener("abort", abort, { once: true });
    try {
        while (true) {
            req.signal.throwIfAborted();
            const { value, done } = await Promise.race([reader.read(), cancelled]);
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_REQUEST_BYTES) throw new ProviderDestinationError("Provider request exceeds 2 MiB");
            result += decoder.decode(value, { stream: true });
        }
        return result + decoder.decode();
    } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
    } finally {
        clearTimeout(timer);
        req.signal.removeEventListener("abort", abort);
        reader.releaseLock();
    }
}

/** Validate DNS and pin the socket lookup, retaining the URL's Host and TLS name. */
export async function publicProviderPost(url: URL, token: string, body: string, signal?: AbortSignal): Promise<Response> {
    // Revalidate the final URL at the transport boundary, including direct callers.
    const target = providerURL(url.href);
    if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) throw new ProviderDestinationError("Provider request exceeds 2 MiB");
    signal?.throwIfAborted();
    const host = target.hostname.replace(/^\[|\]$/g, "");
    let dnsTimer: ReturnType<typeof setTimeout> | undefined;
    let rejectAbort!: (reason: unknown) => void;
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const abortDNS = () => rejectAbort(signal?.reason);
    signal?.addEventListener("abort", abortDNS, { once: true });
    const answers = await Promise.race([
        isIP(host) ? Promise.resolve([{ address: host, family: isIP(host) }]) : lookup(host, { all: true, verbatim: true }),
        new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new Error("Provider DNS timeout")), 5000); }),
        aborted,
    ]).finally(() => { clearTimeout(dnsTimer); signal?.removeEventListener("abort", abortDNS); });
    signal?.throwIfAborted();
    if (!answers.length || answers.some(({ address }) => !isPublicAddress(address))) {
        throw new ProviderDestinationError("Provider destination must resolve only to public addresses");
    }
    const pinned = answers[0];
    return new Promise<Response>((resolve, reject) => {
        const request = target.protocol === "https:" ? httpsRequest : httpRequest;
        const req = request(target, {
            method: "POST",
            agent: false,
            family: pinned.family,
            lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
            maxHeaderSize: 16 * 1024,
            signal,
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
                "Accept-Encoding": "identity",
                Authorization: token,
            },
        });
        const totalTimer = setTimeout(() => req.destroy(new Error("Provider total timeout")), 120_000);
        req.setTimeout(30_000, () => req.destroy(new Error("Provider idle timeout")));
        req.on("error", (error) => { clearTimeout(totalTimer); reject(error); });
        req.on("response", (res) => {
            res.once("close", () => clearTimeout(totalTimer));
            const status = res.statusCode ?? 502;
            if (status >= 300 && status < 400) {
                res.destroy();
                reject(new ProviderDestinationError("Provider redirects are disabled; configure the final public endpoint"));
                return;
            }
            if (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity") {
                res.destroy(); reject(new Error("Unsupported provider content encoding")); return;
            }
            let received = 0;
            if (status < 200 || status > 599) {
                res.destroy(); reject(new Error("Invalid provider response status")); return;
            }
            const noBody = status === 204 || status === 205;
            if (noBody) {
                res.destroy();
                try { resolve(new Response(null, { status })); } catch (error) { reject(error); }
                return;
            }
            const stream = (Readable.toWeb(res) as ReadableStream<Uint8Array>).pipeThrough(new TransformStream({
                transform(chunk, controller) {
                    received += chunk.byteLength;
                    if (received > MAX_RESPONSE_BYTES) {
                        res.destroy(); controller.error(new Error("Provider response exceeds 32 MiB")); return;
                    }
                    controller.enqueue(chunk);
                },
            }));
            try {
                resolve(new Response(stream, {
                    status,
                    headers: { "Content-Type": res.headers["content-type"] ?? "application/octet-stream" },
                }));
            } catch (error) { res.destroy(); reject(error); }
        });
        req.end(body);
    });
}
