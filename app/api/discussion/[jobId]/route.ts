// GET /api/discussion/[jobId] - Get discussion job status and results

import { NextRequest, NextResponse } from 'next/server';
import { getDiscussionJobWithDetails } from '@/lib/db/discussion-jobs';

interface RouteParams {
    params: Promise<{ jobId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { jobId } = await params;

    try {
        const job = await getDiscussionJobWithDetails(jobId);

        if (!job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        // Build progress object
        let progress = null;
        if (job.currentRound !== null && job.currentPhase) {
            progress = {
                currentRound: job.currentRound,
                totalRounds: job.maxRounds,
                phase: job.currentPhase,
            };
        }

        // Build response
        const response: any = {
            jobId: job.id,
            status: job.status,
            topic: job.topic,
            agentCount: job.agentCount,
            maxRounds: job.maxRounds,
            progress,
            error: job.error,
            createdAt: job.createdAt,
            completedAt: job.completedAt,
        };

        // Include round table data if available
        if (job.roundTable) {
            response.roundTable = {
                id: job.roundTable.id,
                status: job.roundTable.status,
                agents: job.roundTable.agents.map(agent => ({
                    id: agent.id,
                    name: agent.name,
                    order: agent.order,
                })),
                rounds: job.roundTable.rounds.map(round => ({
                    id: round.id,
                    roundNumber: round.roundNumber,
                    status: round.status,
                    messageCount: round.messages.length,
                    messages: round.messages.map(msg => ({
                        id: msg.id,
                        agentId: msg.agentId,
                        agentName: msg.agent.name,
                        content: msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''), // Preview
                        createdAt: msg.createdAt,
                    })),
                })),
            };
        }

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error fetching job:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch job status',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
