import { prisma } from '../prisma';

export type SceneExecutionJobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type SceneExecutionJobPhase =
  | 'queued'
  | 'creating_scene'
  | 'director'
  | 'rounds'
  | 'synthesizing'
  | 'reviewing'
  | 'repairing'
  | 'completed';

export interface CreateSceneExecutionJobInput {
  movieId: string;
  sceneOutlineId?: string | null;
  outlineIndex: number;
}

export async function createSceneExecutionJob(input: CreateSceneExecutionJobInput) {
  return prisma.sceneExecutionJob.create({
    data: {
      movieId: input.movieId,
      sceneOutlineId: input.sceneOutlineId ?? null,
      outlineIndex: input.outlineIndex,
      status: 'pending',
      currentPhase: 'queued',
    },
  });
}

export async function getSceneExecutionJob(id: string) {
  return prisma.sceneExecutionJob.findUnique({
    where: { id },
  });
}

export async function getActiveSceneExecutionJob(movieId: string, sceneOutlineId: string) {
  return prisma.sceneExecutionJob.findFirst({
    where: {
      movieId,
      sceneOutlineId,
      status: { in: ['pending', 'running'] },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getLatestSceneExecutionJob(movieId: string, sceneOutlineId: string) {
  return prisma.sceneExecutionJob.findFirst({
    where: {
      movieId,
      sceneOutlineId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function markSceneExecutionJobRunning(id: string) {
  return prisma.sceneExecutionJob.update({
    where: { id },
    data: {
      status: 'running',
      startedAt: new Date(),
      currentPhase: 'creating_scene',
      error: null,
    },
  });
}

export async function updateSceneExecutionJobProgress(
  id: string,
  data: {
    sceneId?: string | null;
    currentPhase?: SceneExecutionJobPhase;
    currentRound?: number | null;
    currentAgentName?: string | null;
  }
) {
  return prisma.sceneExecutionJob.update({
    where: { id },
    data: {
      ...(data.sceneId !== undefined && { sceneId: data.sceneId }),
      ...(data.currentPhase !== undefined && { currentPhase: data.currentPhase }),
      ...(data.currentRound !== undefined && { currentRound: data.currentRound }),
      ...(data.currentAgentName !== undefined && { currentAgentName: data.currentAgentName }),
    },
  });
}

export async function completeSceneExecutionJob(
  id: string,
  result: {
    sceneId: string;
    fullScript: string;
    messageCount: number;
    review?: unknown;
    attempts?: number;
    repaired?: boolean;
  }
) {
  return prisma.sceneExecutionJob.update({
    where: { id },
    data: {
      status: 'completed',
      currentPhase: 'completed',
      currentAgentName: null,
      result: JSON.stringify(result),
      completedAt: new Date(),
    },
  });
}

export async function failSceneExecutionJob(id: string, error: string) {
  return prisma.sceneExecutionJob.update({
    where: { id },
    data: {
      status: 'failed',
      currentAgentName: null,
      error,
      completedAt: new Date(),
    },
  });
}
