import { NextRequest, NextResponse } from 'next/server';
import { createRoundTable } from '@/lib/db/roundtable';
import { createMoeVoteJob } from '@/lib/db/moe-vote-jobs';
import { executeJobInBackground } from '@/lib/moe-vote/executor';
import { validateMoeVoteRequest, MOE_VOTE_CONFIG } from '@/lib/moe-vote/config';
import {
  CreateMoeVoteRequest,
  CreateMoeVoteResponse,
} from '@/lib/moe-vote/types';

export async function POST(request: NextRequest) {
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
      agentCount = 3,
    } = body;

    // Create ephemeral round table (this also creates agents)
    const roundTable = await createRoundTable(question, agentCount);

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

    // Estimate completion time
    const estimatedTime =
      agentCount * MOE_VOTE_CONFIG.roundCount * 30000 + // Discussion
      3 * agentCount * 20000; // Voting

    const response: CreateMoeVoteResponse = {
      jobId: job.id,
      estimatedCompletionTime: estimatedTime,
    };

    return NextResponse.json(response);
  } catch (error) {
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
