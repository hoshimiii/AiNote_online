import type {
  AgentExecutionPlan,
  FormalVerificationReport,
  ResolvedAgentIntent,
  SupportedAgentIntent,
} from "./contracts";

const extractQuotedValue = (input: string) => {
  const match = input.match(/[“\"]([^“\"]+)[”\"]/);
  return match?.[1]?.trim();
};

const normalize = (value: string) => value.trim().toLowerCase();

export function resolveAgentIntent(input: string): ResolvedAgentIntent {
  const text = input.trim();
  const normalized = normalize(text);
  const quoted = extractQuotedValue(text);

  let intent: SupportedAgentIntent = "unknown";
  if (/整理|归纳|错题|组织/.test(text)) intent = "organize_content";
  if (/插入|链接|关联/.test(text)) intent = "insert_and_link";
  if (/新建|创建|添加/.test(text)) intent = "create_structure";
  if (/重命名|改名|标题/.test(text)) intent = "rename_title";
  if (/重写|改写/.test(text) && /笔记|note/.test(normalized)) intent = "rewrite_note";
  if (/删除|移除/.test(text)) intent = "delete_structure";

  const missingInformation: string[] = [];
  if (["rename_title", "rewrite_note", "delete_structure", "insert_and_link"].includes(intent) && !quoted) {
    missingInformation.push("缺少可唯一定位的目标名称");
  }

  return {
    intent,
    targets: {
      missionTitle: /任务区|mission/.test(normalized) ? quoted : undefined,
      boardTitle: /看板|board/.test(normalized) ? quoted : undefined,
      taskTitle: /任务|task/.test(normalized) ? quoted : undefined,
      noteTitle: /笔记|note/.test(normalized) ? quoted : undefined,
    },
    contentPayload: intent === "rewrite_note" || intent === "organize_content" ? text : undefined,
    missingInformation,
    constraints: {
      requiresVerification: intent !== "unknown",
      allowInference: !/删除/.test(text),
      askBeforeDelete: /删除/.test(text),
    },
  };
}

export function createExecutionPlan(resolved: ResolvedAgentIntent): AgentExecutionPlan {
  switch (resolved.intent) {
    case "rewrite_note":
      return {
        intent: resolved.intent,
        summary: "先定位目标笔记，再执行正式重写命令并校验结果。",
        steps: [
          { kind: "atomic", toolName: "find_note", purpose: "定位唯一笔记" },
          { kind: "macro", toolName: "rewrite_note", purpose: "重写整篇笔记并返回验证结果" },
        ],
      };
    case "insert_and_link":
      return {
        intent: resolved.intent,
        summary: "先定位目标，再执行插入/关联类正式写入，并基于返回结果验证。",
        steps: [
          { kind: "atomic", toolName: "find_note", purpose: "定位笔记" },
          { kind: "atomic", toolName: "find_task", purpose: "定位任务" },
          { kind: "atomic", toolName: "link_block", purpose: "写入链接关系" },
        ],
      };
    case "create_structure":
      return {
        intent: resolved.intent,
        summary: "优先用原子创建工具完成结构创建，并校验创建结果。",
        steps: [
          { kind: "atomic", toolName: "create_mission", purpose: "创建正式结构" },
        ],
      };
    case "rename_title":
      return {
        intent: resolved.intent,
        summary: "先定位唯一目标，再执行正式重命名。",
        steps: [
          { kind: "atomic", toolName: "find_note", purpose: "定位重命名目标" },
          { kind: "atomic", toolName: "rename_note", purpose: "执行正式重命名" },
        ],
      };
    case "delete_structure":
      return {
        intent: resolved.intent,
        summary: "删除类操作必须先确认目标，再执行正式删除并验证已移除。",
        steps: [
          { kind: "atomic", toolName: "find_task", purpose: "定位待删除目标" },
          { kind: "atomic", toolName: "delete_task", purpose: "执行正式删除" },
        ],
      };
    case "organize_content":
      return {
        intent: resolved.intent,
        summary: "优先尝试宏工具组织内容，必要时再回退到原子工具链。",
        steps: [
          { kind: "macro", toolName: "rewrite_note", purpose: "用结构化内容重写目标笔记" },
        ],
      };
    default:
      return {
        intent: "unknown",
        summary: "当前请求未命中结构化知识工作意图，将继续走通用 Agent 流程。",
        steps: [],
      };
  }
}

export function verifyFormalExecution(result: unknown): FormalVerificationReport {
  if (!result || typeof result !== "object") {
    return {
      verified: false,
      source: "command-result",
      details: ["结果不是可验证对象"],
    };
  }

  const candidate = result as {
    success?: boolean;
    verification?: { verified?: boolean; details?: string[] };
    error?: string;
  };

  if (candidate.success === false) {
    return {
      verified: false,
      source: "command-result",
      details: [candidate.error ?? "正式命令执行失败"],
    };
  }

  if (candidate.verification?.verified) {
    return {
      verified: true,
      source: "command-result",
      details: candidate.verification.details ?? ["命令返回已验证"],
    };
  }

  return {
    verified: candidate.success === true,
    source: "command-result",
    details: candidate.success === true ? ["命令成功，但未返回额外验证细节"] : ["命令未提供 success 标志"],
  };
}
