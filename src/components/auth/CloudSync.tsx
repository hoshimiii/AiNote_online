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

const LAST_CLOUD_PULL_KEY = "__ainote_last_cloud_pull"

// 自动从 store state 中提取所有可序列化字段（过滤掉函数类型的 actions）。
//
// 优势：不再硬编码字段列表——未来向 store 新增任何非函数字段时，
// 会自动被纳入云端同步，无需手动维护。
function extractSerializableState(
  state: ReturnType<typeof useWorkSpace.getState>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(state as unknown as Record<string, unknown>).filter(
      ([, v]) => typeof v !== "function"
    )
  )
}

// 关键字段结构定义：同步前必须通过这些检查，否则拒绝应用云端数据。
// 这是防止服务端返回损坏数据时覆盖本地正常状态的最后一道防线。
const REQUIRED_FIELDS: Array<{ key: string; type: "array" | "object" | "any" }> = [
  { key: "workspaces", type: "array" },
  { key: "missions", type: "object" },
  { key: "boards", type: "object" },
  { key: "tasks", type: "object" },
  { key: "missionOrder", type: "object" },
  { key: "boardOrder", type: "object" },
]

// 验证云端数据结构，并与本地当前 store 状态合并后安全应用。
//
// 策略：
// - 对关键字段做类型检查，任一不通过则整体拒绝（不做部分写入）
// - 只覆盖云端数据中存在的字段；云端缺失的字段（可能是新增字段）保留本地值
// - 未知的云端字段（本地 store 没有的 key）不会被注入，防止污染 store
//
// 返回 true 表示数据有效并已应用，false 表示验证失败已跳过。
function validateAndApplyCloudData(
  cloudData: unknown,
  isSyncing: { current: boolean }
): boolean {
  // 基础类型检查：必须是非 null 的普通对象
  if (!cloudData || typeof cloudData !== "object" || Array.isArray(cloudData)) {
    console.warn("[CloudSync] 云端数据格式无效（非对象），跳过覆盖")
    return false
  }

  const incoming = cloudData as Record<string, unknown>

  // 关键字段结构校验
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
    if (
      type === "object" &&
      (typeof v !== "object" || Array.isArray(v) || v === null)
    ) {
      console.warn(`[CloudSync] 字段 "${key}" 应为 Object，实际为 ${typeof v}，跳过覆盖`)
      return false
    }
  }

  // 获取本地 store 所有数据键（非函数）——作为允许覆盖的白名单
  const currentState = useWorkSpace.getState()
  const currentAsMap = currentState as unknown as Record<string, unknown>
  const localDataKeys = Object.entries(currentAsMap)
    .filter(([, v]) => typeof v !== "function")
    .map(([k]) => k)

  // 构建合并后的状态：
  //   - 云端有的字段 → 用云端值（跨设备同步）
  //   - 云端没有的字段 → 保留本地值（兼容未来新增字段）
  //   - 云端有但本地 store 不认识的字段 → 忽略（防止注入未知数据）
  const merged: Record<string, unknown> = {}
  for (const key of localDataKeys) {
    merged[key] = key in incoming ? incoming[key] : currentAsMap[key]
  }

  isSyncing.current = true
  // 先用 Partial 更新已知字段，再单独覆盖其余部分，绕过 zustand 对 replace:true 的严格类型检查
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useWorkSpace.setState(merged as any, true)
  // 短暂延迟后重置 flag，让 subscribe 恢复正常工作
  setTimeout(() => {
    isSyncing.current = false
  }, 200)
  return true
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
          // 经过结构验证和安全合并后再应用
          const applied = validateAndApplyCloudData(result.data, isSyncing)
          if (applied) {
            localStorage.setItem(LAST_CLOUD_PULL_KEY, String(cloudTime))
          } else {
            // 验证失败：云端数据有问题，推送本地数据覆盖云端
            console.warn("[CloudSync] 云端数据验证失败，以本地数据覆盖云端")
            pushToCloud()
          }
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
