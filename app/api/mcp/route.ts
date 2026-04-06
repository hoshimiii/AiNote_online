import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { dispatch } from "@/lib/mcp-helpers"

export const dynamic = "force-dynamic"

async function authenticateByApiKey(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.slice(7).trim()
  const raw = token.startsWith("ainote_") ? token.slice(7) : token

  const users = await prisma.user.findMany({
    where: { mcpApiKey: { not: null } },
    select: { id: true, mcpApiKey: true },
  })

  for (const user of users) {
    if (user.mcpApiKey && (await bcrypt.compare(raw, user.mcpApiKey))) {
      return user.id
    }
  }
  return null
}

export async function POST(req: Request) {
  const userId = await authenticateByApiKey(req)
  if (!userId) {
    return NextResponse.json({ error: "Invalid API Key" }, { status: 401 })
  }

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
