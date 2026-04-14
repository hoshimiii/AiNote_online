import { spawn } from "child_process";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
}

export interface CodeExecutor {
    execute(code: string, language: string): Promise<ExecutionResult>;
    supportedLanguages(): string[];
}

const SUPPORTED_LANGUAGES = ["javascript", "typescript", "python", "cpp", "java"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// ─── Piston language map ──────────────────────────────────────────────────────

/**
 * 内部语言名 → Piston API 所需的语言标识符与版本。
 * version "*" 表示使用 Piston 上最新可用版本。
 */
const PISTON_LANG_MAP: Record<SupportedLanguage, { language: string; version: string }> = {
    javascript: { language: "javascript", version: "*" },
    typescript: { language: "typescript", version: "*" },
    python:     { language: "python",     version: "*" },
    cpp:        { language: "c++",        version: "*" },
    java:       { language: "java",       version: "*" },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CODE_SIZE     = 64  * 1024; // 64 KB
const EXECUTION_TIMEOUT = 10_000;     // 10 s  (local)
const PISTON_TIMEOUT    = 15_000;     // 15 s  (network)
const MAX_OUTPUT_SIZE   = 256 * 1024; // 256 KB

// ─── Local binary finders ─────────────────────────────────────────────────────

/**
 * 定位 tsx 可执行文件。
 * 优先顺序：
 *   1. 项目本地 node_modules/.bin/tsx（Windows 为 .cmd）
 *   2. Linux/macOS 的 /usr/local/bin/tsx、/usr/bin/tsx
 *   3. 直接回退到 PATH 中的 tsx（[.cmd]）
 */
function getTsxBin(): string {
    const isWin  = process.platform === "win32";
    const ext    = isWin ? ".cmd" : "";
    const local  = join(process.cwd(), "node_modules", ".bin", `tsx${ext}`);
    if (existsSync(local)) return local;
    if (!isWin) {
        for (const p of ["/usr/local/bin/tsx", "/usr/bin/tsx"]) {
            if (existsSync(p)) return p;
        }
    }
    return `tsx${ext}`;
}

/**
 * 定位 g++ 编译器（跨平台）。
 *   Windows : MSYS2 ucrt64/mingw64/clang64 > MinGW 独立安装 > PATH
 *   macOS   : Homebrew (/opt/homebrew) > /usr/local > /usr/bin > PATH
 *   Linux   : /usr/bin > /usr/local/bin > PATH
 */
function findGPlusPlus(): string {
    switch (process.platform) {
        case "win32":
            for (const c of [
                "C:\\msys64\\ucrt64\\bin\\g++.exe",
                "C:\\msys64\\mingw64\\bin\\g++.exe",
                "C:\\msys64\\clang64\\bin\\g++.exe",
                "C:\\mingw64\\bin\\g++.exe",
                "C:\\MinGW\\bin\\g++.exe",
            ]) { if (existsSync(c)) return c; }
            return "g++";
        case "darwin":
            for (const c of [
                "/opt/homebrew/bin/g++",
                "/usr/local/bin/g++",
                "/usr/bin/g++",
            ]) { if (existsSync(c)) return c; }
            return "g++";
        default: // linux
            for (const c of ["/usr/bin/g++", "/usr/local/bin/g++"]) {
                if (existsSync(c)) return c;
            }
            return "g++";
    }
}

/**
 * 定位 javac / java 可执行文件（跨平台）。
 * 优先顺序：
 *   1. JAVA_HOME 环境变量
 *   2. Windows : Program Files 下的常见 JDK 安装目录（自动扫描子目录）
 *   3. macOS   : /Library/Java/JavaVirtualMachines/ 下各 JDK
 *   4. Linux   : /usr/bin, /usr/local/bin
 *   5. PATH 回退
 */
function findJavaBin(exe: "javac" | "java"): string {
    const isWin = process.platform === "win32";
    const suffix = isWin ? ".exe" : "";

    // 1. JAVA_HOME
    const javaHome = process.env.JAVA_HOME;
    if (javaHome) {
        const p = join(javaHome, "bin", `${exe}${suffix}`);
        if (existsSync(p)) return p;
    }

    switch (process.platform) {
        case "win32": {
            const bases = [
                "C:\\Program Files\\Java",
                "C:\\Program Files\\Microsoft",
                "C:\\Program Files\\Eclipse Adoptium",
                "C:\\Program Files\\BellSoft",
                "C:\\Program Files\\Amazon Corretto",
            ];
            for (const base of bases) {
                if (!existsSync(base)) continue;
                try {
                    for (const dir of readdirSync(base)) {
                        const p = join(base, dir, "bin", `${exe}.exe`);
                        if (existsSync(p)) return p;
                    }
                } catch { /* no read permission */ }
            }
            return exe;
        }
        case "darwin": {
            const jvmBase = "/Library/Java/JavaVirtualMachines";
            if (existsSync(jvmBase)) {
                try {
                    for (const dir of readdirSync(jvmBase)) {
                        const p = join(jvmBase, dir, "Contents", "Home", "bin", exe);
                        if (existsSync(p)) return p;
                    }
                } catch { /* no read permission */ }
            }
            for (const p of [`/usr/bin/${exe}`, `/usr/local/bin/${exe}`]) {
                if (existsSync(p)) return p;
            }
            return exe;
        }
        default: { // linux
            for (const p of [`/usr/bin/${exe}`, `/usr/local/bin/${exe}`]) {
                if (existsSync(p)) return p;
            }
            return exe;
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateOutput(output: string, max = MAX_OUTPUT_SIZE): string {
    if (output.length <= max) return output;
    return output.slice(0, max) + "\n... [output truncated]";
}

/**
 * Spawn a child process and collect its stdout/stderr.
 *
 * Windows caveat: spawning a .cmd file with shell:false throws EINVAL.
 * We transparently wrap such commands with `cmd.exe /c`.
 */
function runProcess(
    cmd: string,
    args: string[],
    options: { cwd: string; timeout: number },
): Promise<ExecutionResult> {
    let actualCmd = cmd;
    let actualArgs = args;
    if (process.platform === "win32" && cmd.toLowerCase().endsWith(".cmd")) {
        actualCmd = "cmd.exe";
        actualArgs = ["/c", cmd, ...args];
    }

    return new Promise((resolve) => {
        const start = Date.now();
        let stdout = "";
        let stderr = "";
        let killed = false;

        const proc = spawn(actualCmd, actualArgs, {
            cwd: options.cwd,
            timeout: options.timeout,
            stdio: ["ignore", "pipe", "pipe"],
            shell: false,
            windowsHide: true,
        });

        proc.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
            if (stdout.length > MAX_OUTPUT_SIZE) {
                stdout = truncateOutput(stdout);
                proc.kill("SIGTERM");
                killed = true;
            }
        });

        proc.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
            if (stderr.length > MAX_OUTPUT_SIZE) {
                stderr = truncateOutput(stderr);
                proc.kill("SIGTERM");
                killed = true;
            }
        });

        proc.on("close", (code, signal) => {
            const duration = Date.now() - start;
            if (signal === "SIGTERM" && !killed) stderr += "\n[执行超时，已终止]";
            resolve({
                stdout: truncateOutput(stdout),
                stderr: truncateOutput(stderr),
                exitCode: code ?? (signal ? 137 : 1),
                duration,
            });
        });

        proc.on("error", (err: NodeJS.ErrnoException) => {
            let message = err.message;
            if (err.code === "ENOENT") {
                message = `未找到可执行文件 "${actualCmd}"。请确认已安装对应的编译器/运行时并添加到系统 PATH。`;
            } else if (err.code === "EACCES") {
                message = `无执行权限 "${actualCmd}"。`;
            }
            resolve({ stdout: "", stderr: message, exitCode: 1, duration: Date.now() - start });
        });
    });
}

function extractJavaClassName(code: string): string {
    return code.match(/public\s+class\s+(\w+)/)?.[1] ?? "Main";
}

// ─── PistonExecutor ───────────────────────────────────────────────────────────

/**
 * 通过 Piston 沙箱 API 执行代码。
 *
 * 兼容本地 Docker 实例和公开 API：
 *   本地 Docker : docker run --rm -dp 2000:2000 ghcr.io/engineer-man/piston
 *                 → baseUrl = "http://localhost:2000"
 *   公开 API    : baseUrl = "https://emkc.org"
 *
 * API 文档: https://github.com/engineer-man/piston#usage
 */
export class PistonExecutor implements CodeExecutor {
    constructor(private readonly baseUrl: string) {}

    /**
     * 语言版本缓存（pistonLang → version）。
     *   null  : 尚未查询
     *   Map   : 已查询（空 Map 表示 Piston 中无已安装运行时）
     */
    private versionCache: Map<string, string> | null = null;

    /**
     * 根据 baseUrl 计算 Piston API 路径前缀。
     *   - 本地 Docker  : /api/v2
     *   - emkc.org     : /api/v2/piston  （官方公共 API 使用不同子路径）
     */
    private get apiBase(): string {
        return this.baseUrl.includes("emkc.org")
            ? `${this.baseUrl}/api/v2/piston`
            : `${this.baseUrl}/api/v2`;
    }

    /**
     * 查询 Piston 已安装的运行时列表并缓存结果（每个实例只查询一次）。
     * 返回语言对应版本，未安装返回 undefined，网络错误返回 null。
     */
    private async resolveVersion(pistonLang: string): Promise<string | undefined | null> {
        if (!this.versionCache) {
            const ac = new AbortController();
            const t  = setTimeout(() => ac.abort(), 10_000);
            try {
                const res = await fetch(`${this.apiBase}/runtimes`, { signal: ac.signal });
                clearTimeout(t);
                if (res.ok) {
                    const runtimes = await res.json() as Array<{ language: string; version: string; aliases?: string[] }>;
                    this.versionCache = new Map();
                    for (const r of runtimes) {
                        this.versionCache.set(r.language, r.version);
                        for (const alias of (r.aliases ?? [])) {
                            if (!this.versionCache.has(alias)) this.versionCache.set(alias, r.version);
                        }
                    }
                } else {
                    this.versionCache = new Map(); // 查询失败，视为空列表
                }
            } catch {
                clearTimeout(t);
                return null; // 网络错误（Piston 服务未运行）
            }
        }
        return this.versionCache.get(pistonLang); // undefined = 未安装
    }

    supportedLanguages(): string[] {
        return [...SUPPORTED_LANGUAGES];
    }

    async execute(code: string, language: string): Promise<ExecutionResult> {
        if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
            return { stdout: "", stderr: `不支持的语言: ${language}`, exitCode: 1, duration: 0 };
        }
        if (!code || code.trim().length === 0) {
            return { stdout: "", stderr: `代码为空，无法执行`, exitCode: 1, duration: 0 };
        }
        if (code.length > MAX_CODE_SIZE) {
            return { stdout: "", stderr: `代码超出大小限制 (最大 ${MAX_CODE_SIZE / 1024}KB)`, exitCode: 1, duration: 0 };
        }

        const { language: pistonLang, version } = PISTON_LANG_MAP[language as SupportedLanguage];
        const start = Date.now();

        // 解析具体版本（避免 "x-* runtime is unknown" 400 错误）
        let effectiveVersion = version;
        if (version === "*") {
            const resolved = await this.resolveVersion(pistonLang);
            if (resolved === null) {
                // 网络错误：Piston 服务不可达
                const isLocal = this.baseUrl.includes("localhost") || this.baseUrl.includes("127.0.0.1");
                const hint = isLocal
                    ? "\n\n提示：请先启动 Piston Docker 容器：\n  docker run --rm -dp 2000:2000 ghcr.io/engineer-man/piston"
                    : "";
                return { stdout: "", stderr: `无法连接到 Piston 服务: ${this.baseUrl}${hint}`, exitCode: 1, duration: 0 };
            }
            if (resolved === undefined) {
                // 运行时未安装
                const isLocal = this.baseUrl.includes("localhost") || this.baseUrl.includes("127.0.0.1");
                const installHint = isLocal
                    ? `\n\n请在 Piston 容器中安装 ${pistonLang} 运行时：\n  curl -sX POST ${this.baseUrl}/api/v2/packages \\\n    -H 'Content-Type: application/json' \\\n    -d '{"language":"${pistonLang}","version":"*"}'`
                    : "\n\n公共 Piston API (emkc.org) 自 2026-02-15 起需要授权 Token，请改用本地 Docker 实例。";
                return {
                    stdout: "",
                    stderr: `Piston 中未安装 ${language}（${pistonLang}）运行时${installHint}`,
                    exitCode: 1,
                    duration: 0,
                };
            }
            effectiveVersion = resolved;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PISTON_TIMEOUT);

        try {
            const res = await fetch(`${this.apiBase}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    language: pistonLang,
                    version: effectiveVersion,
                    files: [{ content: code }],
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const body = await res.text().catch(() => "");
                return {
                    stdout: "",
                    stderr: `Piston API 错误 (HTTP ${res.status}): ${body.slice(0, 200)}`,
                    exitCode: 1,
                    duration: Date.now() - start,
                };
            }

            const data = await res.json() as {
                run?:     { stdout: string; stderr: string; code: number | null; signal: string | null };
                compile?: { stdout: string; stderr: string; code: number | null };
                message?: string;
            };

            // Compilation failure (C++, Java, TypeScript)
            if (data.compile && data.compile.code !== 0 && data.compile.code !== null) {
                return {
                    stdout: data.compile.stdout ?? "",
                    stderr: `[编译错误]\n${data.compile.stderr ?? ""}`,
                    exitCode: data.compile.code ?? 1,
                    duration: Date.now() - start,
                };
            }

            const run = data.run;
            if (!run) {
                return {
                    stdout: "",
                    stderr: data.message ?? "Piston 返回了意外的响应格式",
                    exitCode: 1,
                    duration: Date.now() - start,
                };
            }

            return {
                stdout: run.stdout ?? "",
                stderr: run.stderr ?? "",
                exitCode: run.code ?? (run.signal ? 137 : 0),
                duration: Date.now() - start,
            };

        } catch (err: unknown) {
            const duration = Date.now() - start;
            if (err instanceof Error && err.name === "AbortError") {
                return { stdout: "", stderr: `Piston 请求超时 (${PISTON_TIMEOUT / 1000}s)`, exitCode: 1, duration };
            }
            const msg = err instanceof Error ? err.message : String(err);
            const isLocal = this.baseUrl.includes("localhost") || this.baseUrl.includes("127.0.0.1");
            const hint = isLocal
                ? "\n\n提示：请先启动 Piston Docker 容器：\n  docker run --rm -dp 2000:2000 ghcr.io/engineer-man/piston"
                : "";
            return { stdout: "", stderr: `无法连接到 Piston 服务: ${msg}${hint}`, exitCode: 1, duration };
        } finally {
            clearTimeout(timer);
        }
    }
}

// ─── LocalExecutor ────────────────────────────────────────────────────────────

/**
 * 在本机上通过子进程执行代码（无网络依赖）。
 * 需要对应的运行时/编译器已安装在系统中。
 */
export class LocalExecutor implements CodeExecutor {
    supportedLanguages(): string[] {
        return [...SUPPORTED_LANGUAGES];
    }

    async execute(code: string, language: string): Promise<ExecutionResult> {
        if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
            return { stdout: "", stderr: `不支持的语言: ${language}`, exitCode: 1, duration: 0 };
        }
        if (!code || code.trim().length === 0) {
            return { stdout: "", stderr: `代码为空，无法执行`, exitCode: 1, duration: 0 };
        }
        if (code.length > MAX_CODE_SIZE) {
            return { stdout: "", stderr: `代码超出大小限制 (最大 ${MAX_CODE_SIZE / 1024}KB)`, exitCode: 1, duration: 0 };
        }
        const tmpDir = await mkdtemp(join(tmpdir(), "ainote-exec-"));
        try {
            return await this.executeInDir(code, language as SupportedLanguage, tmpDir);
        } finally {
            await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        }
    }

    private async executeInDir(code: string, language: SupportedLanguage, dir: string): Promise<ExecutionResult> {
        switch (language) {
            case "javascript": {
                const file = join(dir, "main.js");
                await writeFile(file, code, "utf-8");
                return runProcess("node", [file], { cwd: dir, timeout: EXECUTION_TIMEOUT });
            }
            case "typescript": {
                const file = join(dir, "main.ts");
                await writeFile(file, code, "utf-8");
                return runProcess(getTsxBin(), [file], { cwd: dir, timeout: EXECUTION_TIMEOUT });
            }
            case "python": {
                const file = join(dir, "main.py");
                await writeFile(file, code, "utf-8");
                const cmd = process.platform === "win32" ? "python" : "python3";
                return runProcess(cmd, [file], { cwd: dir, timeout: EXECUTION_TIMEOUT });
            }
            case "cpp": {
                const srcFile = join(dir, "main.cpp");
                const outFile = join(dir, process.platform === "win32" ? "main.exe" : "main");
                await writeFile(srcFile, code, "utf-8");
                const gpp = findGPlusPlus();
                const compile = await runProcess(gpp, ["-o", outFile, srcFile, "-std=c++17"], { cwd: dir, timeout: EXECUTION_TIMEOUT });
                if (compile.exitCode !== 0) return { stdout: "", stderr: `[编译错误]\n${compile.stderr}`, exitCode: compile.exitCode, duration: compile.duration };
                const run = await runProcess(outFile, [], { cwd: dir, timeout: EXECUTION_TIMEOUT });
                return { ...run, duration: compile.duration + run.duration };
            }
            case "java": {
                const className = extractJavaClassName(code);
                const srcFile   = join(dir, `${className}.java`);
                await writeFile(srcFile, code, "utf-8");
                const javac = findJavaBin("javac");
                const java  = findJavaBin("java");
                const compile = await runProcess(javac, [srcFile], { cwd: dir, timeout: EXECUTION_TIMEOUT });
                if (compile.exitCode !== 0) return { stdout: "", stderr: `[编译错误]\n${compile.stderr}`, exitCode: compile.exitCode, duration: compile.duration };
                const run = await runProcess(java, ["-cp", dir, className], { cwd: dir, timeout: EXECUTION_TIMEOUT });
                return { ...run, duration: compile.duration + run.duration };
            }
        }
    }
}

// ─── SmartExecutor ────────────────────────────────────────────────────────────

/**
 * 根据运行环境自动路由代码执行的智能执行器。
 *
 * 路由策略：
 * ┌─────────────┬─────────────────────────────────┬─────────────────────────────┐
 * │  语言        │ 本地（配置 PISTON_API_URL）       │ Vercel（VERCEL=1 自动注入）   │
 * ├─────────────┼─────────────────────────────────┼─────────────────────────────┤
 * │ JavaScript  │ LocalExecutor (node)             │ LocalExecutor (node)         │
 * │ TypeScript  │ LocalExecutor (tsx)              │ PistonExecutor (emkc.org)    │
 * │ Python      │ PistonExecutor → LocalExecutor  │ PistonExecutor (emkc.org)    │
 * │ C++         │ PistonExecutor → LocalExecutor  │ PistonExecutor (emkc.org)    │
 * │ Java        │ PistonExecutor → LocalExecutor  │ PistonExecutor (emkc.org)    │
 * └─────────────┴─────────────────────────────────┴─────────────────────────────┘
 *
 * 环境变量：
 *   PISTON_API_URL — Piston 服务地址（本地 Docker 或自托管实例）。
 *                    若不设置：Vercel 上自动使用 https://emkc.org，
 *                              本地则使用 LocalExecutor 作为 fallback。
 *   VERCEL         — Vercel 自动注入，无需手动设置。
 */
export class SmartExecutor implements CodeExecutor {
    private readonly local:    LocalExecutor;
    private readonly piston:   PistonExecutor | null;
    private readonly isVercel: boolean;

    constructor() {
        this.isVercel = !!process.env.VERCEL;
        const pistonUrl =
            process.env.PISTON_API_URL ||
            (this.isVercel ? "https://emkc.org" : null);
        this.local  = new LocalExecutor();
        this.piston = pistonUrl ? new PistonExecutor(pistonUrl) : null;
    }

    supportedLanguages(): string[] {
        return [...SUPPORTED_LANGUAGES];
    }

    async execute(code: string, language: string): Promise<ExecutionResult> {
        if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
            return { stdout: "", stderr: `不支持的语言: ${language}`, exitCode: 1, duration: 0 };
        }

        switch (language as SupportedLanguage) {
            case "javascript":
                // Node.js 在 Next.js 和 Vercel 运行时中始终可用，无需 Piston。
                return this.local.execute(code, language);

            case "typescript":
                // Vercel 构建产物中排除了 tsx 包，必须走 Piston。
                // 本地开发时 tsx 已安装，直接用 LocalExecutor。
                if (this.isVercel) {
                    return this.piston
                        ? this.piston.execute(code, language)
                        : { stdout: "", stderr: "TypeScript 执行在此环境中不可用（未配置 Piston API）", exitCode: 1, duration: 0 };
                }
                return this.local.execute(code, language);

            case "python":
            case "cpp":
            case "java":
                // 优先走 Piston（本地 Docker 或 Vercel 公开 API）。
                // 未配置 Piston 时，退回本地工具链（需用户自行安装编译器）。
                return this.piston
                    ? this.piston.execute(code, language)
                    : this.local.execute(code, language);
        }
    }
}
