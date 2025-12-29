import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createRoundTable } from '../roundtable';
import {
  createMoeVoteJob,
  getMoeVoteJob,
  updateMoeVoteJobStatus,
  updateMoeVoteJobProgress,
  completeMoeVoteJob,
  failMoeVoteJob,
  deleteMoeVoteJob,
} from '../moe-vote-jobs';

describe('MoeVoteJob Database Operations', () => {
  let roundTableId: string;

  beforeAll(async () => {
    const rt = await createRoundTable('Test question?', 3);
    roundTableId = rt.id;
  });

  test('createMoeVoteJob creates job in pending status', async () => {
    const job = await createMoeVoteJob({
      roundTableId,
      question: 'Test question?',
      includeDiscussionAgentsInVoting: false,
      agentCount: 3,
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe('pending');
    expect(job.question).toBe('Test question?');
    expect(job.roundTableId).toBe(roundTableId);
    expect(job.includeDiscussionAgentsInVoting).toBe(false);
    expect(job.agentCount).toBe(3);
  });

  test('getMoeVoteJob retrieves job by id', async () => {
    const rt2 = await createRoundTable('Test question 2?', 5);
    const created = await createMoeVoteJob({
      roundTableId: rt2.id,
      question: 'Test question 2?',
      includeDiscussionAgentsInVoting: true,
      agentCount: 5,
    });

    const retrieved = await getMoeVoteJob(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.question).toBe('Test question 2?');
  });

  test('getMoeVoteJob returns null for non-existent id', async () => {
    const retrieved = await getMoeVoteJob('non-existent-id');
    expect(retrieved).toBeNull();
  });

  test('updateMoeVoteJobStatus updates status and startedAt', async () => {
    const rt3 = await createRoundTable('Test question 3?', 3);
    const job = await createMoeVoteJob({
      roundTableId: rt3.id,
      question: 'Test question 3?',
      includeDiscussionAgentsInVoting: false,
      agentCount: 3,
    });

    await updateMoeVoteJobStatus(job.id, 'running');
    const updated = await getMoeVoteJob(job.id);

    expect(updated?.status).toBe('running');
    expect(updated?.startedAt).toBeDefined();
  });

  test('updateMoeVoteJobProgress updates round and phase', async () => {
    const rt4 = await createRoundTable('Test question 4?', 3);
    const job = await createMoeVoteJob({
      roundTableId: rt4.id,
      question: 'Test question 4?',
      includeDiscussionAgentsInVoting: false,
      agentCount: 3,
    });

    await updateMoeVoteJobProgress(job.id, 5, 'discussion');
    const updated = await getMoeVoteJob(job.id);

    expect(updated?.currentRound).toBe(5);
    expect(updated?.currentPhase).toBe('discussion');
  });

  test('completeMoeVoteJob saves result and sets completed status', async () => {
    const rt5 = await createRoundTable('Test question 5?', 3);
    const job = await createMoeVoteJob({
      roundTableId: rt5.id,
      question: 'Test question 5?',
      includeDiscussionAgentsInVoting: false,
      agentCount: 3,
    });

    const result = {
      winner: { agentId: 'a1', agentName: 'Test Agent', averageScore: 8.5 },
      scores: {},
      discussionSummary: { roundCount: 10, totalMessages: 30, toolCallsUsed: 5 },
    };

    await completeMoeVoteJob(job.id, result);
    const updated = await getMoeVoteJob(job.id);

    expect(updated?.status).toBe('completed');
    expect(updated?.result).toBeDefined();
    expect(updated?.completedAt).toBeDefined();
    expect(JSON.parse(updated!.result!)).toEqual(result);
  });

  test('failMoeVoteJob saves error and sets failed status', async () => {
    const rt6 = await createRoundTable('Test question 6?', 3);
    const job = await createMoeVoteJob({
      roundTableId: rt6.id,
      question: 'Test question 6?',
      includeDiscussionAgentsInVoting: false,
      agentCount: 3,
    });

    await failMoeVoteJob(job.id, 'Test error message');
    const updated = await getMoeVoteJob(job.id);

    expect(updated?.status).toBe('failed');
    expect(updated?.error).toBe('Test error message');
    expect(updated?.completedAt).toBeDefined();
  });

  test('deleteMoeVoteJob removes job and cascades to round table', async () => {
    const rt = await createRoundTable('Delete test question?', 3);
    const job = await createMoeVoteJob({
      roundTableId: rt.id,
      question: 'Delete test question?',
      includeDiscussionAgentsInVoting: false,
      agentCount: 3,
    });

    await deleteMoeVoteJob(job.id);

    const retrieved = await getMoeVoteJob(job.id);
    expect(retrieved).toBeNull();
  });
});
