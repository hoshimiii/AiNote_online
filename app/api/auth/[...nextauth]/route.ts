// Auth.js v5 API Route Handler
// "[...nextauth]" 是 Next.js 的 catch-all 路由语法，
// 会匹配 /api/auth/* 下的所有路径，包括：
//   /api/auth/signin        — 登录
//   /api/auth/signout       — 登出
//   /api/auth/session       — 获取当前 session（JSON）
//   /api/auth/csrf          — CSRF token
//   /api/auth/callback/*    — OAuth 回调（如有）

import { handlers } from "@/lib/auth"

// Auth.js 提供的 GET/POST handler，直接导出即可
export const { GET, POST } = handlers
