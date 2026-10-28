import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { providerEndpoint, publicProviderPost, ProviderDestinationError, readProviderBody } from "@/services/PublicProviderTransport";

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

  let upstream: Response;
  try {
    const target = providerEndpoint(targetBase, "chat/completions");
    upstream = await publicProviderPost(target, auth, await readProviderBody(req), req.signal);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof ProviderDestinationError ? error.message : "Upstream connection failed" },
      { status: error instanceof ProviderDestinationError ? 400 : 502 },
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
