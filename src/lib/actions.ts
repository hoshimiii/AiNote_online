// Server Actions — 核心知识点：
// Server Actions 是 Next.js 13+ 引入的功能，允许在客户端组件中直接调用服务器端函数。
// 优点：不需要手写 API route + fetch，类型安全，能捕获 Auth.js 的重定向异常。
//
// 注意："use server" 指令告诉 Next.js 这些函数只在服务器端运行。
// 客户端调用时，Next.js 会通过内部 RPC 机制发请求——你不需要写 fetch 了。

"use server"

import { signIn, signOut } from "./auth"
import { AuthError } from "next-auth"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
})

// 登录 Server Action
// Auth.js v5 中，signIn 在登录成功后会抛出一个"NEXT_REDIRECT"类型的错误来触发重定向。
// 这不是真正的错误，需要 rethrow，而 CredentialsSignin 才是真正的失败。
export async function loginAction(
  email: string,
  password: string
): Promise<{ error: string } | void> {
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/pages/workspacesPage",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "邮箱或密码错误，请检查后重试" }
        default:
          return { error: "登录失败，请稍后重试" }
      }
    }
    // 非 AuthError 的异常（包括重定向）必须 rethrow，否则重定向不会生效
    throw error
  }
}

// 注册 Server Action
export async function registerAction(
  email: string,
  password: string,
  name?: string
): Promise<{ error: string } | void> {
  const parsed = registerSchema.safeParse({ email, password, name })
  if (!parsed.success) {
    return { error: "输入数据格式不正确" }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { error: "该邮箱已注册" }
  }

  // bcrypt.hash 的第二个参数是 salt rounds（加密轮数）。
  // 轮数越高越安全，但越慢。12 是目前的推荐值（约 300ms/hash）。
  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: { email, name: name || null, passwordHash },
  })

  // 注册成功后自动登录
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/pages/workspacesPage",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "注册成功但自动登录失败，请手动登录" }
    }
    throw error
  }
}

// 登出 Server Action
export async function logoutAction() {
  await signOut({ redirectTo: "/login" })
}
