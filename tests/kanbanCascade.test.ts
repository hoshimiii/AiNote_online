import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cascadeDeleteMissionState,
  cascadeDeleteWorkspaceState,
} from '../src/store/kanban/cascade'
import { sanitizeSyncSnapshotPayload } from '../src/lib/syncSnapshotIntegrity'

const baseState = {
  workspaces: [{ workspaceId: 'ws-1', workspaceName: '工作区 1' }],
  activeWorkSpaceId: 'ws-1',
  activeMissionId: 'mission-1',
  currentMissionId: 'mission-1',
  currentNoteId: 'note-1',
  previewMissionId: 'mission-1',
  missionOrder: { 'ws-1': ['mission-1'] },
  boardOrder: { 'mission-1': ['board-1'] },
  missions: {
    'mission-1': {
      MissionId: 'mission-1',
      WorkSpaceId: 'ws-1',
      activeNoteId: 'note-1',
      title: '任务区 1',
      Notes: [{
        noteId: 'note-1',
        noteTitle: '笔记 1',
        noteContent: '',
        noteCreatedAt: '',
        noteUpdatedAt: '',
        relatedTaskId: 'task-1',
        blocks: [{
          blockId: 'block-1',
          blockType: 'markdown',
          blockContent: 'hello',
          blockCreatedAt: '',
          blockUpdatedAt: '',
          linkedBoardId: 'board-1',
          linkedTaskId: 'task-1',
          linkedSubTaskId: 'sub-1',
        }],
      }],
    },
  },
  boards: {
    'board-1': {
      BoardId: 'board-1',
      MissionId: 'mission-1',
      title: '看板 1',
      Tasks: [{
        TaskId: 'task-1',
        title: '任务 1',
        linkedNoteIds: 'note-1',
        subTasks: [{ subTaskId: 'sub-1', title: '子任务 1', completed: false, linkedNoteId: 'note-1', linkedBlockId: 'block-1' }],
      }],
    },
  },
  tasks: {
    'task-1': {
      TaskId: 'task-1',
      title: '任务 1',
      linkedNoteIds: 'note-1',
      subTasks: [{ subTaskId: 'sub-1', title: '子任务 1', completed: false, linkedNoteId: 'note-1', linkedBlockId: 'block-1' }],
    },
  },
}

test('cascadeDeleteMissionState removes descendant boards, tasks and notes', () => {
  const next = cascadeDeleteMissionState(baseState, 'mission-1')
  assert.deepEqual(next.missions, {})
  assert.deepEqual(next.boards, {})
  assert.deepEqual(next.tasks, {})
  assert.equal(next.currentMissionId, null)
  assert.equal(next.currentNoteId, null)
  assert.deepEqual(next.missionOrder, { 'ws-1': [] })
  assert.deepEqual(next.boardOrder, {})
})

test('cascadeDeleteWorkspaceState keeps next sync payload clean', () => {
  const next = cascadeDeleteWorkspaceState(baseState, 'ws-1')
  const snapshot = sanitizeSyncSnapshotPayload({
    ...next,
    workspaces: next.workspaces ?? [],
    missions: next.missions ?? {},
    boards: next.boards ?? {},
    tasks: next.tasks ?? {},
    missionOrder: next.missionOrder ?? {},
    boardOrder: next.boardOrder ?? {},
    _chatbot: { chatbotId: 'bot-1' },
  })

  assert.equal(snapshot.ok, true)
  assert.equal(snapshot.repairSummary.status, 'clean')
  assert.deepEqual(snapshot.snapshot?.workspaces, [])
  assert.deepEqual(snapshot.snapshot?._chatbot, { chatbotId: 'bot-1' })
})