import { Agent as AgentModel, Message } from '@prisma/client';
import { streamChatCompletion } from '@/lib/llm/client';
import type { LLMMessage } from '@/lib/llm/types';
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
  apiKey: string,
  language?: 'en' | 'zh'
): Promise<Vote[]> {
  let textContent = '';

  try {
    const systemPrompt = (() => {
      let prompt = voter.persona;
      if (language === 'zh') {
        prompt += '\n\nIMPORTANT: You MUST provide your justification in Chinese (中文). scores should still be numbers.';
      }
      return prompt;
    })();

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: votingContext },
    ];

    const stream = streamChatCompletion(messages, {
      maxTokens: 8192,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_delta' && chunk.delta) {
        textContent += chunk.delta;
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'LLM streaming error');
      }
    }

    // Parse JSON response
    // Robust JSON extraction
    let jsonText = textContent.trim();

    // 1. Try to find markdown code block (allow missing closing fence)
    const markdownMatch = jsonText.match(/```(?:json)?([\s\S]*?)(?:```|$)/);
    if (markdownMatch && markdownMatch[1].trim().startsWith('{')) {
      jsonText = markdownMatch[1].trim();
    } else {
      // 2. Fallback: try to find the outer-most JSON object
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      if (firstBrace !== -1) {
        // If lastBrace is missing or before firstBrace (impossible if -1 check passed, but safety), use end of string
        const end = (lastBrace !== -1 && lastBrace > firstBrace) ? lastBrace + 1 : jsonText.length;
        jsonText = jsonText.substring(firstBrace, end);
      }
    }

    let evaluation: VoterEvaluation;
    try {
      evaluation = JSON.parse(jsonText);
    } catch (e) {
      // Attempt to repair truncated JSON
      console.warn('JSON parse failed, attempting repair:', e);
      try {
        // simple repair: close string then close objects
        // detecting unclosed string is hard with regex, assuming truncation at end
        let repaired = jsonText;
        // Count unescaped quotes to see if we are in a string
        const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          repaired += '"';
        }
        // Close arrays and objects
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;

        repaired += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
        repaired += '}'.repeat(Math.max(0, openBraces - closeBraces));

        evaluation = JSON.parse(repaired);
      } catch (repairError) {
        console.error('JSON repair failed:', repairError);
        throw e; // Throw original error
      }
    }

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
      justification: e.justification || 'Truncated justification',
    }));

    return votes;
  } catch (error) {
    console.error(`❌ Voting agent ${voter.name} failed:`);
    console.error('Error:', error);
    console.error('Raw text content received:', textContent?.substring(0, 500));

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
  apiKey: string,
  language?: 'en' | 'zh'
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
      persona: `${agent.persona}

Now evaluate all discussion agents (including yourself if applicable) based on their contributions. You cannot vote for yourself - give yourself a score of 0.

For each agent, provide:
1. Score (1-10, where 10 is exceptional, 0 for yourself)
2. Detailed justification (2-3 sentences)

Respond ONLY with valid JSON in this exact format:
{
  "evaluations": [
    {
      "agentId": "agent-id-here",
      "agentName": "Agent Name Here",
      "score": 8,
      "justification": "Detailed explanation of the score."
    }
  ]
}`,
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
      apiKey,
      language
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

  // Determine YES/NO decision based on winner's position
  // We'll analyze the winner's messages to determine their stance
  const winnerMessages = allMessages.filter((m) => m.agentId === winner.agentId);
  const { stance: winnerStance, thought: decisionThought } = await analyzeStanceFromMessages(winnerMessages, topic, apiKey);

  // Confidence is based on how much higher the winner's score is
  const scores = Object.values(aggregatedScores);
  const avgScore = scores.reduce((sum, s) => sum + s.averageScore, 0) / scores.length;
  const scoreRange = Math.max(...scores.map(s => s.averageScore)) - Math.min(...scores.map(s => s.averageScore));
  const confidence = Math.min(100, Math.round(((winner.averageScore - avgScore) / scoreRange) * 100 + 50));

  // Build result
  return {
    finalDecision: winnerStance,
    decisionThought,
    confidence,
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

/**
 * Analyze agent's stance from their messages using LLM
 */
async function analyzeStanceFromMessages(
  messages: (Message & { agent: AgentModel })[],
  topic: string,
  apiKey: string
): Promise<{ stance: 'yes' | 'no'; thought: string }> {
  const combinedMessages = messages.map(m => m.content).join('\n\n');

  // Step 1: Summarize the winner's view
  const summaryPrompt = `Summarize the key arguments and final position of the agent based on the following messages regarding the topic "${topic}".
  
Messages:
${combinedMessages}

Provide a concise summary of their stance.`;

  let summary = '';
  try {
    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a helpful summarizer.' },
      { role: 'user', content: summaryPrompt },
    ];

    const stream = streamChatCompletion(messages);

    for await (const chunk of stream) {
      if (chunk.type === 'content_delta' && chunk.delta) {
        summary += chunk.delta;
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'LLM streaming error');
      }
    }
  } catch (error) {
    console.error('Failed to summarize stance:', error);
    return { stance: 'yes', thought: 'Analysis failed during summary.' };
  }

  // Step 2: Determine YES/NO based on question and summary
  const decisionPrompt = `Question: "${topic}"

Agent's View Summary:
${summary}

Based on this summary, is the agent's answer to the question "YES" or "NO"?

Please provide:
1. A brief thought process (1-2 sentences) explaining why.
2. The final decision (YES or NO).

Response format:
Thought: [Your reasoning]
Decision: [YES/NO]`;

  try {
    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a decision analyzer. Output in the requested format.' },
      { role: 'user', content: decisionPrompt },
    ];

    const stream = streamChatCompletion(messages);

    let response = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_delta' && chunk.delta) {
        response += chunk.delta;
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'LLM streaming error');
      }
    }

    const fullResponse = response.trim();
    console.log(`2-Step Stance Analysis:`, { summary: summary.substring(0, 50) + '...', fullResponse });

    // Parse Thought and Decision using robust regex
    // Capture everything between "Thought:" and "Decision:" (or end), handling newlines
    const thoughtMatch = fullResponse.match(/Thought:\s*([\s\S]+?)(?:\n\s*Decision:|$)/i);
    const decisionMatch = fullResponse.match(/Decision:\s*(YES|NO)/i);

    let thought = thoughtMatch ? thoughtMatch[1].trim() : 'No reasoning provided.';
    const stanceStr = decisionMatch ? decisionMatch[1].toLowerCase() : 'yes';

    // Fallback if thought is empty and response is short, use whole response
    if (thought === 'No reasoning provided.' && !fullResponse.includes('Thought:') && fullResponse.length < 500) {
      thought = fullResponse;
    }

    return {
      stance: stanceStr === 'no' ? 'no' : 'yes',
      thought
    };
  } catch (error) {
    console.error('Failed to analyze decision:', error);
    return { stance: 'yes', thought: 'Analysis failed.' };
  }
}
