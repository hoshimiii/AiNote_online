// auth.ts — 完整 Auth.js 配置（Node.js Runtime，包含数据库访问）
//
// 核心知识点：Auth.js v5（next-auth@beta）与 v4 的主要区别：
// 1. 配置入口从 [...nextauth]/route.ts 移到了独立文件（auth.ts）
// 2. `auth()` 函数可以直接在 Server Components 和 API Route 里调用获取 session
// 3. JWT Strategy：会话信息存在加密的 JWT Cookie 里（无需数据库存 session），
//    更适合 Vercel 等无状态部署场景
// 4. Credentials Provider：处理邮箱/密码登录（OAuth 登录如 GitHub/Google 直接加 provider 即可扩展）

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "./prisma"
import { authConfig } from "./auth.config"

// TypeScript：扩展 Session 和 JWT 类型以包含 userId
// 默认的 Session["user"] 只有 name/email/image，我们需要加上 id
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
    }
  }
}

declare module "next-auth" {
  interface JWT {
    userId: string
  }
}

// 登录表单数据校验 schema
const credentialsSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(6, "密码至少 6 位"),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  // 继承 edge-compatible 的基础配置（pages、authorized 回调等）
  ...authConfig,

  // JWT strategy：session 存在签名的 HttpOnly Cookie 中，不存入数据库
  // 优点：无状态、速度快、易于水平扩展
  // 缺点：无法强制让 token 立即失效（除非用短过期时间 + refresh token）
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },

      // authorize：用户提交登录表单时调用
      // 返回用户对象 → 登录成功；返回 null → 登录失败
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        // 查找用户
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        // bcrypt.compare：安全地比对明文密码和存储的哈希值
        // 即使两次哈希结果不同（因为 bcrypt 使用随机 salt），compare 也能正确验证
        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) return null

        // 返回的对象会被序列化到 JWT token 里
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],

  callbacks: {
    // jwt 回调：每次创建/刷新 JWT 时调用
    // user 参数只在首次登录时存在，之后只有 token
    jwt: ({ token, user }) => {
      if (user?.id) {
        token.userId = user.id
      }
      return token
    },

    // session 回调：每次调用 auth() 或 useSession() 时调用
    // 把 JWT token 里的 userId 传给 session 对象（客户端可访问）
    session: ({ session, token }) => {
      if (token.userId) {
        session.user.id = token.userId as string
      }
      return session
    },
  },
})
