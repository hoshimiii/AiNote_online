"use client"

import { useState } from "react"

export function LegacyLocalDataRecovery() {
  const [available] = useState(() => typeof localStorage !== "undefined" &&
    ["workspace-storage", "chatbot-storage"].some((key) => localStorage.getItem(key) !== null))
  if (!available) return null
  const exportLegacy = () => {
    const data = Object.fromEntries(["workspace-storage", "chatbot-storage"].map((key) => [key, localStorage.getItem(key)]))
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "ainote-legacy-local.json"
    link.click()
    URL.revokeObjectURL(url)
  }
  return <aside className="border p-3 text-sm">
    检测到未标记账号的旧版本地数据，已保留且不会自动上传。导出后可自行确认归属并恢复笔记；文件可能包含 API Key，请妥善保管。
    <button type="button" className="ml-2 underline" onClick={exportLegacy}>导出旧版本地数据</button>
  </aside>
}
