import { Agent as AgentModel, Message } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { Vote, VotingResult, AgentScore, VotingAgent, VoterEvaluation } from '@/lib/moe-vote/types';
import { getVotingAgents } from './voting-personas';

/**
 * Parse round number from roundId (format: "N-roundtable-id")
 */
function parseRoundNumber(roundId: string | null): number {
  if (!roundId) return 1;
  const parsed = parseInt(roundId.split('-')[0], 10);
  return isNaN(parsed) ? 1 : parsed;
}

/**
 * Aggregate votes from all voters into average scores
 */
export function aggregateVotes(
  votes: Vote[],
  discussionAgents: AgentModel[]
): { [agentId: string]: AgentScore } {
  const scores: { [agentId: string]: AgentScore } = {};

  // Initialize scores for all discussion agents
  for (const agent of discussionAgents) {
    scores[agent.id] = {
      agentId: agent.id,
      agentName: agent.name,
      averageScore: 0,
      votes: [],
    };
  }

  // Group votes by agent
  for (const vote of votes) {
    if (scores[vote.agentId]) {
      scores[vote.agentId].votes.push(vote);
    }
  }

  // Calculate averages
  for (const agentId in scores) {
    const agentVotes = scores[agentId].votes;
    if (agentVotes.length > 0) {
      const sum = agentVotes.reduce((acc, v) => acc + v.score, 0);
      scores[agentId].averageScore = sum / agentVotes.length;
    }
  }

  return scores;
}

/**
 * Determine winner from aggregated scores
 */
export function determineWinner(scores: {
  [agentId: string]: AgentScore;
}): { agentId: string; agentName: string; averageScore: number } {
  let winnerId = '';
  let winnerName = '';
  let highestScore = -1;

  for (const agentId in scores) {
    if (scores[agentId].averageScore > highestScore) {
      highestScore = scores[agentId].averageScore;
      winnerId = agentId;
      winnerName = scores[agentId].agentName;
    }
  }

  return {
    agentId: winnerId,
    agentName: winnerName,
    averageScore: highestScore,
  };
}

/**
 * Build voting context from discussion messages
 */
export function buildVotingContext(
  discussionAgents: AgentModel[],
  allMessages: (Message & { agent: AgentModel })[],
  topic: string
): string {
  const lines: string[] = [];

  lines.push(`Topic: ${topic}`);
  lines.push('');
  lines.push('Discussion Summary:');

  // Summary of each agent's key points
  for (const agent of discussionAgents) {
    const agentMessages = allMessages.filter((m) => m.agentId === agent.id);
    lines.push(`- ${agent.name}: ${agentMessages.length} contributions`);
  }

  lines.push('');
  lines.push('Full Discussion Transcript:');
  lines.push('');

  // Full transcript organized by round
  const rounds = new Map<number, (Message & { agent: AgentModel })[]>();
  for (const msg of allMessages) {
    const roundNum = parseRoundNumber(msg.roundId);
    if (!rounds.has(roundNum)) {
      rounds.set(roundNum, []);
    }
    rounds.get(roundNum)!.push(msg);
  }

  for (const [roundNum, messages] of Array.from(rounds.entries()).sort(
    ([a], [b]) => a - b
  )) {
    lines.push(`--- Round ${roundNum} ---`);
    for (const msg of messages) {
      lines.push(`[${msg.agent.name}]: ${msg.content}`);
      if (msg.toolCalls) {
        try {
          const toolCalls = JSON.parse(msg.toolCalls);
          if (toolCalls.length > 0) {
            lines.push(`  🔍 Used ${toolCalls.length} web search(es)`);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    lines.push('');
  }

  lines.push('Your Task:');
  lines.push(
    `Evaluate each of the ${discussionAgents.length} discussion agents based on your specific criteria.`
  );
  lines.push('For each agent, provide a score (1-10) and justification.');
  lines.push('');
  lines.push('Discussion Agents to Evaluate:');
  for (const agent of discussionAgents) {
    lines.push(`- ID: ${agent.id}, Name: ${agent.name}`);
  }

  return lines.join('\n');
}

/**
 * Execute evaluation by a single voting agent
 */
export async function executeVoterEvaluation(
  voter: VotingAgent,
  discussionAgents: AgentModel[],
  votingContext: string,
  apiKey: string
): Promise<Vote[]> {
  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: voter.persona,
      messages: [
        {
          role: 'user',
          content: votingContext,
        },
      ],
    });

    // Extract text content
    const textContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('');

    // Parse JSON response
    const evaluation: VoterEvaluation = JSON.parse(textContent);

    // Validate evaluation structure
    if (!evaluation.evaluations || !Array.isArray(evaluation.evaluations)) {
      throw new Error('Invalid evaluation structure: missing or invalid evaluations array');
    }

    // Convert to Vote objects
    const votes: Vote[] = evaluation.evaluations.map((e) => ({
      agentId: e.agentId,
      voterId: voter.id,
      voterName: voter.name,
      score: e.score,
      justification: e.justification,
    }));

    return votes;
  } catch (error) {
    console.error(`Voting agent ${voter.name} failed:`, error);

    // Fallback: return neutral scores
    return discussionAgents.map((agent) => ({
      agentId: agent.id,
      voterId: voter.id,
      voterName: voter.name,
      score: 5,
      justification: 'Unable to evaluate (error occurred)',
    }));
  }
}

/**
 * Execute complete voting process
 */
export async function executeVoting(
  discussionAgents: AgentModel[],
  allMessages: (Message & { agent: AgentModel })[],
  topic: string,
  includeDiscussionAgents: boolean,
  apiKey: string
): Promise<VotingResult> {
  // Guard against empty discussion agents
  if (discussionAgents.length === 0) {
    throw new Error('At least one discussion agent is required for voting');
  }

  // Get voting agents
  const votingAgents = getVotingAgents();

  // Optionally include discussion agents as voters
  let allVoters: VotingAgent[] = votingAgents;
  if (includeDiscussionAgents) {
    const discussionVoters: VotingAgent[] = discussionAgents.map((agent) => ({
      id: `discussion-${agent.id}`,
      name: agent.name,
      persona: `${agent.persona}\n\nNow evaluate all discussion agents (including yourself if applicable) based on their contributions. You cannot vote for yourself.`,
    }));
    allVoters = [...votingAgents, ...discussionVoters];
  }

  // Build voting context
  const votingContext = buildVotingContext(
    discussionAgents,
    allMessages,
    topic
  );

  // Collect votes from all voters
  const allVotes: Vote[] = [];

  for (const voter of allVoters) {
    const votes = await executeVoterEvaluation(
      voter,
      discussionAgents,
      votingContext,
      apiKey
    );

    // Filter out self-votes if discussion agents are voting
    if (includeDiscussionAgents && voter.id.startsWith('discussion-')) {
      const voterId = voter.id.replace('discussion-', '');
      allVotes.push(...votes.filter((v) => v.agentId !== voterId));
    } else {
      allVotes.push(...votes);
    }
  }

  // Aggregate votes
  const aggregatedScores = aggregateVotes(allVotes, discussionAgents);

  // Determine winner
  const winner = determineWinner(aggregatedScores);

  // Build result
  return {
    winner,
    scores: aggregatedScores,
    discussionSummary: {
      roundCount: Math.max(
        ...allMessages.map((m) => parseRoundNumber(m.roundId)),
        1
      ),
      totalMessages: allMessages.length,
      toolCallsUsed: allMessages.filter((m) => m.toolCalls).length,
    },
  };
}
