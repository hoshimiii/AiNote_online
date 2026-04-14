import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SmartExecutor, type CodeExecutor } from "@/services/CodeExecutor";

export const dynamic = "force-dynamic";

/**
 * SmartExecutor 在模块加载时读取环境变量进行路由决策：
 *   - PISTON_API_URL 指定 Piston 地址（本地 Docker 或自托管）
 *   - VERCEL=1 时自动使用 https://emkc.org 公开 Piston API
 *   - 未配置 Piston 时回退到 LocalExecutor（仅 JS 无需额外安装）
 */
const executor: CodeExecutor = new SmartExecutor();

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { code: string; language: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { code, language } = body;

    if (typeof code !== "string" || typeof language !== "string") {
        return NextResponse.json({ error: "code 和 language 必须为字符串" }, { status: 400 });
    }

    if (!executor.supportedLanguages().includes(language)) {
        return NextResponse.json(
            { error: `不支持的语言: ${language}。支持: ${executor.supportedLanguages().join(", ")}` },
            { status: 400 }
        );
    }

    try {
        const result = await executor.execute(code, language);
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json(
            { error: `执行失败: ${err?.message ?? "未知错误"}` },
            { status: 500 }
        );
    }
}
