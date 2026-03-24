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

// localStorage key：记录上次成功从云端拉取数据的时间戳（毫秒）
const LAST_CLOUD_PULL_KEY = "__ainote_last_cloud_pull"

// 从 zustand store state 中提取可序列化的字段（排除函数）
function extractSerializableState(state: ReturnType<typeof useWorkSpace.getState>) {
  const {
    workspaces,
    activeWorkSpaceId,
    activeMissionId,
    currentMissionId,
    currentNoteId,
    previewMissionId,
    missionOrder,
    boardOrder,
    missions,
    boards,
    tasks,
  } = state
  return {
    workspaces,
    activeWorkSpaceId,
    activeMissionId,
    currentMissionId,
    currentNoteId,
    previewMissionId,
    missionOrder,
    boardOrder,
    missions,
    boards,
    tasks,
  }
}

export function CloudSync() {
  const { data: session, status } = useSession()
  const hasPulled = useRef(false)
  const isSyncing = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 推送本地状态到云端
  const pushToCloud = () => {
    const snapshot = extractSerializableState(useWorkSpace.getState())
    fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (result?.updatedAt) {
          localStorage.setItem(
            LAST_CLOUD_PULL_KEY,
            String(new Date(result.updatedAt).getTime())
          )
        }
      })
      .catch(console.error)
  }

  // 首次会话建立后，拉取云端数据并决定是否覆盖本地
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id || hasPulled.current) return
    hasPulled.current = true

    fetch("/api/sync")
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (!result?.data) {
          // 云端无数据（新用户），立刻把本地数据推上去
          pushToCloud()
          return
        }

        const cloudTime = new Date(result.updatedAt).getTime()
        const lastPull = Number(localStorage.getItem(LAST_CLOUD_PULL_KEY) ?? "0")

        if (cloudTime > lastPull) {
          // 云端比上次同步更新（例如另一台设备做了修改）
          isSyncing.current = true
          // true 参数替换全部 state（而非合并）
          useWorkSpace.setState(result.data as object, true)
          localStorage.setItem(LAST_CLOUD_PULL_KEY, String(cloudTime))
          setTimeout(() => { isSyncing.current = false }, 200)
        } else {
          // 本地更新，将本地最新状态推给云端
          pushToCloud()
        }
      })
      .catch(console.error)
  }, [status, session?.user?.id])

  // 订阅 zustand 变化，防抖后推送
  useEffect(() => {
    if (status !== "authenticated") return

    const unsub = useWorkSpace.subscribe(() => {
      if (isSyncing.current) return // 跳过云端拉取触发的 setState
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(pushToCloud, 2000)
    })

    return () => {
      unsub()
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [status])

  // 用户登出时清除同步时间戳，防止下次登录另一账号时误判
  useEffect(() => {
    if (status === "unauthenticated") {
      localStorage.removeItem(LAST_CLOUD_PULL_KEY)
      hasPulled.current = false
    }
  }, [status])

  return null
}
