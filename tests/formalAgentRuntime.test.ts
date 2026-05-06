import test from "node:test";
import assert from "node:assert/strict";
import {
  createExecutionPlan,
  resolveAgentIntent,
  verifyFormalExecution,
} from "../src/agent/runtime";
import { executeFormalKanbanCommand } from "../src/lib/formalKanbanCommands";

const baseSnapshot = {
  workspaces: [{ workspaceId: "ws-1", workspaceName: "工作区" }],
  missions: {
    "mission-1": {
      MissionId: "mission-1",
      WorkSpaceId: "ws-1",
      activeNoteId: null,
      title: "任务区",
      Notes: [{
        noteId: "note-1",
        noteTitle: "旧笔记",
        noteContent: "",
        noteCreatedAt: "",
        noteUpdatedAt: "",
        relatedTaskId: "task-1",
        blocks: [{
          blockId: "block-1",
          blockType: "markdown",
          blockContent: "旧内容",
          blockCreatedAt: "",
          blockUpdatedAt: "",
        }],
      }],
    },
  },
  boards: {
    "board-1": {
      BoardId: "board-1",
      MissionId: "mission-1",
      title: "看板",
      Tasks: [{
        TaskId: "task-1",
        title: "任务",
        linkedNoteIds: undefined,
        subTasks: [],
      }],
    },
  },
  tasks: {
    "task-1": {
      TaskId: "task-1",
      title: "任务",
      linkedNoteIds: undefined,
      subTasks: [],
    },
  },
  missionOrder: { "ws-1": ["mission-1"] },
  boardOrder: { "mission-1": ["board-1"] },
  activeWorkSpaceId: "ws-1",
  currentMissionId: "mission-1",
  currentNoteId: "note-1",
  _cloudSyncTime: null,
} as const;

test("resolveAgentIntent classifies rewrite requests and emits a plan", () => {
  const resolved = resolveAgentIntent('请把笔记 "旧笔记" 重写为新的提纲');
  const plan = createExecutionPlan(resolved);

  assert.equal(resolved.intent, "rewrite_note");
  assert.equal(resolved.targets.noteTitle, "旧笔记");
  assert.equal(plan.steps[0]?.toolName, "find_note");
  assert.equal(plan.steps[1]?.toolName, "rewrite_note");
});

test("executeFormalKanbanCommand rewrites notes through the formal boundary", () => {
  const result = executeFormalKanbanCommand(baseSnapshot, {
    kind: "rewrite_note",
    missionId: "mission-1",
    noteId: "note-1",
    blocks: [{
      blockId: "block-2",
      blockType: "markdown",
      blockContent: "新内容",
      blockCreatedAt: "now",
      blockUpdatedAt: "now",
    }],
  });

  assert.equal(result.success, true);
  assert.equal(result.verification.verified, true);
  assert.equal(result.snapshot?.missions["mission-1"].Notes[0].blocks[0].blockContent, "新内容");
  const verification = verifyFormalExecution(result);
  assert.equal(verification.verified, true);
});

test("executeFormalKanbanCommand deletes tasks and removes dangling links", () => {
  const linkedSnapshot = executeFormalKanbanCommand(baseSnapshot, {
    kind: "link_block",
    missionId: "mission-1",
    noteId: "note-1",
    blockId: "block-1",
    boardId: "board-1",
    taskId: "task-1",
  }).snapshot;

  const deleted = executeFormalKanbanCommand(linkedSnapshot, {
    kind: "delete_task",
    boardId: "board-1",
    taskId: "task-1",
  });

  assert.equal(deleted.success, true);
  assert.equal(deleted.snapshot?.tasks["task-1"], undefined);
  assert.equal(deleted.snapshot?.boards["board-1"].Tasks.length, 0);
  assert.equal(deleted.snapshot?.missions["mission-1"].Notes[0].blocks[0].linkedTaskId, undefined);
});
