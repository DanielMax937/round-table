// Database operations for DiscussionJob model

import { prisma } from '../prisma';
import type { DiscussionJob } from '@prisma/client';

export interface CreateDiscussionJobInput {
    topic: string;
    agentCount: number;
    maxRounds?: number;
    roundTableId: string;
}

/**
 * Create a new discussion job
 */
export async function createDiscussionJob(
    data: CreateDiscussionJobInput
): Promise<DiscussionJob> {
    return await prisma.discussionJob.create({
        data: {
            status: 'pending',
            topic: data.topic,
            agentCount: data.agentCount,
            maxRounds: data.maxRounds ?? 5,
            roundTableId: data.roundTableId,
        },
    });
}

/**
 * Get discussion job by ID
 */
export async function getDiscussionJob(id: string): Promise<DiscussionJob | null> {
    return await prisma.discussionJob.findUnique({
        where: { id },
    });
}

/**
 * Get discussion job with round table details
 */
export async function getDiscussionJobWithDetails(id: string) {
    return await prisma.discussionJob.findUnique({
        where: { id },
        include: {
            roundTable: {
                include: {
                    agents: true,
                    rounds: {
                        include: {
                            messages: {
                                include: {
                                    agent: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
}

/**
 * Update job status
 */
export async function updateDiscussionJobStatus(
    id: string,
    status: 'pending' | 'running' | 'completed' | 'failed'
): Promise<DiscussionJob> {
    const updateData: any = { status };

    if (status === 'running') {
        updateData.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date();
    }

    return await prisma.discussionJob.update({
        where: { id },
        data: updateData,
    });
}

/**
 * Update job progress
 */
export async function updateDiscussionJobProgress(
    id: string,
    currentRound: number,
    currentPhase: string
): Promise<DiscussionJob> {
    return await prisma.discussionJob.update({
        where: { id },
        data: {
            currentRound,
            currentPhase,
        },
    });
}

/**
 * Complete discussion job
 */
export async function completeDiscussionJob(id: string): Promise<DiscussionJob> {
    return await prisma.discussionJob.update({
        where: { id },
        data: {
            status: 'completed',
            currentPhase: 'completed',
            completedAt: new Date(),
        },
    });
}

/**
 * Fail discussion job with error message
 */
export async function failDiscussionJob(
    id: string,
    error: string
): Promise<DiscussionJob> {
    return await prisma.discussionJob.update({
        where: { id },
        data: {
            status: 'failed',
            error,
            completedAt: new Date(),
        },
    });
}

/**
 * Delete discussion job
 */
export async function deleteDiscussionJob(id: string): Promise<boolean> {
    try {
        await prisma.discussionJob.delete({
            where: { id },
        });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get all discussion jobs (for admin/cleanup)
 */
export async function getAllDiscussionJobs(): Promise<DiscussionJob[]> {
    return await prisma.discussionJob.findMany({
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Cleanup old completed/failed jobs (older than 7 days)
 */
export async function cleanupOldDiscussionJobs(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await prisma.discussionJob.deleteMany({
        where: {
            status: {
                in: ['completed', 'failed'],
            },
            completedAt: {
                lt: sevenDaysAgo,
            },
        },
    });

    return result.count;
}
