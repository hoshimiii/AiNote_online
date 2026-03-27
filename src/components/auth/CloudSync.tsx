// CloudSync — 云端同步组件
//
// 核心知识点：
// 1. 这是一个纯逻辑组件（返回 null），专门处理云端同步副作用。
// 2. 将其放在 <ZustandRehydrate> 内部，保证 zustand 本地状态已恢复后才开始与云端对比。
// 3. 同步策略：Last-Write-Wins（LWW）
//    - 比较云端的 updatedAt 和本地最后同步时间戳
//    - 云端更新 → 拉取覆盖本地（跨设备时场景）
//    - 本地更新 → 推送到云端（刚注册的用户 / 修改了数据）
// 4. 防抖（debounce）：zustand subscribe 会在每次状态变化时触发，
//    用 setTimeout 延迟 2 秒再推送，避免每次按键都发一个 PUT 请求。
// 5. isSyncing flag：防止从云端拉取数据后，setState 又触发 subscribe 导致立刻回写。

// CloudSync — 云端同步组件
//
// 核心知识点：
// 1. 这是一个纯逻辑组件（返回 null），专门处理云端同步副作用。
// 2. 将其放在 <ZustandRehydrate> 内部，保证 zustand 本地状态已恢复后才开始与云端对比。
// 3. 同步策略：Last-Write-Wins（LWW）
//    - 比较云端的 updatedAt 和本地最后同步时间戳
//    - 云端更新 → 拉取覆盖本地（跨设备时场景）
//    - 本地更新 → 推送到云端（刚注册的用户 / 修改了数据）
// 4. 防抖（debounce）：zustand subscribe 会在每次状态变化时触发，
//    用 setTimeout 延迟 2 秒再推送，避免每次按键都发一个 PUT 请求。
// 5. isSyncing flag：防止从云端拉取数据后，setState 又触发 subscribe 导致立刻回写。

"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useWorkSpace } from "@/store/kanban"
import { useChatbot} from '@/store/Chatbot'

function extractKanbanState(state: ReturnType<typeof useWorkSpace.getState>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(state as unknown as Record<string, unknown>).filter(([, v]) => typeof v !== "function")
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
    mergedKanban[key] = key in incoming ? incoming[key] : currentKanban[key]
  }

  isSyncing.current = true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useWorkSpace.setState(mergedKanban as any, true)

  // 应用 chatbot 数据（如果存在）
  if (incoming._chatbot && typeof incoming._chatbot === "object" && !Array.isArray(incoming._chatbot)) {
    const chatbotData = incoming._chatbot as Record<string, unknown>
    const currentChatbot = useChatbot.getState() as unknown as Record<string, unknown>
    const mergedChatbot: Record<string, unknown> = { ...currentChatbot }
    for (const key of CHATBOT_SYNC_KEYS) {
      if (key in chatbotData) mergedChatbot[key] = chatbotData[key]
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useChatbot.setState(mergedChatbot as any, true)
  }

  setTimeout(() => { isSyncing.current = false }, 200)
  return true
}

export function CloudSync() {
  const { data: session, status } = useSession()
  const hasPulled = useRef(false)
  const isSyncing = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pushToCloud = () => {
    const snapshot = {
      ...extractKanbanState(useWorkSpace.getState()),
      _chatbot: extractChatbotState(),
    }
    fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.updatedAt) {
          useWorkSpace.getState().setCloudSyncTime(result.updatedAt)
        }
      })
      .catch(console.error)
  }

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id || hasPulled.current) return
    hasPulled.current = true

    fetch("/api/sync")
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (!result?.data) {
          pushToCloud()
          return
        }

        const cloudTime = new Date(result.updatedAt).getTime()
        const localSyncTime = useWorkSpace.getState()._cloudSyncTime
        const lastSynced = localSyncTime ? new Date(localSyncTime).getTime() : 0

        if (cloudTime > lastSynced) {
          const applied = validateAndApplyCloudData(result.data, isSyncing)
          if (applied) {
            useWorkSpace.getState().setCloudSyncTime(result.updatedAt)
          } else {
            console.warn("[CloudSync] 云端数据验证失败，以本地数据覆盖云端")
            pushToCloud()
          }
        }
      })
      .catch(console.error)
  }, [status, session?.user?.id])

  useEffect(() => {
    if (status !== "authenticated") return

    const unsubKanban = useWorkSpace.subscribe(() => {
      if (isSyncing.current) return
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(pushToCloud, 2000)
    })

    const unsubChatbot = useChatbot.subscribe(() => {
      if (isSyncing.current) return
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(pushToCloud, 2000)
    })

    return () => {
      unsubKanban()
      unsubChatbot()
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [status])

  useEffect(() => {
    if (status === "unauthenticated") {
      hasPulled.current = false
    }
  }, [status])

  return null
}
