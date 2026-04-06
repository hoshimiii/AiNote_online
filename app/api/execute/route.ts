import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { LocalExecutor, type CodeExecutor } from "@/services/CodeExecutor";

export const dynamic = "force-dynamic";

const executor: CodeExecutor = new LocalExecutor();

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
