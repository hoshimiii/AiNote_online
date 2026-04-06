import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import fs from "node:fs"
import fsp from "node:fs/promises"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, ".env") })
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import * as z from "zod/v4"

const blockInput = z.object({
  blockType: z.string().optional(),
  blockContent: z.string().optional(),
  content: z.string().optional(),
})

async function forward(toolName: string, args: Record<string, unknown>) {
  return forwardWithPolicy(toolName, args)
}

function maskKey(key?: string) {
  if (!key) return "<missing>"
  if (key.length <= 8) return "****"
  return "****" + key.slice(-4)
}

async function forwardWithPolicy(
  toolName: string,
  args: Record<string, unknown>,
  opts?: { timeoutMs?: number; retries?: number; logLevel?: "info" | "warn" | "error" },
) {
  const url = process.env.VERCEL_API_URL
  const key = process.env.AINOTE_API_KEY
  if (!url?.trim()) throw new Error("VERCEL_API_URL is not set")
  if (!key?.trim()) throw new Error("AINOTE_API_KEY is not set")

  const timeoutMs = opts?.timeoutMs ?? 10000
  const retries = opts?.retries ?? 0
  const logLevel = opts?.logLevel ?? "info"

  const log = (level: string, obj: unknown) => {
    try {
      const fn = console[level as keyof Console] || console.log
      if (typeof fn === "function") {
        (fn as (...args: unknown[]) => void).call(console, "[mcp-bridge]", JSON.stringify(obj))
      } else {
        console.log("[mcp-bridge]", JSON.stringify(obj))
      }
    } catch (e) {
      console.log("[mcp-bridge]", obj)
    }
  }

  let lastErr: unknown = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      log(logLevel, {
        event: "forward.request",
        toolName,
        attempt,
        timeoutMs,
        maskedKey: maskKey(key),
      })

      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ toolName, arguments: args }),
      })
      clearTimeout(id)

      const data = (await res.json()) as { result?: unknown; error?: string }
      if (!res.ok) {
        const err = new Error(data.error || `HTTP ${res.status}`)
        lastErr = err
        log("warn", { event: "forward.response_error", toolName, status: res.status, attempt, message: String(err) })
        if (attempt < retries) continue
        throw err
      }

      log(logLevel, { event: "forward.response_ok", toolName, attempt })
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data.result ?? null, null, 2) }],
      }
    } catch (e: unknown) {
      clearTimeout(id)
      lastErr = e
      const isAbort = (e as any)?.name === "AbortError"
      log("warn", { event: "forward.attempt_error", toolName, attempt, isAbort, message: String((e as any)?.message ?? e) })
      if (attempt >= retries) throw e
      // small backoff
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
    }
  }
  throw lastErr
}

const mcpServer = new McpServer({ name: "ainote-bridge", version: "0.1.0" })

