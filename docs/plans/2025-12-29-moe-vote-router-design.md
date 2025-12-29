# MoE Voting Router Design

**Date:** 2025-12-29
**Status:** Approved
**Type:** New Feature

## Overview

A Mixture of Experts (MoE) style voting system that accepts a question, runs a 10-round round table discussion, then uses specialized voting agents to evaluate which discussion agent provided the most valuable perspective.

## User Flow

1. Client POSTs question to `/api/moe-vote`
2. Server creates async job, returns `jobId` immediately
3. Background process runs 10 rounds of discussion with 3-6 agents
4. Three specialized voting agents evaluate all discussion agents
5. Client polls `/api/moe-vote/[jobId]` for status and results
6. Final result shows winning agent with scores and justifications

## Architecture

### API Endpoints

#### POST `/api/moe-vote`

Creates and starts a new MoE voting job.

**Request:**
```typescript
{
  question: string;                          // Required, 10-1000 chars
  includeDiscussionAgentsInVoting?: boolean; // Default: false
  agentCount?: number;                       // Default: 3, range: 2-6
}
```

**Response:**
```typescript
{
  jobId: string;
  estimatedCompletionTime: number; // milliseconds
}
```

#### GET `/api/moe-vote/[jobId]`

Polls job status and retrieves results when complete.

**Response:**
```typescript
{
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  question: string;
  createdAt: Date;
  progress?: {
    currentRound: number;
    totalRounds: 10;
    phase: "discussion" | "voting" | "aggregating";
  };
  result?: {
    winner: {
      agentId: string;
      agentName: string;
      averageScore: number; // 1-10
    };
    scores: {
      [agentId: string]: {
        agentName: string;
        averageScore: number;
        votes: Array<{
          voterId: string;
          voterName: string;
          score: number; // 1-10
          justification: string;
        }>;
      };
    };
    discussionSummary: {
      roundCount: 10;
      totalMessages: number;
      toolCallsUsed: number;
    };
  };
  error?: string;
  completedAt?: Date;
}
```

#### DELETE `/api/moe-vote/[jobId]`

Deletes job and all associated data (round table, agents, rounds, messages).

**Response:**
```typescript
{ success: true }
```

### Database Schema

**New Table: MoeVoteJob**

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

**Update to RoundTable:**
```prisma
model RoundTable {
  // ... existing fields ...
  moeVoteJob  MoeVoteJob?
}
```

### Voting System

**Three Specialized Voting Agents:**

1. **Logic Evaluator** - Assesses reasoning quality
   - Logical consistency and coherence
   - Strength of arguments
   - Absence of logical fallacies
   - Analytical rigor

2. **Evidence Evaluator** - Assesses use of evidence
   - Quality and relevance of sources
   - Effective use of web search
   - Factual accuracy
   - Data and statistics usage

3. **Impact Evaluator** - Assesses practical value
   - Practical applicability
   - Actionability of recommendations
   - Real-world constraints consideration
   - Balance of theory and practice

**Voting Process:**

1. Each voting agent receives full discussion transcript (all 10 rounds)
2. Agent evaluates each discussion agent separately
3. Provides score (1-10) + detailed justification (2-3 sentences)
4. Responds in structured JSON format
5. Scores aggregated across all voters
6. Winner determined by highest average score

**Optional: Discussion Agents as Voters**

When `includeDiscussionAgentsInVoting: true`:
- Discussion agents also evaluate their peers
- Agents cannot vote for themselves
- Total voters = discussion agents + 3 specialized evaluators
- Provides more comprehensive evaluation with domain context

### Background Execution Flow

```
POST /api/moe-vote
  ↓
Create RoundTable + Agents
  ↓
Create MoeVoteJob (status: "pending")
  ↓
Start background executor (non-blocking)
  ↓
Return jobId immediately

[Background Process]
  ↓
Update status to "running"
  ↓
For rounds 1-10:
  - Update progress (currentRound, phase: "discussion")
  - Create Round
  - Execute agents sequentially
  - Save messages
  - Complete round
  ↓
Update phase to "voting"
  ↓
Create voting agents (ephemeral)
  ↓
Each voter evaluates all discussion agents
  ↓
Parse JSON responses (scores + justifications)
  ↓
Update phase to "aggregating"
  ↓
Aggregate scores, determine winner
  ↓
Save result, update status to "completed"
```

## Implementation Plan

### Phase 1: Database Layer

**Files to create:**
- `prisma/migrations/XXX_add_moe_vote_job.sql`
- `lib/db/moe-vote-jobs.ts`

**Operations:**
- `createMoeVoteJob()`
- `getMoeVoteJob()`
- `updateMoeVoteJobStatus()`
- `updateMoeVoteJobProgress()`
- `completeMoeVoteJob()`
- `failMoeVoteJob()`
- `deleteMoeVoteJob()`
- `cleanupOldJobs()`
- `cleanupStaleJobs()`

### Phase 2: Voting Logic

**Files to create:**
- `lib/agents/voting-personas.ts` - Voting agent definitions
- `lib/agents/voting.ts` - Voting execution logic
- `lib/moe-vote/types.ts` - TypeScript types
- `lib/moe-vote/config.ts` - Configuration constants

