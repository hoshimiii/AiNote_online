import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function Home() {
  const session = await auth()
  // 已登录 → 进工作区，未登录 → middleware 会重定向到 /login
  redirect(session ? "/pages/workspacesPage" : "/login")
}
