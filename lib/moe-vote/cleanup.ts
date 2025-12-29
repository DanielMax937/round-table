import { prisma } from '@/lib/prisma';
import { MOE_VOTE_CONFIG } from './config';

/**
 * Clean up old completed/failed jobs
 * @param olderThanDays - Number of days after which jobs should be deleted (default: from config)
 * @returns Number of jobs deleted
 */
export async function cleanupOldJobs(
  olderThanDays: number = MOE_VOTE_CONFIG.jobRetentionDays
): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Use bulk delete to avoid N+1 query problem
    const result = await prisma.moeVoteJob.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ['completed', 'failed'] },
      },
    });

    return result.count;
  } catch (error) {
    console.error('Error cleaning up old jobs:', error);
    throw new Error(
      `Failed to cleanup old jobs: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Mark stale running jobs as failed
 * @returns Number of jobs marked as failed
 */
export async function cleanupStaleJobs(): Promise<number> {
  try {
    const staleThreshold = new Date();
    staleThreshold.setTime(
      staleThreshold.getTime() - MOE_VOTE_CONFIG.maxJobDuration
    );

    // Use bulk update to avoid N+1 query problem
    // Include null startedAt check to handle race condition
    const result = await prisma.moeVoteJob.updateMany({
      where: {
        status: 'running',
        OR: [
          { startedAt: { lt: staleThreshold } },
          { startedAt: null },
        ],
      },
      data: {
        status: 'failed',
        error: 'Job execution timed out (stale)',
        completedAt: new Date(),
      },
    });

    return result.count;
  } catch (error) {
    console.error('Error cleaning up stale jobs:', error);
    throw new Error(
      `Failed to cleanup stale jobs: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
