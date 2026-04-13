"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { generateMcpApiKey, getMcpApiKeyStatus } from "@/lib/actions"

export function McpApiKeyCard() {
  const [hasKey, setHasKey] = useState(false)
  const [shownKey, setShownKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const refresh = () => {
    getMcpApiKeyStatus()
      .then((s) => setHasKey(s.hasKey))
      .catch(() => setHasKey(false))
  }

  useEffect(() => {
    refresh()
  }, [])

  const onGenerate = async () => {
    setLoading(true)
    setErr(null)
    setShownKey(null)
    try {
      const r = await generateMcpApiKey()
      if ("error" in r) setErr(r.error)
      else {
        setShownKey(r.key)
        setHasKey(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const envExample = `AINOTE_API_KEY=${shownKey ?? "<粘贴上方密钥>"}\nVERCEL_API_URL=${origin || "https://你的域名"}/api/mcp`

  return (
    <div className="flex flex-col gap-3 rounded-md border border-input p-4">
      <div className="text-sm font-medium">MCP API Key</div>
      <p className="text-xs text-muted-foreground">
        用于本地 MCP Bridge 访问当前账号的云端看板。密钥仅生成时显示一次，请妥善保存。
      </p>
      {hasKey && !shownKey && (
        <p className="text-xs text-amber-600">已启用。重新生成会使旧密钥立即失效。</p>
      )}
      {err && <p className="text-xs text-red-500">{err}</p>}
      {shownKey && (
        <div className="flex flex-col gap-2">
          <div className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">{shownKey}</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit cursor-pointer"
            onClick={() => void navigator.clipboard.writeText(shownKey)}
          >
            复制密钥
          </Button>
          <div className="text-xs text-muted-foreground">mcp-bridge/.env 示例：</div>
          <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-[10px] whitespace-pre-wrap">
            {envExample}
          </pre>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-fit cursor-pointer"
        disabled={loading}
        onClick={() => void onGenerate()}
      >
        {hasKey ? "重新生成 API Key" : "生成 API Key"}
      </Button>
    </div>
  )
}
