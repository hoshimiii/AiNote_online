"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { logoutAction } from "@/lib/actions"

interface LogoutButtonProps {
  variant?: "default" | "ghost" | "outline"
  showIcon?: boolean
}

export function LogoutButton({ variant = "ghost", showIcon = true }: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={handleLogout}
      disabled={isPending}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      {showIcon && <LogOut className="h-4 w-4" />}
      {isPending ? "退出中…" : "退出登录"}
    </Button>
  )
}
