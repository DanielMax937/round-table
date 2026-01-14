import { NextRequest, NextResponse } from 'next/server';
import { createRoundTable, deleteRoundTable } from '@/lib/db/roundtable';
import { createMoeVoteJob } from '@/lib/db/moe-vote-jobs';
import { executeJobInBackground } from '@/lib/moe-vote/executor';
import { validateMoeVoteRequest, MOE_VOTE_CONFIG } from '@/lib/moe-vote/config';
import {
  CreateMoeVoteRequest,
  CreateMoeVoteResponse,
} from '@/lib/moe-vote/types';
import { getDefaultPersonas } from '@/lib/personas';

export async function POST(request: NextRequest) {
  let roundTable;

  try {
    const body: CreateMoeVoteRequest = await request.json();

    // Validate request
    const validation = validateMoeVoteRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const {
      question,
      includeDiscussionAgentsInVoting = false,
      agentCount = 2,
      language = 'zh',
      maxRounds,
    } = body;

    // Prepare personas with decision-forcing instruction
    const defaultPersonas = getDefaultPersonas(agentCount);
    const customPersonas = defaultPersonas.map((p) => ({
      name: p.name,
      persona: `${p.systemPrompt}\n\nIMPORTANT: You must clearly state your position as "YES" or "NO" at the beginning of your discussion. Then provide your arguments based on this chosen position. This is to help reach a final decision.`,
    }));

    // Create ephemeral round table (this also creates agents)
    roundTable = await createRoundTable(
      question,
      agentCount,
      customPersonas,
      maxRounds || MOE_VOTE_CONFIG.roundCount,
      undefined,
      language
    );

    // Create MoE vote job
    const job = await createMoeVoteJob({
      roundTableId: roundTable.id,
      question,
      includeDiscussionAgentsInVoting,
      agentCount,
    });

    // Start background execution (non-blocking)
    executeJobInBackground(job.id).catch((error) => {
      console.error(`Background job ${job.id} failed:`, error);
      // Error already handled in executeJobInBackground
    });

    // Estimate completion time based on actual maxRounds
    const estimatedTime =
      agentCount * roundTable.maxRounds * 30000 + // Discussion
      3 * agentCount * 20000; // Voting

    const response: CreateMoeVoteResponse = {
      jobId: job.id,
      estimatedCompletionTime: estimatedTime,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    // Cleanup orphaned round table if job creation failed
    if (roundTable) {
      try {
        await deleteRoundTable(roundTable.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup orphaned round table:', cleanupError);
      }
    }

    console.error('Error creating MoE vote job:', error);
    return NextResponse.json(
      {
        error: 'Failed to create job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { getAllMoeVoteJobs } = await import('@/lib/db/moe-vote-jobs');
    const jobs = await getAllMoeVoteJobs();

    return NextResponse.json({
      jobs: jobs.map(job => ({
        jobId: job.id,
        status: job.status,
        question: job.question,
        agentCount: job.agentCount,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        currentRound: job.currentRound,
        currentPhase: job.currentPhase,
      })),
      total: jobs.length,
    });
  } catch (error) {
    console.error('Error fetching vote jobs:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch vote jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
