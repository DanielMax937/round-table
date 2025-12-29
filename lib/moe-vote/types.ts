import { MoeVoteJobStatus as JobStatus, MoeVoteJobPhase, MoeVoteJobResult } from '@/lib/types';

/**
 * Individual vote from a voting agent
 */
export interface Vote {
  agentId: string;
  voterId: string;
  voterName: string;
  score: number; // 1-10
  justification: string;
}

/**
 * Aggregated scores for a single discussion agent
 */
export interface AgentScore {
  agentId: string;
  agentName: string;
  averageScore: number;
  votes: Vote[];
}

/**
 * Final voting result returned to client
 */
export interface VotingResult {
  winner: {
    agentId: string;
    agentName: string;
    averageScore: number;
  };
  scores: Record<string, AgentScore>;
  discussionSummary: {
    roundCount: number;
    totalMessages: number;
    toolCallsUsed: number;
  };
}

/**
 * Voting agent definition (ephemeral, not persisted)
 */
export interface VotingAgent {
  id: string;
  name: string;
  persona: string;
}

/**
 * Evaluation response from a voting agent (JSON)
 */
export interface VoterEvaluation {
  evaluations: Array<{
    agentId: string;
    agentName: string;
    score: number;
    justification: string;
  }>;
}

/**
 * Request body for POST /api/moe-vote
 */
export interface CreateMoeVoteRequest {
  question: string;
  includeDiscussionAgentsInVoting?: boolean;
  agentCount?: number;
}

/**
 * Response for POST /api/moe-vote
 */
export interface CreateMoeVoteResponse {
  jobId: string;
  estimatedCompletionTime: number;
}

/**
 * Re-export job status types from lib/types.ts for convenience
 */
export type MoeVoteJobStatus = JobStatus;
