import { prisma } from '@/lib/prisma';
import { MoeVoteJob } from '@prisma/client';

export interface CreateMoeVoteJobParams {
  roundTableId: string;
  question: string;
  includeDiscussionAgentsInVoting: boolean;
  agentCount: number;
}

export async function createMoeVoteJob(
  params: CreateMoeVoteJobParams
): Promise<MoeVoteJob> {
  return await prisma.moeVoteJob.create({
    data: {
      status: 'pending',
      question: params.question,
      includeDiscussionAgentsInVoting: params.includeDiscussionAgentsInVoting,
      agentCount: params.agentCount,
      roundTableId: params.roundTableId,
    },
  });
}

export async function getMoeVoteJob(id: string): Promise<MoeVoteJob | null> {
  return await prisma.moeVoteJob.findUnique({
    where: { id },
    include: { roundTable: true },
  });
}

export async function updateMoeVoteJobStatus(
  id: string,
  status: string
): Promise<MoeVoteJob> {
  return await prisma.moeVoteJob.update({
    where: { id },
    data: {
      status,
      ...(status === 'running' && { startedAt: new Date() }),
    },
  });
}

export async function updateMoeVoteJobProgress(
  id: string,
  currentRound: number,
  currentPhase: string
): Promise<MoeVoteJob> {
  return await prisma.moeVoteJob.update({
    where: { id },
    data: { currentRound, currentPhase },
  });
}

export async function completeMoeVoteJob(
  id: string,
  result: any
): Promise<MoeVoteJob> {
  return await prisma.moeVoteJob.update({
    where: { id },
    data: {
      status: 'completed',
      result: JSON.stringify(result),
      completedAt: new Date(),
    },
  });
}

export async function failMoeVoteJob(
  id: string,
  error: string
): Promise<MoeVoteJob> {
  return await prisma.moeVoteJob.update({
    where: { id },
    data: {
      status: 'failed',
      error,
      completedAt: new Date(),
    },
  });
}

export async function deleteMoeVoteJob(id: string): Promise<void> {
  await prisma.moeVoteJob.delete({
    where: { id },
  });
}
