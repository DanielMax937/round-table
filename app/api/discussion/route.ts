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
                { error: '主题为必填项，且必须是非空字符串' },
                { status: 400 }
            );
        }

        if (!agentCount || typeof agentCount !== 'number' || agentCount < 1) {
            return NextResponse.json(
                { error: '智能体数量必须是正数' },
                { status: 400 }
            );
        }

        if (!maxRounds || typeof maxRounds !== 'number' || maxRounds < 1) {
            return NextResponse.json(
                { error: '最大轮数必须是正数' },
                { status: 400 }
            );
        }

        if (!Array.isArray(selectedPersonaIds) || selectedPersonaIds.length === 0) {
            return NextResponse.json(
                { error: '已选人格 ID 必须是非空数组' },
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
            failDiscussionJob(job.id, error instanceof Error ? error.message : '未知错误').catch(console.error);
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
                error: '创建讨论任务失败',
                details: error instanceof Error ? error.message : '未知错误'
            },
            { status: 500 }
        );
    }
}
