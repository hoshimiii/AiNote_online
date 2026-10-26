import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { EXECUTION_UNAVAILABLE } from "@/services/CodeExecutor";

export const dynamic = "force-dynamic";

export async function POST() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: EXECUTION_UNAVAILABLE }, { status: 503 });
}
