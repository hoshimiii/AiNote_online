import { execFile, spawn } from "child_process";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

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

const MAX_CODE_SIZE = 64 * 1024; // 64KB
const EXECUTION_TIMEOUT = 10_000; // 10s
const MAX_OUTPUT_SIZE = 256 * 1024; // 256KB

function truncateOutput(output: string, max = MAX_OUTPUT_SIZE): string {
    if (output.length <= max) return output;
    return output.slice(0, max) + "\n... [output truncated]";
}

function runProcess(
    cmd: string,
    args: string[],
    options: { cwd: string; timeout: number }
): Promise<ExecutionResult> {
    return new Promise((resolve) => {
        const start = Date.now();
        let stdout = "";
        let stderr = "";
        let killed = false;

        const proc = spawn(cmd, args, {
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
            if (signal === "SIGTERM" && !killed) {
                stderr += "\n[执行超时，已终止]";
            }
            resolve({
                stdout: truncateOutput(stdout),
                stderr: truncateOutput(stderr),
                exitCode: code ?? (signal ? 137 : 1),
                duration,
            });
        });

        proc.on("error", (err) => {
            resolve({
                stdout: "",
                stderr: err.message,
                exitCode: 1,
                duration: Date.now() - start,
            });
        });
    });
}

function extractJavaClassName(code: string): string {
    const match = code.match(/public\s+class\s+(\w+)/);
    return match?.[1] ?? "Main";
}

export class LocalExecutor implements CodeExecutor {
    supportedLanguages(): string[] {
        return [...SUPPORTED_LANGUAGES];
    }

    async execute(code: string, language: string): Promise<ExecutionResult> {
        if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
            return { stdout: "", stderr: `不支持的语言: ${language}`, exitCode: 1, duration: 0 };
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

    private async executeInDir(
        code: string,
        language: SupportedLanguage,
        dir: string,
        options?: { entry?: string; args?: any[] }
    ): Promise<ExecutionResult> {
        const entry = options?.entry;
        const args = options?.args ?? [];

        const sanitizeName = (n?: string) => {
            if (!n) return undefined;
            const m = /^[_A-Za-z$][_A-Za-z0-9$]*$/.exec(n);
            return m ? n : undefined;
        };
        const safeEntry = sanitizeName(entry);

        const wrapForEntry = (lang: SupportedLanguage, src: string) => {
            if (!safeEntry) return src;
            if (lang === "javascript" || lang === "typescript") {
                const argsJson = JSON.stringify(args ?? []);
                return `${src}\n;(async () => {\n  try {\n    const __ainote_args = ${argsJson};\n    let fn;\n    try { fn = eval("${safeEntry}"); } catch (e) { fn = undefined; }\n    if (typeof fn === 'function') {\n      const res = await fn(...__ainote_args);\n      console.log(JSON.stringify({__AINOTE_RESULT__: res}));\n    } else {\n      console.log(JSON.stringify({__AINOTE_RESULT__: null}));\n    }\n  } catch (e) {\n    console.error(e);\n    process.exit(1);\n  }\n})();\n`;
            }
            if (lang === "python") {
                const argsJson = JSON.stringify(args ?? []);
                const safe = argsJson.replace(/'/g, "\\'");
                return `${src}\nimport sys, json, traceback\ntry:\n    __ainote_args = json.loads('${safe}')\nexcept:\n    __ainote_args = []\ntry:\n    fn = globals().get('${safeEntry}')\n    if callable(fn):\n        res = fn(*__ainote_args)\n        print(json.dumps({"__AINOTE_RESULT__": res}, ensure_ascii=False))\n    else:\n        print(json.dumps({"__AINOTE_RESULT__": None}, ensure_ascii=False))\nexcept Exception:\n    traceback.print_exc()\n    sys.exit(1)\n`;
            }
            // For cpp/java we don't attempt to auto-wrap complex signatures; return original source
            return src;
        };
        switch (language) {
            case "javascript": {
                const file = join(dir, "main.js");
                await writeFile(file, code, "utf-8");
                return runProcess("node", [file], { cwd: dir, timeout: EXECUTION_TIMEOUT });
            }
            case "typescript": {
                const file = join(dir, "main.ts");
                await writeFile(file, code, "utf-8");
                // Prefer local installed binary to avoid relying on `npx` at runtime (Vercel/CI may not have it)
                const localBin = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
                if (existsSync(localBin)) {
                    // On Unix use `node <bin>` to avoid EINVAL when the bin isn't executable.
                    // On Windows, run via cmd.exe /c to execute the `.cmd` wrapper reliably.
                    if (process.platform === "win32") {
                        // Use cmd.exe so the .cmd wrapper runs in its intended shell
                        return runProcess("cmd.exe", ["/c", localBin, file], { cwd: dir, timeout: EXECUTION_TIMEOUT });
                    }
                    return runProcess(process.execPath, [localBin, file], { cwd: dir, timeout: EXECUTION_TIMEOUT });
                }
                // Fallback to npx if local binary not found
                return runProcess("npx", ["tsx", file], { cwd: dir, timeout: EXECUTION_TIMEOUT });
            }
            case "python": {
                const file = join(dir, "main.py");
                await writeFile(file, code, "utf-8");
                // Try python3 first, fall back to python
                const pythonCmd = process.platform === "win32" ? "python" : "python3";
                return runProcess(pythonCmd, [file], { cwd: dir, timeout: EXECUTION_TIMEOUT });
            }
            case "cpp": {
                const srcFile = join(dir, "main.cpp");
                const outFile = join(dir, process.platform === "win32" ? "main.exe" : "main");
                await writeFile(srcFile, code, "utf-8");
                // Compile
                const compileResult = await runProcess(
                    "g++",
                    ["-o", outFile, srcFile, "-std=c++17"],
                    { cwd: dir, timeout: EXECUTION_TIMEOUT }
                );
                if (compileResult.exitCode !== 0) {
                    return {
                        stdout: "",
                        stderr: `[编译错误]\n${compileResult.stderr}`,
                        exitCode: compileResult.exitCode,
                        duration: compileResult.duration,
                    };
                }
                // Run
                const runResult = await runProcess(outFile, [], { cwd: dir, timeout: EXECUTION_TIMEOUT });
                return {
                    ...runResult,
                    duration: compileResult.duration + runResult.duration,
                };
            }
            case "java": {
                const className = extractJavaClassName(code);
                const srcFile = join(dir, `${className}.java`);
                await writeFile(srcFile, code, "utf-8");
                // Compile
                const compileResult = await runProcess(
                    "javac",
                    [srcFile],
                    { cwd: dir, timeout: EXECUTION_TIMEOUT }
                );
                if (compileResult.exitCode !== 0) {
                    return {
                        stdout: "",
                        stderr: `[编译错误]\n${compileResult.stderr}`,
                        exitCode: compileResult.exitCode,
                        duration: compileResult.duration,
                    };
                }
                // Run
                const runResult = await runProcess(
                    "java",
                    ["-cp", dir, className],
                    { cwd: dir, timeout: EXECUTION_TIMEOUT }
                );
                return {
                    ...runResult,
                    duration: compileResult.duration + runResult.duration,
                };
            }
        }
    }
}
