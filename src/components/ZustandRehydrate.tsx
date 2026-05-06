"use client"

import { useLayoutEffect, useState, type ReactNode } from "react"
import { useWorkSpace } from "@/store/kanban"

// ZustandRehydrate：等待 zustand persist 从 localStorage 恢复完毕后再渲染子树。
//
// 核心知识点：
// Next.js 在 SSR 时，服务端没有 localStorage，所以 persist 中间件会跳过初始化。
// 客户端 hydration 后，persist 会异步从 localStorage 读取数据并恢复 store 状态。
// 如果在恢复完成前就渲染了依赖 store 的组件，用户操作（如点击"新建"）可能被
// 随后恢复的旧数据覆盖——这就是 "创建后消失" 的 bug 根源。
//
// 解决方案：
// 1. 在 auth.ts 配置中设置 skipHydration: true，阻止 persist 自动初始化。
// 2. 在 useLayoutEffect 里手动调用 rehydrate()，并等待 onFinishHydration 回调。
// 3. ready = true 之前只渲染一个占位 div，保持页面结构不变（避免 CLS）。
export function ZustandRehydrate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const p = useWorkSpace.persist
    if (!p) {
      queueMicrotask(() => setReady(true))
      return
    }
    if (p.hasHydrated()) {
      queueMicrotask(() => setReady(true))
      return
    }
    const unsub = p.onFinishHydration(() => setReady(true))
    void p.rehydrate()
    return unsub
  }, [])

  if (!ready) {
    return <div className="min-h-screen flex-1 bg-background" aria-hidden />
  }
  return <>{children}</>
}
