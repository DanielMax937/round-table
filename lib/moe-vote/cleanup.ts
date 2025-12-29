import { prisma } from '@/lib/prisma';
import { deleteMoeVoteJob } from '@/lib/db/moe-vote-jobs';
import { MOE_VOTE_CONFIG } from './config';

/**
 * Clean up old completed/failed jobs
 */
export async function cleanupOldJobs(
  olderThanDays: number = MOE_VOTE_CONFIG.jobRetentionDays
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const oldJobs = await prisma.moeVoteJob.findMany({
    where: {
      createdAt: { lt: cutoffDate },
      status: { in: ['completed', 'failed'] },
    },
  });

  for (const job of oldJobs) {
    await deleteMoeVoteJob(job.id);
  }

  return oldJobs.length;
}

/**
 * Mark stale running jobs as failed
 */
export async function cleanupStaleJobs(): Promise<number> {
  const staleThreshold = new Date();
  staleThreshold.setTime(
    staleThreshold.getTime() - MOE_VOTE_CONFIG.maxJobDuration
  );

  const staleJobs = await prisma.moeVoteJob.findMany({
    where: {
      status: 'running',
      startedAt: { lt: staleThreshold },
    },
  });

  for (const job of staleJobs) {
    await prisma.moeVoteJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: 'Job execution timed out (stale)',
        completedAt: new Date(),
      },
    });
  }

  return staleJobs.length;
}
