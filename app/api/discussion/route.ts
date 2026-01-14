// POST /api/discussion - Create new async discussion job

import { NextRequest, NextResponse } from 'next/server';
import { createRoundTable } from '@/lib/db/roundtable';
import { createDiscussionJob, updateDiscussionJobStatus, failDiscussionJob } from '@/lib/db/discussion-jobs';
import { executeDiscussionJob } from '@/lib/jobs/discussion-executor';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { topic, agentCount, maxRounds, selectedPersonaIds, language } = body;

        // Validation
        if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
            return NextResponse.json(
                { error: 'Topic is required and must be a non-empty string' },
                { status: 400 }
            );
        }

        if (!agentCount || typeof agentCount !== 'number' || agentCount < 1) {
            return NextResponse.json(
                { error: 'Agent count must be a positive number' },
                { status: 400 }
            );
        }

        if (!maxRounds || typeof maxRounds !== 'number' || maxRounds < 1) {
            return NextResponse.json(
                { error: 'Max rounds must be a positive number' },
                { status: 400 }
            );
        }

        if (!Array.isArray(selectedPersonaIds) || selectedPersonaIds.length === 0) {
            return NextResponse.json(
                { error: 'Selected persona IDs must be a non-empty array' },
                { status: 400 }
            );
        }

        // Create round table with language
        const roundTable = await createRoundTable(
            topic,
            agentCount,
            undefined, // No custom personas
            maxRounds,
            selectedPersonaIds,
            language || 'zh'
        );

        // Create discussion job linked to round table
        const job = await createDiscussionJob({
            topic,
            agentCount,
            maxRounds,
            roundTableId: roundTable.id,
        });

        // Start job execution in background (fire-and-forget)
        executeDiscussionJob(job.id).catch((error) => {
            console.error(`Background job ${job.id} failed:`, error);
            // Update job status to failed
            failDiscussionJob(job.id, error instanceof Error ? error.message : 'Unknown error').catch(console.error);
        });

        return NextResponse.json({
            jobId: job.id,
            roundTableId: roundTable.id,
            status: 'pending',
            message: 'Discussion job created successfully. Poll /api/discussion/[jobId] for status.',
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating discussion job:', error);
        return NextResponse.json(
            {
                error: 'Failed to create discussion job',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
