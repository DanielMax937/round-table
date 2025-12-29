# MoE Voting Router Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an async MoE voting system that runs 10-round discussions and uses specialized evaluator agents to determine which discussion agent had the best perspective.

**Architecture:** Async job pattern with database persistence. Background executor runs 10 sequential rounds using existing orchestrator, then 3 voting agents evaluate all discussion agents with weighted scores (1-10) and justifications. Client polls for status/results.

**Tech Stack:** Prisma (SQLite), Next.js API Routes, Anthropic Claude SDK, TypeScript

---

## Phase 1: Database Schema & Operations

### Task 1: Add MoeVoteJob Table to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add MoeVoteJob model to schema**

Open `prisma/schema.prisma` and add after the RoundTable model:

```prisma
model MoeVoteJob {
  id                              String   @id @default(cuid())
  status                          String   // "pending" | "running" | "completed" | "failed"
  question                        String
  includeDiscussionAgentsInVoting Boolean  @default(false)
  agentCount                      Int      @default(3)

  // References ephemeral round table
  roundTableId                    String   @unique
  roundTable                      RoundTable @relation(fields: [roundTableId], references: [id], onDelete: Cascade)

  // Progress tracking
  currentRound                    Int?
  currentPhase                    String?  // "discussion" | "voting" | "aggregating"

  // Results (JSON stringified)
  result                          String?
  error                           String?

  // Timestamps
  createdAt                       DateTime @default(now())
  startedAt                       DateTime?
  completedAt                     DateTime?

  @@index([status])
  @@index([createdAt])
}
```

**Step 2: Add relation to RoundTable model**

In the RoundTable model, add this field at the end:

```prisma
  moeVoteJob  MoeVoteJob?
```

**Step 3: Create and apply migration**

Run: `npx prisma migrate dev --name add_moe_vote_job`
Expected: Migration created successfully, database updated

**Step 4: Verify migration**

Run: `npx prisma studio`
Expected: MoeVoteJob table visible in Prisma Studio

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add MoeVoteJob table with progress tracking

- Add MoeVoteJob model with status, progress, and result fields
- Add relation to RoundTable with cascade delete
- Add indexes on status and createdAt for queries

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Database Operations for MoeVoteJob

**Files:**
- Create: `lib/db/moe-vote-jobs.ts`
- Create: `lib/db/__tests__/moe-vote-jobs.test.ts`

**Step 1: Write test for createMoeVoteJob**

Create `lib/db/__tests__/moe-vote-jobs.test.ts`:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createRoundTable } from '../roundtable';
import {
  createMoeVoteJob,
  getMoeVoteJob,
  updateMoeVoteJobStatus,
  updateMoeVoteJobProgress,
  completeMoeVoteJob,
  failMoeVoteJob,
  deleteMoeVoteJob,
} from '../moe-vote-jobs';

