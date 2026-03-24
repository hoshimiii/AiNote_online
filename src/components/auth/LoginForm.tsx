"use client"

import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { loginAction, registerAction } from "@/lib/actions"

type Mode = "login" | "register"

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  // useTransition：在 Server Action 执行期间标记"pending"状态，不阻塞 UI
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result =
        mode === "login"
          ? await loginAction(email, password)
          : await registerAction(email, password, name || undefined)
      if (result?.error) {
        setError(result.error)
      }
      // 无错误时，Server Action 内部的 redirect 会自动跳转
    })
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Tab 切换 */}
      <div className="flex rounded-lg border border-border/60 p-1">
        {(["login", "register"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null) }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "login" ? "登录" : "注册"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "register" && (
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">昵称（可选）</label>
            <Input
              type="text"
              placeholder="你的名字"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">邮箱</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isPending}
            autoComplete="email"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">密码</label>
          <Input
            type="password"
            placeholder="至少 6 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={isPending}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "处理中…" : mode === "login" ? "登录" : "注册并登录"}
        </Button>
      </form>
    </div>
  )
}
