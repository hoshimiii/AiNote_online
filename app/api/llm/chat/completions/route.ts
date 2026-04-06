import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
// 禁止转发到内网地址，防止 SSRF
const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/**
 * LLM 流式代理路由
 *
 * 浏览器端的 @langchain/openai 在 Vercel 生产环境中会因 CORS 限制无法直接
 * 连接到第三方 LLM 供应商。客户端将 baseURL 设置为本路由（同域，无 CORS），
 * 本路由在服务端将请求透明转发给真实的 LLM 供应商。
 *
 * 必要请求头：
 *   Authorization:  Bearer <user-api-key>  （由 openai SDK 自动携带）
 *   X-Target-URL:   https://api.siliconflow.cn/v1  （实际 LLM Provider baseURL）
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetBase = req.headers.get("X-Target-URL");
  if (!targetBase) {
    return NextResponse.json({ error: "X-Target-URL header is required" }, { status: 400 });
  }

  let targetURL: URL;
  try {
    targetURL = new URL(targetBase);
  } catch {
    return NextResponse.json({ error: "Invalid X-Target-URL" }, { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(targetURL.protocol)) {
    return NextResponse.json({ error: "X-Target-URL must use http or https" }, { status: 400 });
  }

  if (BLOCKED_HOSTNAMES.has(targetURL.hostname)) {
    return NextResponse.json({ error: "X-Target-URL hostname not allowed" }, { status: 400 });
  }

  const upstreamURL = `${targetBase.replace(/\/$/, "")}/chat/completions`;
  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(upstreamURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Upstream connection failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