**Core functions:**
- `executeVoting()` - Main voting orchestration
- `executeVoterEvaluation()` - Single voter's evaluation
- `buildVotingContext()` - Format discussion for voting
- `aggregateVotes()` - Calculate average scores
- `determineWinner()` - Select winning agent

### Phase 3: Background Executor

**Files to create:**
- `lib/moe-vote/executor.ts`

**Core function:**
- `executeJobInBackground()` - Runs 10 rounds + voting

**Responsibilities:**
- Manage job lifecycle (pending → running → completed/failed)
- Execute 10 discussion rounds sequentially
- Execute voting phase
- Update progress after each step
- Handle errors gracefully

### Phase 4: API Routes

**Files to create:**
- `app/api/moe-vote/route.ts` - POST handler
- `app/api/moe-vote/[jobId]/route.ts` - GET/DELETE handlers

**POST handler:**
- Validate request
- Create round table + agents
- Create job record
- Start background execution
- Return jobId

**GET handler:**
- Fetch job by ID
- Return status + progress + result

**DELETE handler:**
- Delete job (cascades to round table)

### Phase 5: Testing & Utilities

**Files to create:**
- `scripts/test-moe-vote.ts` - Integration test
- `scripts/cleanup-moe-jobs.ts` - Cleanup utility
- `lib/moe-vote/__tests__/voting.test.ts` - Unit tests
- `lib/moe-vote/cleanup.ts` - Cleanup functions

## Error Handling

### Validation Errors (400)
- Missing/empty question
- Question too short (<10 chars) or too long (>1000 chars)
- Invalid agent count (not 2-6)

### Server Errors (500)
- Missing ANTHROPIC_API_KEY
- Database errors
- Anthropic API errors

### Job Failures
- API rate limiting → Retry with exponential backoff (3 attempts)
- Invalid JSON from voting agent → Fallback: score=5, generic justification
- Round execution failure → Mark job as failed, save error
- Server restart during execution → Stale job detection (>2 hours)

### Cleanup Strategy
- **Completed/failed jobs:** Delete after 7 days
- **Stale jobs:** Mark as failed if running >2 hours
- **Cascade deletion:** Job deletion removes RoundTable + all related data

## Configuration

```typescript
export const MOE_VOTE_CONFIG = {
  // Constraints
  questionMinLength: 10,
  questionMaxLength: 1000,
  agentCountMin: 2,
  agentCountMax: 6,
  roundCount: 10, // Fixed

  // Timeouts
  maxJobDuration: 2 * 60 * 60 * 1000, // 2 hours
  agentTurnTimeout: 60000, // 1 minute
  votingTimeout: 5 * 60 * 1000, // 5 minutes

  // Retry
  maxRetries: 3,
  retryDelay: 1000,
  retryBackoffMultiplier: 2,

  // Cleanup
  jobRetentionDays: 7,
};
```

## Performance Estimates

**3 agents, 10 rounds:**
- Discussion: ~15 minutes (3 agents × 10 rounds × 30s/turn)
- Voting: ~3 minutes (3 voters × 3 agents × ~20s)
- **Total: ~18 minutes**

**5 agents, 10 rounds:**
- Discussion: ~25 minutes (5 agents × 10 rounds × 30s/turn)
- Voting: ~5 minutes (3 voters × 5 agents × ~20s)
- **Total: ~30 minutes**

## Testing Strategy

1. **Unit tests** - Voting aggregation, winner determination
2. **Integration test** - Full workflow (create → poll → verify → cleanup)
3. **Error tests** - Invalid requests, API failures, job cleanup
4. **Load test** - Multiple concurrent jobs

## Future Enhancements

- **Configurable round count** - Allow 5, 10, or 15 rounds
- **Custom voting agents** - User-provided voting personas
- **Streaming option** - SSE stream alongside polling for real-time updates
- **Job queue** - Bull/BullMQ for better concurrency control
- **Result caching** - Cache identical questions for 24 hours
- **Analytics** - Track which agents win most often, average scores
- **Export** - Download full discussion + voting results as PDF/JSON

## Success Criteria

✅ POST creates job and returns within <100ms
✅ Background execution completes 10 rounds + voting successfully
✅ Polling shows accurate progress updates
✅ Final result includes winner with scores and justifications
✅ Error handling gracefully handles API failures
✅ Cleanup removes old jobs automatically
✅ Integration test passes end-to-end

## Risks & Mitigations

**Risk:** Long execution time (18-30 minutes)
**Mitigation:** Async polling pattern, progress updates, clear time estimates

**Risk:** Server restart kills in-progress jobs
**Mitigation:** Stale job detection, mark as failed, user can retry

**Risk:** API rate limiting
**Mitigation:** Exponential backoff, max 3 retries, fail gracefully

**Risk:** Invalid JSON from voting agents
**Mitigation:** Strict JSON parsing, fallback scores, logging for debugging

**Risk:** Database growth from job history
**Mitigation:** Auto-cleanup after 7 days, cascade deletion

## Conclusion

This MoE voting router provides a scalable, async solution for running multi-round discussions with expert evaluation. It reuses existing round table infrastructure, adds minimal new code, and handles edge cases gracefully. The weighted voting system provides rich, multi-dimensional assessment of agent performance.
