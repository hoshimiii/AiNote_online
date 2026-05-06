export type FormalCommandKind =
  | "create_workspace"
  | "rename_workspace"
  | "delete_workspace"
  | "create_mission"
  | "rename_mission"
  | "delete_mission"
  | "create_board"
  | "rename_board"
  | "delete_board"
  | "create_task"
  | "rename_task"
  | "delete_task"
  | "create_subtask"
  | "rename_subtask"
  | "delete_subtask"
  | "create_note"
  | "rename_note"
  | "delete_note"
  | "link_task_note"
  | "link_block"
  | "rewrite_note";

export type FormalToolContract = {
  name: string;
  category: "atomic" | "macro";
  description: string;
  commandKind: FormalCommandKind;
  verificationMode: "command-result" | "snapshot-query";
};

export const FORMAL_TOOL_CONTRACTS: FormalToolContract[] = [
  { name: "create_workspace", category: "atomic", description: "创建工作区", commandKind: "create_workspace", verificationMode: "command-result" },
  { name: "rename_workspace", category: "atomic", description: "重命名工作区", commandKind: "rename_workspace", verificationMode: "command-result" },
  { name: "delete_workspace", category: "atomic", description: "删除工作区", commandKind: "delete_workspace", verificationMode: "snapshot-query" },
  { name: "create_mission", category: "atomic", description: "创建任务区", commandKind: "create_mission", verificationMode: "command-result" },
  { name: "rename_mission", category: "atomic", description: "重命名任务区", commandKind: "rename_mission", verificationMode: "command-result" },
  { name: "delete_mission", category: "atomic", description: "删除任务区", commandKind: "delete_mission", verificationMode: "snapshot-query" },
  { name: "create_board", category: "atomic", description: "创建看板", commandKind: "create_board", verificationMode: "command-result" },
  { name: "rename_board", category: "atomic", description: "重命名看板", commandKind: "rename_board", verificationMode: "command-result" },
  { name: "delete_board", category: "atomic", description: "删除看板", commandKind: "delete_board", verificationMode: "snapshot-query" },
  { name: "create_task", category: "atomic", description: "创建任务", commandKind: "create_task", verificationMode: "command-result" },
  { name: "rename_task", category: "atomic", description: "重命名任务", commandKind: "rename_task", verificationMode: "command-result" },
  { name: "delete_task", category: "atomic", description: "删除任务", commandKind: "delete_task", verificationMode: "snapshot-query" },
  { name: "create_subtask", category: "atomic", description: "创建子任务", commandKind: "create_subtask", verificationMode: "command-result" },
  { name: "rename_subtask", category: "atomic", description: "重命名子任务", commandKind: "rename_subtask", verificationMode: "command-result" },
  { name: "delete_subtask", category: "atomic", description: "删除子任务", commandKind: "delete_subtask", verificationMode: "snapshot-query" },
  { name: "create_note", category: "atomic", description: "创建笔记", commandKind: "create_note", verificationMode: "command-result" },
  { name: "rename_note", category: "atomic", description: "重命名笔记", commandKind: "rename_note", verificationMode: "command-result" },
  { name: "delete_note", category: "atomic", description: "删除笔记", commandKind: "delete_note", verificationMode: "snapshot-query" },
  { name: "link_subtask", category: "atomic", description: "将子任务与笔记/块建立链接", commandKind: "link_task_note", verificationMode: "command-result" },
  { name: "link_block", category: "atomic", description: "将块与任务/子任务建立链接", commandKind: "link_block", verificationMode: "command-result" },
  { name: "organize_content", category: "macro", description: "将自由内容整理为结构化笔记并落到正式边界", commandKind: "rewrite_note", verificationMode: "command-result" },
  { name: "insert_and_link_content", category: "macro", description: "插入内容并同时建立任务/块链接", commandKind: "link_block", verificationMode: "command-result" },
  { name: "suggest_note_title", category: "macro", description: "基于内容建议或更新笔记标题", commandKind: "rename_note", verificationMode: "command-result" },
  { name: "rewrite_note", category: "macro", description: "整篇重写笔记内容", commandKind: "rewrite_note", verificationMode: "command-result" },
];

export const FORMAL_TOOL_CONTRACT_MAP = Object.fromEntries(
  FORMAL_TOOL_CONTRACTS.map((contract) => [contract.name, contract]),
) as Record<string, FormalToolContract>;
