// SessionProvider — 核心知识点：
// Next.js App Router 的 layout.tsx 是 Server Component，但 next-auth/react 的
// SessionProvider 是 Client Component（使用了 React Context）。
// 解决方案：创建一个薄的 "use client" 包装层，这样 layout.tsx 可以
// 以 Server Component 的方式渲染，同时子树中的客户端组件能通过 useSession() 访问 session。
//
// 传入 session prop（服务端已获取）可以避免客户端发出额外的 /api/auth/session 请求，
// 减少首屏 waterfall loading。

"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import type { Session } from "next-auth"
import type { ReactNode } from "react"

interface Props {
  children: ReactNode
  session: Session | null
}

export function SessionProvider({ children, session }: Props) {
  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  )
}