mcpServer.registerTool(
  "list_missions",
  {
    description: "List missions; optional workspaceId filter",
    inputSchema: { workspaceId: z.string().optional() },
  },
  async (args) => forward("list_missions", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "list_boards",
  {
    description: "List boards in a mission",
    inputSchema: { missionId: z.string() },
  },
  async (args) => forward("list_boards", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "list_tasks",
  {
    description: "List tasks on a board",
    inputSchema: { boardId: z.string() },
  },
  async (args) => forward("list_tasks", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "list_notes",
  {
    description: "List notes in a mission",
    inputSchema: { missionId: z.string() },
  },
  async (args) => forward("list_notes", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "get_note",
  {
    description: "Get full note by noteId",
    inputSchema: { noteId: z.string() },
  },
  async (args) => forward("get_note", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "get_mission_snapshot",
  {
    description: "Full mission snapshot",
    inputSchema: { missionId: z.string() },
  },
  async (args) => forward("get_mission_snapshot", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "create_mission",
  {
    description: "Find or create mission in workspace",
    inputSchema: { workspaceId: z.string(), title: z.string() },
  },
  async (args) => forward("create_mission", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "create_board",
  {
    description: "Find or create board in mission",
    inputSchema: { missionId: z.string(), title: z.string() },
  },
  async (args) => forward("create_board", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "create_task",
  {
    description: "Create task on board",
    inputSchema: { boardId: z.string(), title: z.string() },
  },
  async (args) => forward("create_task", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "create_subtask",
  {
    description: "Create subtask on task",
    inputSchema: { boardId: z.string(), taskId: z.string(), title: z.string() },
  },
  async (args) => forward("create_subtask", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "create_note",
  {
    description: "Create note with blocks",
    inputSchema: {
      missionId: z.string(),
      noteTitle: z.string(),
      blocks: z.array(blockInput).optional(),
    },
  },
  async (args) => forward("create_note", args as Record<string, unknown>),
)

mcpServer.registerTool(
  "create_study_note",
  {
    description: "Create mission/board/task/subtask/note chain in one call",
    inputSchema: {
      workspaceId: z.string().optional(),
      missionTitle: z.string(),
      boardTitle: z.string(),
      taskTitle: z.string(),
      subtaskTitle: z.string(),
      noteTitle: z.string(),
      blocks: z.array(blockInput).optional(),
    },
  },
  async (args) => forward("create_study_note", args as Record<string, unknown>),
)

// Skill: 整理错题到云端（来自 mcp-bridge/skills/organize-wrong-answers.prompt.md）
mcpServer.registerTool(
  "organize_wrong_answers",
  {
    // 依然保留 md 作为详细指令
    description: fs.readFileSync(path.join(__dirname, "skills/organize-wrong-answers.prompt.md"), "utf-8"),
    inputSchema: {
      content: z.string().describe("需要整理的错题原始内容"),
      workspaceId: z.string().optional().describe("工作区ID"),
      missionId: z.string().optional().describe("任务ID"),
      // 删除了 options，因为 Agent 不需要关心重试次数和日志等级
    },
  },
  async (args) => {
    // 在内部定义默认工程参数
    const defaultOpts = {
      timeoutMs: 30000,
      retries: 2,
      logLevel: "info" as const
    };
    return forwardWithPolicy("organize_wrong_answers", args as Record<string, unknown>, defaultOpts);
  },
)

// Skill: 上传 docs 笔记到云端（来自 mcp-bridge/skills/upload-docs-to-ainote.prompt.md）
mcpServer.registerTool(
  "upload_docs_to_ainote",
  {
    description: fs.readFileSync(path.join(__dirname, "skills/upload-docs-to-ainote.prompt.md"), "utf-8"),

    inputSchema: {
      docsPath: z.string().optional(),
      workspaceId: z.string().optional(),
      missionTitle: z.string().optional(),
      options: z
        .object({
          timeoutMs: z.number().int().positive().optional(),
          retries: z.number().int().min(0).optional(),
          logLevel: z.enum(["info", "warn", "error"]).optional(),
        })
        .optional(),
    },
  },
  async (args) => {
    const opts = (args as any)?.options
    return forwardWithPolicy("upload_docs_to_ainote", args as Record<string, unknown>, opts)
  },
)

async function callTool(toolName: string, args: Record<string, unknown>, opts?: { timeoutMs?: number; retries?: number; logLevel?: "info" | "warn" | "error" }) {
  const res = await forwardWithPolicy(toolName, args, opts)
  try {
    const text = (res as any)?.content?.[0]?.text
    if (!text) return null
    return JSON.parse(text)
  } catch (e) {
    return (res as any)?.content?.[0]?.text ?? null
  }
}

function resolveId(obj: any, prefer?: string[]) {
  if (!obj) return undefined
  if (typeof obj === "string") return obj
  const candidates = prefer ?? ["id", "missionId", "noteId", "resultId"]
  for (const k of candidates) if (obj[k]) return obj[k]
  // try common fields
  if (obj?.mission?.id) return obj.mission.id
  if (obj?.note?.id) return obj.note.id
  return undefined
}

async function handleUploadDocs(args: Record<string, any>, opts?: { timeoutMs?: number; retries?: number; logLevel?: "info" | "warn" | "error" }) {
  const docsPath = args.docsPath ? path.resolve(args.docsPath as string) : path.join(__dirname, "..", "docs")
  const missionTitle = args.missionTitle || "项目文档"
  const workspaceId = args.workspaceId
  const log = (obj: unknown) => console.info("[mcp-bridge][upload_docs]", JSON.stringify(obj))

  // list missions
  const missions = (await callTool("list_missions", { workspaceId }, opts)) as any[] | null
  let mission = null
  if (Array.isArray(missions)) {
    mission = missions.find((m: any) => m?.title === missionTitle || m?.name === missionTitle)
  }
  if (!mission) {
    log({ event: "mission_not_found", missionTitle })
    const created = await callTool("create_mission", { workspaceId, title: missionTitle }, opts)
    log({ event: "mission_created", created })
    mission = created
  }
  const missionId = resolveId(mission, ["id", "missionId"]) as string | undefined
  if (!missionId) throw new Error("failed to determine missionId from created/available missions")

  // read docs directory
  let files: string[] = []
  try {
    const entries = await fsp.readdir(docsPath, { withFileTypes: true })
    files = entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name)
  } catch (e) {
    throw new Error(`failed to read docsPath ${docsPath}: ${String(e)}`)
  }

  const summary: Array<{ file: string; noteResult?: any; error?: string }> = []
  for (const f of files) {
    try {
      const content = await fsp.readFile(path.join(docsPath, f), "utf8")
      const noteTitle = f
      const noteRes = await callTool(
        "create_note",
        { missionId, noteTitle, blocks: [{ blockType: "markdown", blockContent: content }] },
        opts,
      )
      summary.push({ file: f, noteResult: noteRes })
    } catch (e: any) {
      summary.push({ file: f, error: String(e) })
    }
  }

  return { missionId, uploaded: summary }
}

// Skill: 整理错题到云端（orchestrator）
async function handleOrganizeWrongAnswers(args: Record<string, any>, opts?: { timeoutMs?: number; retries?: number; logLevel?: "info" | "warn" | "error" }) {
  const content = args.content
  if (!content) throw new Error("content is required")
  const missionTitle = (args.missionTitle as string) || "错题整理"
  const workspaceId = args.workspaceId
  const log = (obj: unknown) => console.info("[mcp-bridge][organize_wrong_answers]", JSON.stringify(obj))

  const missions = (await callTool("list_missions", { workspaceId }, opts)) as any[] | null
  let mission = null
  if (Array.isArray(missions)) {
    mission = missions.find((m: any) => m?.title === missionTitle || m?.name === missionTitle)
  }
  if (!mission) {
    log({ event: "mission_not_found", missionTitle })
    const created = await callTool("create_mission", { workspaceId, title: missionTitle }, opts)
    log({ event: "mission_created", created })
    mission = created
  }
  const missionId = resolveId(mission, ["id", "missionId"]) as string | undefined
  if (!missionId) throw new Error("failed to determine missionId")

  // For simplicity: create a single note containing the provided content. The full per-question splitting
  // and subtask creation described in the skill prompt can be implemented later.
  const noteTitle = (args.options && args.options.noteTitle) || `错题 - ${new Date().toISOString()}`
  const blocks = [{ blockType: "markdown", blockContent: String(content) }]
  const noteRes = await callTool("create_note", { missionId, noteTitle, blocks }, opts)
  return { missionId, noteRes }
}
async function main() {
  const transport = new StdioServerTransport()
  await mcpServer.connect(transport)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
