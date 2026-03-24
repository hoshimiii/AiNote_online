// Prisma 单例模式 — 核心知识点：
// Next.js 在开发环境下使用热重载（Hot Module Replacement, HMR）。
// 每次文件保存时 Node.js 模块会被重新加载，如果不做单例处理，
// 每次 HMR 都会创建一个新的 PrismaClient 实例，很快耗尽数据库连接池（默认上限 ~10 个连接）。
//
// 解决方案：把 PrismaClient 实例挂在 Node.js 全局变量 `globalThis` 上。
// globalThis 的内容在 HMR 时不会被重置，所以整个进程生命周期内只有一个实例。
// 生产环境下，每次请求都是独立的 Worker，不存在 HMR，所以直接 new PrismaClient() 即可。

import { PrismaClient } from "@prisma/client"
import { withAccelerate } from "@prisma/extension-accelerate"

// Prisma Accelerate 知识点：
// 当 DATABASE_URL 使用 prisma+postgres://accelerate.prisma-data.net 时，
// 必须用 withAccelerate() 扩展，否则 PrismaClient 会忽略该 URL 并回退到 localhost。
// withAccelerate() 会接管所有查询，通过 Prisma 的全球边缘网络代理到真实数据库。
//
// 注意：使用 Accelerate 后返回类型略有变化（扩展类型），
// 因此这里用 ReturnType<typeof makeClient> 而非直接写 PrismaClient。

function makeClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }).$extends(withAccelerate())
}

type PrismaClientWithAccelerate = ReturnType<typeof makeClient>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientWithAccelerate | undefined
}

export const prisma = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
