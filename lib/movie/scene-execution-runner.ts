import { prisma } from '@/lib/prisma';
import { getMovie } from '@/lib/db/movies';
import { getSceneOutlinesByMovie } from '@/lib/db/scene-outlines';
import { createSceneFromOutline } from '@/lib/db/scenes';
import { executeSceneWithAgents } from './scene-executor';
import {
  completeSceneExecutionJob,
  failSceneExecutionJob,
  getSceneExecutionJob,
  markSceneExecutionJobRunning,
  updateSceneExecutionJobProgress,
} from '@/lib/db/scene-execution-jobs';

export async function executeSceneJobInBackground(jobId: string): Promise<void> {
  try {
    const job = await getSceneExecutionJob(jobId);
    if (!job) {
      throw new Error(`Scene execution job ${jobId} not found`);
    }

    await markSceneExecutionJobRunning(jobId);

    const movie = await getMovie(job.movieId);
    if (!movie) {
      throw new Error('Movie not found');
    }

    const outlines = await getSceneOutlinesByMovie(job.movieId);
    const outline = outlines[job.outlineIndex];
    if (!outline) {
      throw new Error('Outline not found');
    }

    const existingScene = await prisma.scene.findFirst({
      where: { sceneOutlineId: outline.id },
    });
    if (existingScene) {
      const result = {
        sceneId: existingScene.id,
        fullScript: existingScene.finalizedScript ?? '',
        messageCount: 0,
      };
      await updateSceneExecutionJobProgress(jobId, { sceneId: existingScene.id });
      await completeSceneExecutionJob(jobId, result);
      return;
    }

    const characterIds = JSON.parse(outline.characterIdsJson || '[]') as string[];
    const characters = await prisma.character.findMany({
      where: { id: { in: characterIds }, movieId: job.movieId },
    });
    if (characters.length === 0) {
      throw new Error('No valid characters for this scene');
    }
    const validCharacterIds = new Set(characters.map((c) => c.id));

    const scene = await createSceneFromOutline(job.movieId, outline.id, {
      title: outline.title,
      contentSummary: outline.contentSummary,
      emotionalGoal: outline.emotionalGoal,
      characterIds: characterIds.filter((id) => validCharacterIds.has(id)),
    });

    await updateSceneExecutionJobProgress(jobId, {
      sceneId: scene.id,
      currentPhase: 'director',
    });

    const result = await executeSceneWithAgents(scene.id, {
      header: `🎬 场景 ${job.outlineIndex + 1} 已通过 LLM 编剧评审: ${outline.title}\n\n请审阅。可反馈重写或确认进入下一场。`,
      onProgress: async (progress) => {
        await updateSceneExecutionJobProgress(jobId, {
          currentPhase: progress.phase,
          currentRound: progress.roundNumber ?? null,
          currentAgentName: progress.agentName ?? null,
        });
      },
    });

    await completeSceneExecutionJob(jobId, result);
  } catch (error) {
    console.error(`Scene execution job ${jobId} failed:`, error);
    await failSceneExecutionJob(
      jobId,
      error instanceof Error ? error.message : 'Unknown error'
    ).catch((failError) => {
      console.error(`Failed to persist scene job failure ${jobId}:`, failError);
    });
  }
}
