"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useWorkSpace } from "@/store/kanban"
import { accountLease, isCurrentAccount, GUEST_OWNER } from "@/lib/account-boundary"
import { useChatbot} from '@/store/Chatbot'

const KANBAN_LOCAL_ONLY_KEYS = new Set([
  "activeWorkSpaceId",
  "activeMissionId",
  "currentMissionId",
  "currentNoteId",
  "previewMissionId",
])

function extractKanbanState(state: ReturnType<typeof useWorkSpace.getState>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(state as unknown as Record<string, unknown>).filter(
      ([k, v]) => typeof v !== "function" && !KANBAN_LOCAL_ONLY_KEYS.has(k)
    )
  )
}

const CHATBOT_SYNC_KEYS = ["chatbotId", "chatbotName", "chatbotDescription", "config", "messages"] as const

function extractChatbotState(): Record<string, unknown> {
  const state = useChatbot.getState() as unknown as Record<string, unknown>
  return Object.fromEntries(CHATBOT_SYNC_KEYS.map((k) => [k, state[k]]))
}

const REQUIRED_FIELDS: Array<{ key: string; type: "array" | "object" | "any" }> = [
  { key: "workspaces", type: "array" },
  { key: "missions", type: "object" },
  { key: "boards", type: "object" },
  { key: "tasks", type: "object" },
  { key: "missionOrder", type: "object" },
  { key: "boardOrder", type: "object" },
]

