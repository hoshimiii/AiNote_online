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

export const EXECUTION_UNAVAILABLE = "代码执行暂不可用：尚未配置隔离执行环境。代码仍可编辑和保存。";

// Remote callers must never run code with the web server's OS authority.
export class LocalExecutor implements CodeExecutor {
    supportedLanguages(): string[] { return []; }

    execute: CodeExecutor["execute"] = async () => ({ stdout: "", stderr: EXECUTION_UNAVAILABLE, exitCode: 1, duration: 0 });
}
