import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatRepairSummary,
  sanitizeStoredSyncSnapshot,
  sanitizeSyncSnapshotPayload,
  type SyncSnapshotPayload,
} from '../src/lib/syncSnapshotIntegrity'

test('sanitizeSyncSnapshotPayload removes orphan relations and keeps chatbot payload', () => {
  const payload: SyncSnapshotPayload = {
    workspaces: [{ workspaceId: 'ws-1', workspaceName: '工作区 1' }],
    missions: {
      'mission-ok': {
        MissionId: 'mission-ok',
        WorkSpaceId: 'ws-1',
        title: '正常任务区',
        Notes: [{
          noteId: 'note-1',
          noteTitle: '笔记 1',
          blocks: [{ blockId: 'block-1', blockType: 'markdown', blockContent: 'hello', linkedBoardId: 'board-bad' }],
        }],
      },
      'mission-bad': {
        MissionId: 'mission-bad',
        WorkSpaceId: 'missing-ws',
        title: '孤儿任务区',
        Notes: [],
      },
    },
    boards: {
      'board-ok': {
        BoardId: 'board-ok',
        MissionId: 'mission-ok',
        title: '正常看板',
        Tasks: [{
          TaskId: 'task-1',
          title: '任务 1',
          linkedNoteIds: 'missing-note',
          subTasks: [],
        }],
      },
      'board-bad': {
        BoardId: 'board-bad',
        MissionId: 'missing-mission',
        title: '孤儿看板',
        Tasks: [],
      },
    },
    tasks: {},
    missionOrder: { 'ws-1': ['mission-bad', 'mission-ok'] },
    boardOrder: { 'mission-ok': ['board-bad', 'board-ok'] },
    _chatbot: { chatbotId: 'bot-1', messages: [] },
  }

  const result = sanitizeSyncSnapshotPayload(payload)
  assert.equal(result.ok, true)
  assert.equal(result.repairSummary.status, 'safe_repair')
  assert.equal(result.repairSummary.droppedEntityCounts.missions, 1)
  assert.equal(result.repairSummary.droppedEntityCounts.boards, 1)
  assert.ok(result.snapshot)
  assert.deepEqual(Object.keys(result.snapshot!.missions), ['mission-ok'])
  assert.deepEqual(Object.keys(result.snapshot!.boards), ['board-ok'])
  assert.deepEqual(result.snapshot!.missionOrder['ws-1'], ['mission-ok'])
  assert.deepEqual(result.snapshot!._chatbot, { chatbotId: 'bot-1', messages: [] })
  assert.equal(result.snapshot!.missions['mission-ok'].Notes[0].blocks[0].linkedBoardId, undefined)
  assert.equal(result.snapshot!.boards['board-ok'].Tasks[0].linkedNoteIds, undefined)
  assert.match(formatRepairSummary(result.repairSummary) ?? '', /自动修复/)
})

test('sanitizeSyncSnapshotPayload rejects ambiguous parent ownership', () => {
  const result = sanitizeSyncSnapshotPayload({
    workspaces: [
      { workspaceId: 'ws-1', workspaceName: '工作区 1' },
      { workspaceId: 'ws-2', workspaceName: '工作区 2' },
    ],
    missions: {
      'mission-1': {
        MissionId: 'mission-1',
        title: '任务区 1',
        Notes: [],
      },
    },
    boards: {},
    tasks: {},
    missionOrder: {},
    boardOrder: {},
  })

  assert.equal(result.ok, false)
  assert.equal(result.repairSummary.status, 'rejected')
  assert.match(result.repairSummary.issues.join('；'), /缺少 WorkSpaceId/)
})

test('sanitizeStoredSyncSnapshot reuses the same integrity rules', () => {
  const result = sanitizeStoredSyncSnapshot({
    workspaces: [{ workspaceId: 'ws-1', workspaceName: '工作区 1' }],
    missions: {},
    boards: {
      'board-1': {
        BoardId: 'board-1',
        title: '看板 1',
        Tasks: [],
      },
    },
    tasks: {},
    missionOrder: {},
    boardOrder: {},
  })

  assert.equal(result.ok, false)
  assert.equal(result.repairSummary.status, 'rejected')
  assert.match(result.repairSummary.issues.join('；'), /缺少 MissionId/)
})