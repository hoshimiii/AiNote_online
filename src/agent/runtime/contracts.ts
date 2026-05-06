export type SupportedAgentIntent =
  | "organize_content"
  | "insert_and_link"
  | "create_structure"
  | "rename_title"
  | "rewrite_note"
  | "delete_structure"
  | "unknown";

export type AgentConstraintMap = {
  requiresVerification: boolean;
  allowInference: boolean;
  askBeforeDelete: boolean;
};

export type ResolvedAgentIntent = {
  intent: SupportedAgentIntent;
  targets: {
    workspaceName?: string;
    missionTitle?: string;
    boardTitle?: string;
    taskTitle?: string;
    noteTitle?: string;
  };
  contentPayload?: string;
  missingInformation: string[];
  constraints: AgentConstraintMap;
};

export type AgentPlanStep = {
  kind: "atomic" | "macro";
  toolName: string;
  purpose: string;
};

export type AgentExecutionPlan = {
  intent: SupportedAgentIntent;
  summary: string;
  steps: AgentPlanStep[];
};

export type FormalVerificationReport = {
  verified: boolean;
  source: "command-result" | "snapshot-query";
  details: string[];
};
