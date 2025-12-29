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
export function validateMoeVoteRequest(body: unknown): {
  valid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];

  // Type guard for object
  if (typeof body !== 'object' || body === null) {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  const req = body as Record<string, unknown>;

  // Validate question
  if (!req.question || typeof req.question !== 'string') {
    errors.push('Question must be a string');
  } else if (req.question.length < MOE_VOTE_CONFIG.questionMinLength) {
    errors.push(`Question must be at least ${MOE_VOTE_CONFIG.questionMinLength} characters`);
  } else if (req.question.length > MOE_VOTE_CONFIG.questionMaxLength) {
    errors.push(`Question must be less than ${MOE_VOTE_CONFIG.questionMaxLength} characters`);
  }

  // Validate agentCount (optional)
  if (req.agentCount !== undefined) {
    if (
      typeof req.agentCount !== 'number' ||
      !Number.isInteger(req.agentCount) ||
      Number.isNaN(req.agentCount) ||
      req.agentCount < MOE_VOTE_CONFIG.agentCountMin ||
      req.agentCount > MOE_VOTE_CONFIG.agentCountMax
    ) {
      errors.push(`Agent count must be an integer between ${MOE_VOTE_CONFIG.agentCountMin}-${MOE_VOTE_CONFIG.agentCountMax}`);
    }
  }

  // Validate includeDiscussionAgentsInVoting (optional)
  if (req.includeDiscussionAgentsInVoting !== undefined) {
    if (typeof req.includeDiscussionAgentsInVoting !== 'boolean') {
      errors.push('includeDiscussionAgentsInVoting must be a boolean');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
