// Next.js Middleware — 核心知识点：
// 1. middleware.ts 必须放在项目根目录（与 app/ 同级）。
// 2. 它运行在 Edge Runtime（类 Service Worker 环境），不能用 Node.js 原生 API。
// 3. 这里用 authConfig（不含 Prisma/bcrypt）来初始化一个轻量级的 Auth.js 实例，
//    它只做 JWT Cookie 验证，不访问数据库，性能极高。
// 4. matcher 告诉 Next.js 哪些路径需要经过 middleware，
//    排除静态文件和 /api/auth/* 可以减少不必要的执行开销。

import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"

// 使用 edge-compatible 的 authConfig 创建 middleware 专用的 auth 实例
const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  matcher: [
    // 匹配所有路径，但排除：
    // - /api/auth/* （Auth.js 自己的 handler，必须公开）
    // - /_next/static/* （静态资源）
    // - /_next/image/* （图片优化）
    // - /favicon.ico
    "/((?!api/auth|api/mcp|_next/static|_next/image|favicon.ico).*)",
  ],
}
