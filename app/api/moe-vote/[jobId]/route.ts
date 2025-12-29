import { NextRequest, NextResponse } from 'next/server';
import { getMoeVoteJob, deleteMoeVoteJob } from '@/lib/db/moe-vote-jobs';
import { MoeVoteJobStatus } from '@/lib/moe-vote/types';
import { MOE_VOTE_CONFIG } from '@/lib/moe-vote/config';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  try {
    const job = await getMoeVoteJob(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Build response
    const response: MoeVoteJobStatus = {
      jobId: job.id,
      status: job.status as any,
      question: job.question,
      createdAt: job.createdAt,
    };

    // Add progress if running
    if (job.status === 'running' && job.currentRound !== null) {
      response.progress = {
        currentRound: job.currentRound,
        totalRounds: MOE_VOTE_CONFIG.roundCount,
        phase: job.currentPhase as any,
      };
    }

    // Add result if completed
    if (job.status === 'completed' && job.result) {
      response.result = JSON.parse(job.result);
      response.completedAt = job.completedAt!;
    }

    // Add error if failed
    if (job.status === 'failed' && job.error) {
      response.error = job.error;
      response.completedAt = job.completedAt!;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  try {
    await deleteMoeVoteJob(jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
