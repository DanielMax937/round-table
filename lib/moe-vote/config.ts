/**
 * Configuration for MoE voting system
 */
export const MOE_VOTE_CONFIG = {
  // Validation constraints
  questionMinLength: 10,
  questionMaxLength: 1000,
  agentCountMin: 2,
  agentCountMax: 6,
  roundCount: 10, // Fixed for now

  // Timeouts
  maxJobDuration: 2 * 60 * 60 * 1000, // 2 hours max
  agentTurnTimeout: 60000, // 1 minute per agent turn
  votingTimeout: 5 * 60 * 1000, // 5 minutes for voting phase

  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoffMultiplier: 2,

  // Cleanup
  jobRetentionDays: 7,
  cleanupCheckInterval: 24 * 60 * 60 * 1000, // Daily
};

/**
 * Validate MoE vote request parameters
 */
export function validateMoeVoteRequest(body: any): {
  valid: boolean;
  error?: string;
} {
  if (!body.question || typeof body.question !== 'string') {
    return { valid: false, error: 'Question must be a string' };
  }

  if (body.question.length < MOE_VOTE_CONFIG.questionMinLength) {
    return {
      valid: false,
      error: `Question must be at least ${MOE_VOTE_CONFIG.questionMinLength} characters`,
    };
  }

  if (body.question.length > MOE_VOTE_CONFIG.questionMaxLength) {
    return {
      valid: false,
      error: `Question must be less than ${MOE_VOTE_CONFIG.questionMaxLength} characters`,
    };
  }

  if (body.agentCount !== undefined) {
    if (
      typeof body.agentCount !== 'number' ||
      body.agentCount < MOE_VOTE_CONFIG.agentCountMin ||
      body.agentCount > MOE_VOTE_CONFIG.agentCountMax
    ) {
      return {
        valid: false,
        error: `Agent count must be between ${MOE_VOTE_CONFIG.agentCountMin}-${MOE_VOTE_CONFIG.agentCountMax}`,
      };
    }
  }

  return { valid: true };
}
