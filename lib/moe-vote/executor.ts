import { getAgentsByRoundTable } from '@/lib/db/agents';
import { getRoundTableWithDetails } from '@/lib/db/roundtable';
import { createRound, completeRound } from '@/lib/db/rounds';
import { createMessage, getAllMessagesForRoundTable } from '@/lib/db/messages';
import { executeRound } from '@/lib/agents/orchestrator';
import { executeVoting } from '@/lib/agents/voting';
import {
  getMoeVoteJob,
  updateMoeVoteJobStatus,
  updateMoeVoteJobProgress,
  completeMoeVoteJob,
  failMoeVoteJob,
} from '@/lib/db/moe-vote-jobs';
import { MOE_VOTE_CONFIG } from './config';

/**
 * Execute MoE voting job in background
 */
export async function executeJobInBackground(jobId: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await failMoeVoteJob(jobId, 'Anthropic API key not configured');
    throw new Error('Anthropic API key not configured');
  }

  // Get job details
  const job = await getMoeVoteJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  try {
    // Mark as running
    await updateMoeVoteJobStatus(jobId, 'running');

    // Get agents and round table
    const agents = await getAgentsByRoundTable(job.roundTableId);

    // Validate agents array is not empty
    if (!agents || agents.length === 0) {
      throw new Error(`Round table ${job.roundTableId} has no agents`);
    }

    const roundTable = await getRoundTableWithDetails(job.roundTableId);

    if (!roundTable) {
      throw new Error(`Round table ${job.roundTableId} not found`);
    }

    // Execute rounds based on round table's maxRounds
    await updateMoeVoteJobProgress(jobId, 0, 'discussion');

    for (let roundNum = 1; roundNum <= roundTable.maxRounds; roundNum++) {
      // Check if round table has been paused or archived
      const currentRoundTable = await getRoundTableWithDetails(job.roundTableId);
      if (!currentRoundTable || currentRoundTable.status !== 'active') {
        throw new Error(`Discussion has been ${currentRoundTable?.status || 'deleted'}. Stopping execution.`);
      }

      await updateMoeVoteJobProgress(jobId, roundNum, 'discussion');

      // Create round
      const round = await createRound(job.roundTableId, roundNum);

      // Get previous messages for context
      const previousMessages = await getAllMessagesForRoundTable(
        job.roundTableId
      );

      // Execute round (no event handlers needed for background)
      const { messages } = await executeRound(
        agents,
        job.question,
        roundNum,
        previousMessages
          .map((m) => {
            const agent = agents.find((a) => a.id === m.agentId);
            if (!agent) return null;
            return { ...m, agent };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null),
        {
          apiKey,
          onEvent: () => { }, // No event handling in background
          language: roundTable.language as 'en' | 'zh'
        }
      );

      // Save messages
      for (const msg of messages) {
        await createMessage(round.id, msg.agentId, msg.content, msg.toolCalls);
      }

      // Mark round complete
      await completeRound(round.id);
    }

    // Execute voting phase
    await updateMoeVoteJobProgress(
      jobId,
      roundTable.maxRounds,
      'voting'
    );

    const allMessages = await getAllMessagesForRoundTable(job.roundTableId);
    const votingResult = await executeVoting(
      agents,
      allMessages
        .map((m) => {
          const agent = agents.find((a) => a.id === m.agentId);
          if (!agent) return null;
          return { ...m, agent };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null),
      job.question,
      job.includeDiscussionAgentsInVoting,
      apiKey,
      roundTable.language as 'en' | 'zh'
    );

    // Aggregating phase
    await updateMoeVoteJobProgress(
      jobId,
      roundTable.maxRounds,
      'aggregating'
    );

    // Complete job with results
    await completeMoeVoteJob(jobId, votingResult);
  } catch (error) {
    console.error(`Job ${jobId} execution failed:`, error);
    await failMoeVoteJob(
      jobId,
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}
