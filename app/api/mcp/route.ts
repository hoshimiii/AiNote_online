import { NextResponse } from "next/server"
import { authenticateMcp } from "@/lib/mcp-auth"
import { dispatch } from "@/lib/mcp-helpers"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const result = await authenticateMcp(req)
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  const { userId } = result

  let body: { toolName?: string; arguments?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const toolName = body.toolName
  if (!toolName || typeof toolName !== "string") {
    return NextResponse.json({ error: "Missing toolName" }, { status: 400 })
  }

  const args = body.arguments && typeof body.arguments === "object" && !Array.isArray(body.arguments)
    ? body.arguments
    : {}

  try {
    const result = await dispatch(toolName, userId, args)
    return NextResponse.json({ result })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
