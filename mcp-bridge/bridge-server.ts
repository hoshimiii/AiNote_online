import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
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
  const url = process.env.VERCEL_API_URL
  const key = process.env.AINOTE_API_KEY
  if (!url?.trim()) throw new Error("VERCEL_API_URL is not set")
  if (!key?.trim()) throw new Error("AINOTE_API_KEY is not set")
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ toolName, arguments: args }),
  })
  const data = (await res.json()) as { result?: unknown; error?: string }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data.result ?? null, null, 2) }],
  }
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

async function main() {
  const transport = new StdioServerTransport()
  await mcpServer.connect(transport)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