function validateAndApplyCloudData(
  cloudData: unknown,
  isSyncing: { current: boolean }
): boolean {
  if (!cloudData || typeof cloudData !== "object" || Array.isArray(cloudData)) {
    console.warn("[CloudSync] 云端数据格式无效（非对象），跳过覆盖")
    return false
  }

  const incoming = cloudData as Record<string, unknown>

  for (const { key, type } of REQUIRED_FIELDS) {
    if (!(key in incoming)) {
      console.warn(`[CloudSync] 云端数据缺少必要字段 "${key}"，跳过覆盖`)
      return false
    }
    const v = incoming[key]
    if (type === "array" && !Array.isArray(v)) {
      console.warn(`[CloudSync] 字段 "${key}" 应为 Array，实际为 ${typeof v}，跳过覆盖`)
      return false
    }
    if (type === "object" && (typeof v !== "object" || Array.isArray(v) || v === null)) {
      console.warn(`[CloudSync] 字段 "${key}" 应为 Object，实际为 ${typeof v}，跳过覆盖`)
      return false
    }
  }

  const currentKanban = useWorkSpace.getState() as unknown as Record<string, unknown>
  const kanbanKeys = Object.entries(currentKanban).filter(([, v]) => typeof v !== "function").map(([k]) => k)
  const mergedKanban: Record<string, unknown> = {}
  for (const key of kanbanKeys) {
    if (KANBAN_LOCAL_ONLY_KEYS.has(key)) {
      mergedKanban[key] = currentKanban[key]
    } else {
      mergedKanban[key] = key in incoming ? incoming[key] : currentKanban[key]
    }
  }

  isSyncing.current = true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useWorkSpace.setState(mergedKanban as any)

  // 应用 chatbot 数据（如果存在）
  if (incoming._chatbot && typeof incoming._chatbot === "object" && !Array.isArray(incoming._chatbot)) {
    const chatbotData = incoming._chatbot as Record<string, unknown>
    const currentChatbot = useChatbot.getState() as unknown as Record<string, unknown>
    const mergedChatbot: Record<string, unknown> = { ...currentChatbot }
    for (const key of CHATBOT_SYNC_KEYS) {
      if (key in chatbotData) mergedChatbot[key] = chatbotData[key]
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useChatbot.setState(mergedChatbot as any)
  }

  isSyncing.current = false
  return true
}

export function startCloudSync(owner: string, onState: (state: "pulling" | "pushing" | "done" | null) => void) {
  const lease = accountLease()
  const controller = new AbortController()
  const isSyncing = { current: false }
  let stopped = false
  let ready = false
  let debounce: ReturnType<typeof setTimeout> | undefined
  let doneTimer: ReturnType<typeof setTimeout> | undefined
  let pushing = false
  let dirty = false
  const current = () => !stopped && owner === lease.owner && isCurrentAccount(lease)
  const headers = { "Content-Type": "application/json", "X-Workspace-Owner": owner }
  const stopRequests = () => controller.abort()
  lease.signal.addEventListener("abort", stopRequests, { once: true })
  const done = () => {
    if (!current()) return
    onState("done")
    clearTimeout(doneTimer)
    doneTimer = setTimeout(() => { if (current()) onState(null) }, 1500)
  }
  const push = async () => {
    if (!current() || !ready) return
    if (pushing) { dirty = true; return }
    pushing = true
    dirty = false
    onState("pushing")
    try {
      const snapshot = { ...extractKanbanState(useWorkSpace.getState()), _chatbot: extractChatbotState() }
      const res = await fetch("/api/sync", { method: "PUT", headers, body: JSON.stringify(snapshot), signal: controller.signal })
      if (!res.ok) throw new Error("Cloud upload failed")
      const result = await res.json()
      if (!current()) return
      if (result.updatedAt) {
        isSyncing.current = true
        useWorkSpace.getState().setCloudSyncTime(result.updatedAt)
        isSyncing.current = false
      }
      done()
    } catch { if (current()) onState(null) }
    finally {
      pushing = false
      if (dirty && current()) { clearTimeout(debounce); debounce = setTimeout(() => void push(), 2000) }
    }
  }
  const changed = () => {
    if (!current() || isSyncing.current) return
    dirty = true
    if (!ready) return
    clearTimeout(debounce)
    debounce = setTimeout(() => void push(), 2000)
  }
  const pull = async (initial: boolean) => {
    if (!current() || (!initial && (dirty || pushing))) return
    onState("pulling")
    try {
      const res = await fetch("/api/sync", { headers, signal: controller.signal })
      if (!res.ok) throw new Error("Cloud download failed")
      const result = await res.json()
      if (!current()) return
      if (result.data) {
        const localTime = useWorkSpace.getState()._cloudSyncTime
        if (!dirty && new Date(result.updatedAt).getTime() > (localTime ? new Date(localTime).getTime() : 0)) {
          // A malformed cloud snapshot must not trigger an automatic overwrite.
          if (!validateAndApplyCloudData(result.data, isSyncing)) { onState(null); return }
          isSyncing.current = true
          useWorkSpace.getState().setCloudSyncTime(result.updatedAt)
          isSyncing.current = false
        }
      }
      ready = true
      if (!result.data || dirty) await push()
      else done()
    } catch { if (current()) onState(null) }
  }
  const unsubKanban = useWorkSpace.subscribe(changed)
  const unsubChatbot = useChatbot.subscribe(changed)
  const visible = () => { if (document.visibilityState === "visible") void pull(false) }
  document.addEventListener("visibilitychange", visible)
  void pull(true)
  return () => {
    stopped = true
    controller.abort()
    lease.signal.removeEventListener("abort", stopRequests)
    clearTimeout(debounce)
    clearTimeout(doneTimer)
    unsubKanban()
    unsubChatbot()
    document.removeEventListener("visibilitychange", visible)
  }
}

export function CloudSync() {
  const { data: session, status } = useSession()
  const owner = status === "authenticated" ? session?.user?.id : undefined
  const [state, setState] = useState<"pulling" | "pushing" | "done" | null>(null)
  useEffect(() => {
    if (!owner || owner === GUEST_OWNER) return
    return startCloudSync(owner, setState)
  }, [owner])
  if (!state) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-9999 rounded-full bg-background border px-4 py-2 text-sm" role="status">
      {state === "done" ? "数据已同步" : state === "pulling" ? "正在从云端读取数据..." : "正在上传本地数据..."}
    </div>
  )
}