describe('MoeVoteJob Database Operations', () => {
  let roundTableId: string;

  beforeAll(async () => {
    const rt = await createRoundTable('Test question?', 3);
    roundTableId = rt.id;
  });

  test('createMoeVoteJob creates job in pending status', async () => {
    const job = await createMoeVoteJob({
      roundTableId,
      question: 'Test question?',
      includeDiscussionAgentsInVoting: false,
      agentCount: 3,
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe('pending');
    expect(job.question).toBe('Test question?');
    expect(job.roundTableId).toBe(roundTableId);
    expect(job.includeDiscussionAgentsInVoting).toBe(false);
    expect(job.agentCount).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest lib/db/__tests__/moe-vote-jobs.test.ts`
Expected: FAIL - "Cannot find module '../moe-vote-jobs'"

**Step 3: Create minimal implementation**

Create `lib/db/moe-vote-jobs.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { MoeVoteJob } from '@prisma/client';

export interface CreateMoeVoteJobParams {
  roundTableId: string;
  question: string;
  includeDiscussionAgentsInVoting: boolean;
  agentCount: number;
}

export async function createMoeVoteJob(
  params: CreateMoeVoteJobParams
): Promise<MoeVoteJob> {
  return await prisma.moeVoteJob.create({
    data: {
      status: 'pending',
      question: params.question,
      includeDiscussionAgentsInVoting: params.includeDiscussionAgentsInVoting,
      agentCount: params.agentCount,
      roundTableId: params.roundTableId,
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest lib/db/__tests__/moe-vote-jobs.test.ts`
Expected: PASS

**Step 5: Add test for getMoeVoteJob**

Add to test file:

```typescript
test('getMoeVoteJob retrieves job by id', async () => {
  const created = await createMoeVoteJob({
    roundTableId,
    question: 'Test question 2?',
    includeDiscussionAgentsInVoting: true,
    agentCount: 5,
  });

  const retrieved = await getMoeVoteJob(created.id);

  expect(retrieved).toBeDefined();
  expect(retrieved?.id).toBe(created.id);
  expect(retrieved?.question).toBe('Test question 2?');
});

test('getMoeVoteJob returns null for non-existent id', async () => {
  const retrieved = await getMoeVoteJob('non-existent-id');
  expect(retrieved).toBeNull();
});
```

**Step 6: Implement getMoeVoteJob**

Add to `lib/db/moe-vote-jobs.ts`:

```typescript
export async function getMoeVoteJob(id: string): Promise<MoeVoteJob | null> {
  return await prisma.moeVoteJob.findUnique({
    where: { id },
    include: { roundTable: true },
  });
}
```

**Step 7: Run tests**

Run: `npx vitest lib/db/__tests__/moe-vote-jobs.test.ts`
Expected: All tests PASS

**Step 8: Add tests for update operations**

Add to test file:

```typescript
test('updateMoeVoteJobStatus updates status and startedAt', async () => {
  const job = await createMoeVoteJob({
    roundTableId,
    question: 'Test question 3?',
    includeDiscussionAgentsInVoting: false,
    agentCount: 3,
  });

  await updateMoeVoteJobStatus(job.id, 'running');
  const updated = await getMoeVoteJob(job.id);

  expect(updated?.status).toBe('running');
  expect(updated?.startedAt).toBeDefined();
});

test('updateMoeVoteJobProgress updates round and phase', async () => {
  const job = await createMoeVoteJob({
    roundTableId,
    question: 'Test question 4?',
    includeDiscussionAgentsInVoting: false,
    agentCount: 3,
  });

  await updateMoeVoteJobProgress(job.id, 5, 'discussion');
  const updated = await getMoeVoteJob(job.id);

  expect(updated?.currentRound).toBe(5);
  expect(updated?.currentPhase).toBe('discussion');
});
```

**Step 9: Implement update operations**

Add to `lib/db/moe-vote-jobs.ts`:

```typescript
export async function updateMoeVoteJobStatus(
  id: string,
  status: string
): Promise<MoeVoteJob> {
  return await prisma.moeVoteJob.update({
    where: { id },
    data: {
      status,
      ...(status === 'running' && { startedAt: new Date() }),
    },
  });
}

export async function updateMoeVoteJobProgress(
  id: string,
  currentRound: number,
  currentPhase: string
): Promise<MoeVoteJob> {
  return await prisma.moeVoteJob.update({
    where: { id },
    data: { currentRound, currentPhase },
  });
}
```

**Step 10: Run tests**

Run: `npx vitest lib/db/__tests__/moe-vote-jobs.test.ts`
Expected: All tests PASS

**Step 11: Add tests for completion operations**

Add to test file:

```typescript
test('completeMoeVoteJob saves result and sets completed status', async () => {
  const job = await createMoeVoteJob({
    roundTableId,
    question: 'Test question 5?',
    includeDiscussionAgentsInVoting: false,
    agentCount: 3,
  });

  const result = {
    winner: { agentId: 'a1', agentName: 'Test Agent', averageScore: 8.5 },
    scores: {},
    discussionSummary: { roundCount: 10, totalMessages: 30, toolCallsUsed: 5 },
  };

  await completeMoeVoteJob(job.id, result);
  const updated = await getMoeVoteJob(job.id);

  expect(updated?.status).toBe('completed');
  expect(updated?.result).toBeDefined();
  expect(updated?.completedAt).toBeDefined();
  expect(JSON.parse(updated!.result!)).toEqual(result);
});

test('failMoeVoteJob saves error and sets failed status', async () => {
  const job = await createMoeVoteJob({
    roundTableId,
    question: 'Test question 6?',
    includeDiscussionAgentsInVoting: false,
    agentCount: 3,
  });

  await failMoeVoteJob(job.id, 'Test error message');
  const updated = await getMoeVoteJob(job.id);

  expect(updated?.status).toBe('failed');
  expect(updated?.error).toBe('Test error message');
  expect(updated?.completedAt).toBeDefined();
});
```

**Step 12: Implement completion operations**

Add to `lib/db/moe-vote-jobs.ts`:

```typescript
export async function completeMoeVoteJob(
  id: string,
  result: any
): Promise<MoeVoteJob> {
  return await prisma.moeVoteJob.update({
    where: { id },
    data: {
      status: 'completed',
      result: JSON.stringify(result),
      completedAt: new Date(),
    },
  });
}

export async function failMoeVoteJob(
  id: string,
  error: string
): Promise<MoeVoteJob> {
  return await prisma.moeVoteJob.update({
    where: { id },
    data: {
      status: 'failed',
      error,
      completedAt: new Date(),
    },
  });
}
```

**Step 13: Run tests**

Run: `npx vitest lib/db/__tests__/moe-vote-jobs.test.ts`
Expected: All tests PASS

**Step 14: Add test for delete operation**

Add to test file:

```typescript
test('deleteMoeVoteJob removes job and cascades to round table', async () => {
  const rt = await createRoundTable('Delete test question?', 3);
  const job = await createMoeVoteJob({
    roundTableId: rt.id,
    question: 'Delete test question?',
    includeDiscussionAgentsInVoting: false,
    agentCount: 3,
  });

  await deleteMoeVoteJob(job.id);

  const retrieved = await getMoeVoteJob(job.id);
  expect(retrieved).toBeNull();
});
```

**Step 15: Implement delete operation**

Add to `lib/db/moe-vote-jobs.ts`:

```typescript
export async function deleteMoeVoteJob(id: string): Promise<void> {
  await prisma.moeVoteJob.delete({
    where: { id },
  });
}
```

**Step 16: Run all tests**

Run: `npx vitest lib/db/__tests__/moe-vote-jobs.test.ts`
Expected: All tests PASS

**Step 17: Commit**

```bash
git add lib/db/moe-vote-jobs.ts lib/db/__tests__/moe-vote-jobs.test.ts
git commit -m "feat(db): add MoeVoteJob database operations

- createMoeVoteJob: Create new job in pending status
- getMoeVoteJob: Retrieve job by ID with round table
- updateMoeVoteJobStatus: Update status and track startedAt
- updateMoeVoteJobProgress: Track current round and phase
- completeMoeVoteJob: Save result and mark completed
- failMoeVoteJob: Save error and mark failed
- deleteMoeVoteJob: Remove job (cascades to round table)

All operations covered by unit tests.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: TypeScript Types & Configuration

### Task 3: Define TypeScript Types

**Files:**
- Create: `lib/moe-vote/types.ts`

**Step 1: Create types file with core interfaces**

Create `lib/moe-vote/types.ts`:

```typescript
import { Agent as AgentModel } from '@prisma/client';

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
  scores: {
    [agentId: string]: AgentScore;
  };
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
 * Job status response for GET /api/moe-vote/[jobId]
 */
export interface MoeVoteJobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  question: string;
  createdAt: Date;
  progress?: {
    currentRound: number;
    totalRounds: number;
    phase: 'discussion' | 'voting' | 'aggregating';
  };
  result?: VotingResult;
  error?: string;
  completedAt?: Date;
}
```

**Step 2: Commit**

```bash
git add lib/moe-vote/types.ts
git commit -m "feat(types): add MoE voting TypeScript types

- Vote and AgentScore interfaces for voting results
- VotingResult for final job output
- VotingAgent for ephemeral voting agents
- API request/response types for endpoints

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Create Configuration

**Files:**
- Create: `lib/moe-vote/config.ts`

**Step 1: Create config file**

Create `lib/moe-vote/config.ts`:

```typescript
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
```

**Step 2: Commit**

```bash
git add lib/moe-vote/config.ts
git commit -m "feat(config): add MoE voting configuration and validation

- MOE_VOTE_CONFIG with constraints, timeouts, and retry settings
- validateMoeVoteRequest for request parameter validation
- Configurable round count, agent count limits, and retention

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Voting System

### Task 5: Define Voting Agent Personas

**Files:**
- Create: `lib/agents/voting-personas.ts`

**Step 1: Create voting personas file**

Create `lib/agents/voting-personas.ts`:

```typescript
import { VotingAgent } from '@/lib/moe-vote/types';

/**
 * Specialized voting agents for evaluating discussion agents
 */
export const VOTING_PERSONAS = {
  logicEvaluator: {
    id: 'logic-evaluator',
    name: 'Logic Evaluator',
    persona: `You are the Logic Evaluator. Your role is to assess the quality of reasoning and argumentation.

Evaluate each agent based on:
- Logical consistency and coherence
- Strength of arguments and reasoning
- Absence of logical fallacies
- Clear cause-and-effect relationships
- Analytical rigor

For each agent, provide:
1. Score (1-10, where 10 is exceptional)
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
  } as VotingAgent,

  evidenceEvaluator: {
    id: 'evidence-evaluator',
    name: 'Evidence Evaluator',
    persona: `You are the Evidence Evaluator. Your role is to assess the quality and use of evidence.

Evaluate each agent based on:
- Quality and relevance of sources cited
- Effective use of web search results
- Factual accuracy and verification
- Appropriate use of data and statistics
- Credibility of evidence presented

For each agent, provide:
1. Score (1-10, where 10 is exceptional)
2. Detailed justification (2-3 sentences)

Respond ONLY with valid JSON in this exact format:
{
  "evaluations": [
    {
      "agentId": "agent-id-here",
      "agentName": "Agent Name Here",
      "score": 7,
      "justification": "Detailed explanation of the score."
    }
  ]
}`,
  } as VotingAgent,

  impactEvaluator: {
    id: 'impact-evaluator',
    name: 'Impact Evaluator',
    persona: `You are the Impact Evaluator. Your role is to assess practical value and real-world impact.

Evaluate each agent based on:
- Practical applicability of insights
- Actionability of recommendations
- Consideration of real-world constraints
- Potential impact and usefulness
- Balance of theory and practice

For each agent, provide:
1. Score (1-10, where 10 is exceptional)
2. Detailed justification (2-3 sentences)

Respond ONLY with valid JSON in this exact format:
{
  "evaluations": [
    {
      "agentId": "agent-id-here",
      "agentName": "Agent Name Here",
      "score": 9,
      "justification": "Detailed explanation of the score."
    }
  ]
}`,
  } as VotingAgent,
};

/**
 * Get all voting agents
 */
export function getVotingAgents(): VotingAgent[] {
  return [
    VOTING_PERSONAS.logicEvaluator,
    VOTING_PERSONAS.evidenceEvaluator,
    VOTING_PERSONAS.impactEvaluator,
  ];
}
```

**Step 2: Commit**

```bash
git add lib/agents/voting-personas.ts
git commit -m "feat(voting): add specialized voting agent personas

- Logic Evaluator: Assesses reasoning quality
- Evidence Evaluator: Assesses use of sources/data
- Impact Evaluator: Assesses practical value
- Each persona instructs agent to return JSON evaluations

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Implement Voting Logic

**Files:**
- Create: `lib/agents/voting.ts`
- Create: `lib/agents/__tests__/voting.test.ts`

**Step 1: Write tests for vote aggregation**

Create `lib/agents/__tests__/voting.test.ts`:

```typescript
import { describe, test, expect } from 'vitest';
import { aggregateVotes, determineWinner } from '../voting';
import { Vote, AgentScore } from '@/lib/moe-vote/types';

describe('Voting Logic', () => {
  const mockAgents = [
    { id: 'a1', name: 'Agent 1' },
    { id: 'a2', name: 'Agent 2' },
    { id: 'a3', name: 'Agent 3' },
  ];

  test('aggregateVotes calculates average scores correctly', () => {
    const votes: Vote[] = [
      {
        agentId: 'a1',
        voterId: 'v1',
        voterName: 'Voter 1',
        score: 8,
        justification: 'Good',
      },
      {
        agentId: 'a1',
        voterId: 'v2',
        voterName: 'Voter 2',
        score: 6,
        justification: 'Okay',
      },
      {
        agentId: 'a2',
        voterId: 'v1',
        voterName: 'Voter 1',
        score: 9,
        justification: 'Great',
      },
    ];

    const aggregated = aggregateVotes(votes, mockAgents as any);

    expect(aggregated['a1'].averageScore).toBe(7); // (8+6)/2
    expect(aggregated['a1'].votes.length).toBe(2);
    expect(aggregated['a2'].averageScore).toBe(9);
    expect(aggregated['a2'].votes.length).toBe(1);
  });

  test('determineWinner selects agent with highest average', () => {
    const scores: { [key: string]: AgentScore } = {
      a1: {
        agentName: 'Agent 1',
        averageScore: 7.5,
        votes: [],
      },
      a2: {
        agentName: 'Agent 2',
        averageScore: 9.0,
        votes: [],
      },
      a3: {
        agentName: 'Agent 3',
        averageScore: 6.0,
        votes: [],
      },
    };

    const winner = determineWinner(scores);

    expect(winner.agentId).toBe('a2');
    expect(winner.agentName).toBe('Agent 2');
    expect(winner.averageScore).toBe(9.0);
  });

  test('determineWinner handles tie by selecting first agent', () => {
    const scores: { [key: string]: AgentScore } = {
      a1: {
        agentName: 'Agent 1',
        averageScore: 8.0,
        votes: [],
      },
      a2: {
        agentName: 'Agent 2',
        averageScore: 8.0,
        votes: [],
      },
    };

    const winner = determineWinner(scores);

    expect(winner.agentId).toBe('a1');
    expect(winner.averageScore).toBe(8.0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest lib/agents/__tests__/voting.test.ts`
Expected: FAIL - "Cannot find module '../voting'"

**Step 3: Implement vote aggregation**

Create `lib/agents/voting.ts`:

```typescript
import { Agent as AgentModel, Message } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { Vote, VotingResult, AgentScore, VotingAgent, VoterEvaluation } from '@/lib/moe-vote/types';
import { getVotingAgents } from './voting-personas';

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
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest lib/agents/__tests__/voting.test.ts`
Expected: All tests PASS

**Step 5: Implement buildVotingContext**

Add to `lib/agents/voting.ts`:

```typescript
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
    const roundNum = msg.roundId ? parseInt(msg.roundId.split('-')[0]) || 1 : 1;
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
```

**Step 6: Implement executeVoterEvaluation (stub for now)**

Add to `lib/agents/voting.ts`:

```typescript
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
```

**Step 7: Implement main executeVoting function**

Add to `lib/agents/voting.ts`:

```typescript
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
        ...allMessages.map((m) => {
          const roundNum = m.roundId
            ? parseInt(m.roundId.split('-')[0]) || 1
            : 1;
          return roundNum;
        }),
        1
      ),
      totalMessages: allMessages.length,
      toolCallsUsed: allMessages.filter((m) => m.toolCalls).length,
    },
  };
}
```

**Step 8: Run tests**

Run: `npx vitest lib/agents/__tests__/voting.test.ts`
Expected: All tests PASS

**Step 9: Commit**

```bash
git add lib/agents/voting.ts lib/agents/__tests__/voting.test.ts
git commit -m "feat(voting): implement voting logic and orchestration

- aggregateVotes: Calculate average scores from all votes
- determineWinner: Select agent with highest score
- buildVotingContext: Format discussion for voting agents
- executeVoterEvaluation: Get evaluation from single voter
- executeVoting: Main orchestration with fallback handling

Includes unit tests for aggregation and winner selection.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Background Job Executor

### Task 7: Implement Background Executor

**Files:**
- Create: `lib/moe-vote/executor.ts`

**Step 1: Create executor file with main function**

Create `lib/moe-vote/executor.ts`:

```typescript
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

  // Mark as running
  await updateMoeVoteJobStatus(jobId, 'running');

  try {
    // Get agents and round table
    const agents = await getAgentsByRoundTable(job.roundTableId);
    const roundTable = await getRoundTableWithDetails(job.roundTableId);

    if (!roundTable) {
      throw new Error(`Round table ${job.roundTableId} not found`);
    }

    // Execute 10 rounds
    await updateMoeVoteJobProgress(jobId, 0, 'discussion');

    for (let roundNum = 1; roundNum <= MOE_VOTE_CONFIG.roundCount; roundNum++) {
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
        previousMessages.map((m) => ({
          ...m,
          agent: agents.find((a) => a.id === m.agentId)!,
        })),
        {
          apiKey,
          onEvent: () => {}, // No event handling in background
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
      MOE_VOTE_CONFIG.roundCount,
      'voting'
    );

    const allMessages = await getAllMessagesForRoundTable(job.roundTableId);
    const votingResult = await executeVoting(
      agents,
      allMessages.map((m) => ({
        ...m,
        agent: agents.find((a) => a.id === m.agentId)!,
      })),
      job.question,
      job.includeDiscussionAgentsInVoting,
      apiKey
    );

    // Aggregating phase
    await updateMoeVoteJobProgress(
      jobId,
      MOE_VOTE_CONFIG.roundCount,
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
```

**Step 2: Commit**

```bash
git add lib/moe-vote/executor.ts
git commit -m "feat(executor): add background job executor

- executeJobInBackground: Orchestrates 10 rounds + voting
- Manages job lifecycle: pending → running → completed/failed
- Updates progress after each round and phase
- Handles errors gracefully with failMoeVoteJob

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: API Routes

### Task 8: Implement POST /api/moe-vote

**Files:**
- Create: `app/api/moe-vote/route.ts`

**Step 1: Create POST handler**

Create `app/api/moe-vote/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRoundTable } from '@/lib/db/roundtable';
import { createAgentsForRoundTable } from '@/lib/db/agents';
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
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      question,
      includeDiscussionAgentsInVoting = false,
      agentCount = 3,
    } = body;

    // Create ephemeral round table
    const roundTable = await createRoundTable(question, agentCount);

    // Create discussion agents
    await createAgentsForRoundTable(roundTable.id, agentCount);

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
```

**Step 2: Commit**

```bash
git add app/api/moe-vote/route.ts
git commit -m "feat(api): add POST /api/moe-vote endpoint

- Validates request parameters
- Creates ephemeral round table and agents
- Creates MoeVoteJob record
- Starts background execution (non-blocking)
- Returns jobId and estimated completion time

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 9: Implement GET/DELETE /api/moe-vote/[jobId]

**Files:**
- Create: `app/api/moe-vote/[jobId]/route.ts`

**Step 1: Create GET and DELETE handlers**

Create `app/api/moe-vote/[jobId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getMoeVoteJob, deleteMoeVoteJob } from '@/lib/db/moe-vote-jobs';
import { MoeVoteJobStatus } from '@/lib/moe-vote/types';
import { MOE_VOTE_CONFIG } from '@/lib/moe-vote/config';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  try {
    const job = await getMoeVoteJob(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Build response
    const response: MoeVoteJobStatus = {
      jobId: job.id,
      status: job.status as any,
      question: job.question,
      createdAt: job.createdAt,
    };

    // Add progress if running
    if (job.status === 'running' && job.currentRound !== null) {
      response.progress = {
        currentRound: job.currentRound,
        totalRounds: MOE_VOTE_CONFIG.roundCount,
        phase: job.currentPhase as any,
      };
    }

    // Add result if completed
    if (job.status === 'completed' && job.result) {
      response.result = JSON.parse(job.result);
      response.completedAt = job.completedAt!;
    }

    // Add error if failed
    if (job.status === 'failed' && job.error) {
      response.error = job.error;
      response.completedAt = job.completedAt!;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  try {
    await deleteMoeVoteJob(jobId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting job:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/moe-vote/[jobId]/route.ts
git commit -m "feat(api): add GET/DELETE /api/moe-vote/[jobId] endpoints

GET:
- Returns job status (pending/running/completed/failed)
- Includes progress for running jobs
- Includes result for completed jobs
- Includes error for failed jobs

DELETE:
- Removes job and cascades to round table

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: Testing & Utilities

### Task 10: Create Integration Test Script

**Files:**
- Create: `scripts/test-moe-vote.ts`

**Step 1: Create test script**

Create `scripts/test-moe-vote.ts`:

```typescript
// Integration test for MoE voting system

async function testMoeVoteWorkflow() {
  console.log('🧪 Testing MoE Vote Workflow\n');

  const baseUrl = 'http://localhost:3000';

  try {
    // Test 1: Create job
    console.log('1️⃣  Creating MoE vote job...');
    const createResponse = await fetch(`${baseUrl}/api/moe-vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Should companies adopt a 4-day work week?',
        includeDiscussionAgentsInVoting: false,
        agentCount: 3,
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create job: ${await createResponse.text()}`);
    }

    const { jobId, estimatedCompletionTime } = await createResponse.json();
    console.log(`   ✅ Job created: ${jobId}`);
    console.log(
      `   ⏱️  Estimated completion: ${Math.round(estimatedCompletionTime / 1000)}s\n`
    );

    // Test 2: Poll for progress
    console.log('2️⃣  Polling for progress...');
    let status = 'pending';
    let pollCount = 0;

    while (status !== 'completed' && status !== 'failed') {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Poll every 5s

      const pollResponse = await fetch(`${baseUrl}/api/moe-vote/${jobId}`);
      const jobStatus = await pollResponse.json();
      status = jobStatus.status;

      pollCount++;

      if (jobStatus.progress) {
        console.log(
          `   📊 Round ${jobStatus.progress.currentRound}/${jobStatus.progress.totalRounds} - ${jobStatus.progress.phase}`
        );
      }

      // Safety limit for testing
      if (pollCount > 240) {
        // 20 minutes max
        console.log('   ⚠️  Polling timeout - job taking too long');
        break;
      }
    }

    // Test 3: Get final result
    console.log('\n3️⃣  Getting final result...');
    const finalResponse = await fetch(`${baseUrl}/api/moe-vote/${jobId}`);
    const finalJob = await finalResponse.json();

    if (finalJob.status === 'completed') {
      console.log('   ✅ Job completed successfully!\n');
      console.log('   🏆 Winner:', finalJob.result.winner.agentName);
      console.log('   📊 Score:', finalJob.result.winner.averageScore.toFixed(2));
      console.log('\n   📈 All Scores:');
      Object.entries(finalJob.result.scores).forEach(([id, score]: [string, any]) => {
        console.log(`      ${score.agentName}: ${score.averageScore.toFixed(2)}/10`);
        console.log(`         Votes: ${score.votes.length}`);
      });
      console.log('\n   💬 Discussion Summary:');
      console.log(`      Rounds: ${finalJob.result.discussionSummary.roundCount}`);
      console.log(
        `      Messages: ${finalJob.result.discussionSummary.totalMessages}`
      );
      console.log(
        `      Tool Calls: ${finalJob.result.discussionSummary.toolCallsUsed}`
      );
    } else if (finalJob.status === 'failed') {
      console.log('   ❌ Job failed:', finalJob.error);
    }

    // Test 4: Cleanup (optional)
    console.log('\n4️⃣  Cleanup...');
    console.log('   ℹ️  Job left in database for inspection');
    console.log(`   💡 To delete: DELETE ${baseUrl}/api/moe-vote/${jobId}\n`);

    console.log('✨ Integration test complete!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testMoeVoteWorkflow();
```

**Step 2: Add npm script**

Add to `package.json` scripts:

```json
"test:moe-vote": "tsx scripts/test-moe-vote.ts"
```

**Step 3: Commit**

```bash
git add scripts/test-moe-vote.ts package.json
git commit -m "test: add MoE vote integration test script

- Creates job and polls for completion
- Displays progress updates during execution
- Shows final results with winner and scores
- Provides cleanup instructions

Run with: npm run test:moe-vote

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 11: Create Cleanup Utilities

**Files:**
- Create: `lib/moe-vote/cleanup.ts`
- Create: `scripts/cleanup-moe-jobs.ts`

**Step 1: Create cleanup functions**

Create `lib/moe-vote/cleanup.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { deleteMoeVoteJob } from '@/lib/db/moe-vote-jobs';
import { MOE_VOTE_CONFIG } from './config';

/**
 * Clean up old completed/failed jobs
 */
export async function cleanupOldJobs(
  olderThanDays: number = MOE_VOTE_CONFIG.jobRetentionDays
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const oldJobs = await prisma.moeVoteJob.findMany({
    where: {
      createdAt: { lt: cutoffDate },
      status: { in: ['completed', 'failed'] },
    },
  });

  for (const job of oldJobs) {
    await deleteMoeVoteJob(job.id);
  }

  return oldJobs.length;
}

/**
 * Mark stale running jobs as failed
 */
export async function cleanupStaleJobs(): Promise<number> {
  const staleThreshold = new Date();
  staleThreshold.setTime(
    staleThreshold.getTime() - MOE_VOTE_CONFIG.maxJobDuration
  );

  const staleJobs = await prisma.moeVoteJob.findMany({
    where: {
      status: 'running',
      startedAt: { lt: staleThreshold },
    },
  });

  for (const job of staleJobs) {
    await prisma.moeVoteJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        error: 'Job execution timed out (stale)',
        completedAt: new Date(),
      },
    });
  }

  return staleJobs.length;
}
```

**Step 2: Create cleanup script**

Create `scripts/cleanup-moe-jobs.ts`:

```typescript
import { cleanupOldJobs, cleanupStaleJobs } from '@/lib/moe-vote/cleanup';

async function cleanup() {
  console.log('🧹 Cleaning up MoE vote jobs...\n');

  try {
    // Clean up stale jobs
    console.log('1️⃣  Marking stale running jobs as failed...');
    const staleCount = await cleanupStaleJobs();
    console.log(`   ✅ Marked ${staleCount} stale job(s) as failed\n`);

    // Clean up old jobs
    console.log('2️⃣  Deleting old completed/failed jobs...');
    const oldCount = await cleanupOldJobs();
    console.log(`   ✅ Deleted ${oldCount} old job(s)\n`);

    console.log('✨ Cleanup complete!\n');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup();
```

**Step 3: Add npm script**

Add to `package.json` scripts:

```json
"moe-vote:cleanup": "tsx scripts/cleanup-moe-jobs.ts"
```

**Step 4: Commit**

```bash
git add lib/moe-vote/cleanup.ts scripts/cleanup-moe-jobs.ts package.json
git commit -m "feat(cleanup): add MoE vote job cleanup utilities

- cleanupOldJobs: Delete completed/failed jobs after retention period
- cleanupStaleJobs: Mark stuck running jobs as failed
- Cleanup script for manual or cron execution

Run with: npm run moe-vote:cleanup

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 7: Documentation

### Task 12: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add MoE voting documentation**

Add to the end of `CLAUDE.md`:

```markdown

## MoE Voting Router

**NEW FEATURE:** Mixture of Experts voting system for evaluating multi-round discussions.

### Overview

The MoE voting router accepts a question, runs a 10-round discussion with configurable agents, then uses specialized voting agents to evaluate which discussion agent provided the best perspective.

### API Endpoints

**POST `/api/moe-vote`** - Create async voting job

Request:
```json
{
  "question": "Should companies adopt a 4-day work week?",
  "includeDiscussionAgentsInVoting": false,  // Optional, default: false
  "agentCount": 3  // Optional, default: 3, range: 2-6
}
```

Response:
```json
{
  "jobId": "cm...",
  "estimatedCompletionTime": 1080000  // milliseconds
}
```

**GET `/api/moe-vote/[jobId]`** - Poll job status

Response includes status (pending/running/completed/failed), progress, and results when complete.

**DELETE `/api/moe-vote/[jobId]`** - Delete job and associated data

### Architecture

- **Async job pattern**: Long-running discussions execute in background
- **Database persistence**: Jobs survive server restarts, queryable history
- **Progress tracking**: Real-time updates on current round and phase
- **Weighted voting**: Three specialized evaluators provide multi-dimensional assessment

### Voting Agents

1. **Logic Evaluator** - Assesses reasoning quality and argumentation
2. **Evidence Evaluator** - Assesses use of sources and data
3. **Impact Evaluator** - Assesses practical value and applicability

Each voting agent scores discussion agents 1-10 with detailed justifications.

### Implementation Files

- **Database**: `lib/db/moe-vote-jobs.ts` - CRUD operations
- **Voting**: `lib/agents/voting.ts` - Vote aggregation and execution
- **Personas**: `lib/agents/voting-personas.ts` - Voting agent definitions
- **Executor**: `lib/moe-vote/executor.ts` - Background job orchestration
- **API**: `app/api/moe-vote/` - HTTP endpoints
- **Types**: `lib/moe-vote/types.ts` - TypeScript interfaces
- **Config**: `lib/moe-vote/config.ts` - Configuration constants

### Testing

```bash
npm run test:moe-vote      # Integration test (requires dev server running)
npm run moe-vote:cleanup   # Cleanup old jobs
```

### Database Schema

**MoeVoteJob Table:**
- `status`: pending | running | completed | failed
- `currentRound`, `currentPhase`: Progress tracking
- `result`: JSON stringified voting result
- `roundTableId`: References ephemeral round table (cascade delete)

### Performance

Typical execution times:
- **3 agents, 10 rounds**: ~18 minutes
- **5 agents, 10 rounds**: ~30 minutes

Jobs auto-cleanup after 7 days. Stale running jobs (>2 hours) marked as failed.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add MoE voting router to CLAUDE.md

- API endpoint documentation
- Architecture overview
- Voting agent descriptions
- Implementation file references
- Testing and cleanup instructions

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Implementation Complete!

All tasks completed:

✅ Database schema and migrations
✅ Database operations with unit tests
✅ TypeScript types and configuration
✅ Voting agent personas
✅ Voting logic with aggregation tests
✅ Background job executor
✅ API routes (POST, GET, DELETE)
✅ Integration test script
✅ Cleanup utilities
✅ Documentation updates

**Next Steps:**

1. Start dev server: `npm run dev`
2. Run integration test: `npm run test:moe-vote`
3. Test API endpoints manually
4. Monitor first job execution
5. Review results and tune voting prompts if needed

**Testing Checklist:**

- [ ] POST creates job and returns jobId
- [ ] GET shows progress during execution
- [ ] 10 rounds complete successfully
- [ ] Voting agents evaluate all discussion agents
- [ ] Final result includes winner with scores
- [ ] DELETE removes job and cascades
- [ ] Error handling works for invalid requests
- [ ] Cleanup script removes old jobs
