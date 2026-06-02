import { NextRequest, NextResponse } from 'next/server';
import { getMoeVoteJob, deleteMoeVoteJob } from '@/lib/db/moe-vote-jobs';
import { MoeVoteJobStatus, MoeVoteJobPhase, MoeVoteJobResult } from '@/lib/types';
import { MOE_VOTE_CONFIG } from '@/lib/moe-vote/config';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

interface GetJobResponse {
  jobId: string;
  status: MoeVoteJobStatus;
  question: string;
  createdAt: Date;
  progress?: {
    currentRound: number;
    totalRounds: number;
    phase: MoeVoteJobPhase;
  };
  result?: MoeVoteJobResult;
  error?: string;
  completedAt?: Date;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  try {
    const job = await getMoeVoteJob(jobId);

    if (!job) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // Build response
    const response: GetJobResponse = {
      jobId: job.id,
      status: job.status as MoeVoteJobStatus,
      question: job.question,
      createdAt: job.createdAt,
    };

    // Add progress if running
    if (job.status === 'running' && job.currentRound !== null && job.currentPhase) {
      // Use MOE_VOTE_CONFIG for total rounds since roundTable is loaded via include
      response.progress = {
        currentRound: job.currentRound,
        totalRounds: MOE_VOTE_CONFIG.roundCount,
        phase: job.currentPhase as MoeVoteJobPhase,
      };
    }

    // Add result if completed
    if (job.status === 'completed' && job.result) {
      try {
        response.result = JSON.parse(job.result);
      } catch (parseError) {
        console.error('Failed to parse job result JSON:', parseError);
        return NextResponse.json(
          { error: '解析任务结果失败', details: '已保存的结果格式异常' },
          { status: 500 }
        );
      }
      if (job.completedAt) {
        response.completedAt = job.completedAt;
      }
    }

    // Add error if failed
    if (job.status === 'failed' && job.error) {
      response.error = job.error;
      if (job.completedAt) {
        response.completedAt = job.completedAt;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      {
        error: '获取任务失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  try {
    // Check if job exists before deleting
    const job = await getMoeVoteJob(jobId);
    if (!job) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    await deleteMoeVoteJob(jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json(
      {
        error: '删除任务失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
