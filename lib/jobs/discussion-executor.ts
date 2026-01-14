// Background job executor for async discussion execution

import { executeRound } from '@/lib/agents/orchestrator';
import { getRoundTable } from '@/lib/db/roundtable';
import { getAgentsByRoundTable } from '@/lib/db/agents';
import { createRound, completeRound } from '@/lib/db/rounds';
import { createMessage } from '@/lib/db/messages';
import { getAllMessagesForRoundTable } from '@/lib/db/messages';
import {
    getDiscussionJob,
    updateDiscussionJobStatus,
    updateDiscussionJobProgress,
    completeDiscussionJob,
    failDiscussionJob,
} from '@/lib/db/discussion-jobs';

/**
 * Execute a discussion job in the background
 */
export async function executeDiscussionJob(jobId: string): Promise<void> {
    console.log(`Starting job execution: ${jobId}`);

    try {
        // Get job details
        const job = await getDiscussionJob(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }

        if (!job.roundTableId) {
            throw new Error(`Job ${jobId} has no associated round table`);
        }

        // Update status to running
        await updateDiscussionJobStatus(jobId, 'running');

        // Get round table and agents
        const roundTable = await getRoundTable(job.roundTableId);
        if (!roundTable) {
            throw new Error(`Round table ${job.roundTableId} not found`);
        }

        const agents = await getAgentsByRoundTable(job.roundTableId);
        if (agents.length === 0) {
            throw new Error('No agents found for round table');
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY not configured');
        }

        // Execute rounds
        for (let roundNum = 1; roundNum <= job.maxRounds; roundNum++) {
            console.log(`Job ${jobId}: Starting round ${roundNum}/${job.maxRounds}`);

            await updateDiscussionJobProgress(jobId, roundNum, 'discussion');

            // Create round
            const round = await createRound(job.roundTableId, roundNum);

            // Get previous messages for context
            const allMessages = await getAllMessagesForRoundTable(job.roundTableId);
            const previousMessages = allMessages.filter(msg => msg.round.roundNumber < roundNum);

            // Execute round
            const result = await executeRound(
                agents,
                roundTable.topic,
                roundNum,
                previousMessages,
                {
                    apiKey,
                    onEvent: (event) => {
                        // Log progress but don't await to avoid blocking
                        if (event.type === 'agent-start') {
                            console.log(`Job ${jobId}: Agent ${event.data.agentName} starting`);
                        }
                    },
                }
            );

            // Save messages
            for (const message of result.messages) {
                await createMessage(
                    round.id,
                    message.agentId,
                    message.content,
                    message.toolCalls,
                    message.citations
                );
            }

            // Mark round complete
            await completeRound(round.id);

            console.log(`Job ${jobId}: Round ${roundNum} complete`);
        }

        // Mark job as completed
        await completeDiscussionJob(jobId);
        console.log(`Job ${jobId}: Completed successfully`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Job ${jobId} failed:`, errorMessage);

        await failDiscussionJob(jobId, errorMessage);
    }
}
