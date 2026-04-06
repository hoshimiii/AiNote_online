import { LoginForm } from "@/components/auth/LoginForm"
import { NotebookPen } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <NotebookPen className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Ai Note</h1>
        <p className="text-sm text-muted-foreground">登录后可跨设备同步你的工作区数据</p>
      </div>
      <LoginForm />
    </div>
  )
}
