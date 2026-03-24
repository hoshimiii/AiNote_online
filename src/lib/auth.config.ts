// auth.config.ts — Edge Runtime 兼容的 Auth.js 基础配置
//
// 核心知识点：为什么要分两个文件？
// Next.js 中间件（middleware.ts）运行在 Vercel/Node.js 的 Edge Runtime 中，
// 这个运行时不支持 Node.js 原生模块（如 bcrypt 的 C++ binding、Prisma 的 TCP 连接等）。
// 因此需要把"只验证 JWT 令牌（纯 JS）"的逻辑放在这里，
// 而需要 Prisma/bcryptjs 的"登录验证"逻辑放在 auth.ts 里（Node.js Runtime）。

import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  // 自定义登录/登出页面路径
  pages: {
    signIn: "/login",
  },

  // providers 在这里留空，真正的 Credentials provider 在 auth.ts 里配置
  // 这里只声明 [] 告诉 Auth.js "我们有 provider，但不在 edge 里初始化它们"
  providers: [],

  callbacks: {
    // authorized 回调：在每次路由访问时被 middleware 调用
    // 返回 true → 允许访问，false → 重定向到 signIn 页面，Response → 自定义响应
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const pathname = nextUrl.pathname

      const isLoginPage = pathname === "/login"
      const isApiRoute = pathname.startsWith("/api/")

      // 已登录用户访问登录页 → 重定向到工作区
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/pages/workspacesPage", nextUrl))
      }

      // 未登录用户访问 API 路由 → 返回 401（避免 HTML 重定向进入 JSON 接口）
      if (!isLoggedIn && isApiRoute && !pathname.startsWith("/api/auth")) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
      }

      // 未登录用户访问受保护的页面 → false 会触发重定向到 pages.signIn
      if (!isLoggedIn && !isLoginPage) {
        return false
      }

      return true
    },
  },
}
