import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { auth } from "@/lib/auth"
import { SessionProvider } from "@/components/auth/SessionProvider"
import { ZustandRehydrate } from "@/components/ZustandRehydrate"
import { CloudSync } from "@/components/auth/CloudSync"
import { WebVitalsMonitor } from "@/components/performance/WebVitalsMonitor"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Ai Note",
  description: "跨设备的 AI 驱动笔记与看板工具",
}

// layout 是 async Server Component，可以直接 await auth() 获取当前 session
// 然后把 session 传给客户端的 SessionProvider，避免客户端再发一次请求
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground antialiased">
        <SessionProvider session={session}>
          <WebVitalsMonitor />
          {/* ZustandRehydrate：等 zustand persist 从 localStorage 恢复完毕后再渲染子树 */}
          <ZustandRehydrate>
            {/* CloudSync：在 zustand 恢复后对比云端数据，按需拉取或推送 */}
            <CloudSync />
            {children}
          </ZustandRehydrate>
        </SessionProvider>
      </body>
    </html>
  )
}
