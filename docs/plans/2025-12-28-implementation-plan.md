# Implementation Plan - Round Table Web App

**Based on**: [2025-12-28-round-table-design.md](./2025-12-28-round-table-design.md)
**Created**: 2025-12-28
**Status**: Ready to implement

## Overview

This implementation plan breaks down the Round Table design into actionable development tasks. Tasks are organized by phase and include specific file paths and implementation details.

---

## Phase 1: Foundation ✅ COMPLETE

### 1.1 Project Setup
- [x] Initialize Next.js 15 with TypeScript and Tailwind
- [x] Set up Prisma with SQLite
- [x] Create database schema (RoundTable, Agent, Round, Message models)
- [x] Run initial migration
- [x] Install Agent SDK: `@anthropic-ai/claude-agent-sdk`
- [x] Create base directory structure
- [x] Add environment variables template

### Files Created
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `app/layout.tsx` - Root layout
- `app/page.tsx` - Homepage placeholder
- `app/globals.css` - Global styles
- `prisma/schema.prisma` - Database models
- `lib/prisma.ts` - Prisma client singleton
- `lib/personas.ts` - Default persona definitions
- `.env.example` - Environment variable template
- `README.md` - Project documentation

---

## Phase 2: Core Database Operations

### 2.1 Database Helper Functions

**File**: `lib/db/roundtable.ts`
```typescript
// Functions to implement:
- createRoundTable(topic, agentCount, customPersonas)
- getRoundTable(id)
- getAllRoundTables()
- updateRoundTableStatus(id, status)
- deleteRoundTable(id)
```

**File**: `lib/db/agents.ts`
```typescript
// Functions to implement:
- createAgents(roundTableId, personas)
- getAgentsByRoundTable(roundTableId)
- getAgent(id)
```

**File**: `lib/db/rounds.ts`
```typescript
// Functions to implement:
- createRound(roundTableId, roundNumber)
- getRound(id)
- getRoundsByRoundTable(roundTableId)
- updateRoundStatus(id, status)
- getLatestRound(roundTableId)
```

**File**: `lib/db/messages.ts`
```typescript
// Functions to implement:
- createMessage(roundId, agentId, content, toolCalls)
- getMessagesByRound(roundId)
- getMessagesByAgent(agentId)
```

### 2.2 Type Definitions

**File**: `lib/types.ts`
```typescript
// Types to export:
- RoundTable, Agent, Round, Message (from Prisma)
- CreateRoundTableInput
- AgentPersona
- ToolCall
- StreamEventType
```

---

## Phase 3: Agent SDK Integration

### 3.1 Agent Configuration

**File**: `lib/agents/config.ts`
```typescript
// Functions to implement:
- buildAgentSystemPrompt(persona, topic)
- createAgentConfig(name, persona, tools)
- getAvailableTools() // Returns web search tool config
```

### 3.2 Agent Execution

**File**: `lib/agents/executor.ts`
```typescript
// Functions to implement:
- executeAgentTurn(agent, context, tools)
- streamAgentResponse(agent, context, tools)
- parseToolCalls(response)
- buildAgentContext(roundTable, agent, previousMessages)
```

### 3.3 Round Orchestration

**File**: `lib/agents/orchestrator.ts`
```typescript
// Functions to implement:
- runRound(roundTable, agents)
- executeSequentialAgents(agents, context)
- handleToolCall(toolCall, agent)
- streamRoundToClient(roundTable, agents, responseStream)
```

### 3.4 Web Search Tool

**File**: `lib/agents/tools/websearch.ts`
```typescript
// Functions to implement:
- createWebSearchTool()
- performWebSearch(query)
- formatSearchResults(results)
```

---

## Phase 4: API Routes

### 4.1 Create Round Table

**File**: `app/api/roundtable/route.ts` (POST)
```typescript
// Implementation:
1. Validate input (topic, agentCount, customPersonas)
2. Get default personas or use custom ones
3. Create RoundTable in database
4. Create Agent records
5. Return created round table with agents
```

### 4.2 Get Round Table

**File**: `app/api/roundtable/[id]/route.ts` (GET)
```typescript
// Implementation:
1. Fetch round table by ID
2. Include agents and rounds with messages
3. Return complete round table data
```

### 4.3 Start Next Round (with SSE)

**File**: `app/api/roundtable/[id]/round/route.ts` (POST)
```typescript
// Implementation:
1. Validate round table exists and is active
2. Get latest round number, create new round
3. Get agents for this round table
4. Set up Server-Sent Events stream
5. Execute round using orchestrator
6. Stream events: agent-start, chunk, tool-call, agent-complete, round-complete
7. Save messages to database
8. Update round status to completed
```

### 4.4 Update Round Table Status

**File**: `app/api/roundtable/[id]/route.ts` (PATCH)
```typescript
// Implementation:
1. Validate status (active/paused/archived)
2. Update round table status
3. Return updated round table
```

### 4.5 List All Round Tables

**File**: `app/api/roundtable/route.ts` (GET)
```typescript
// Implementation:
1. Fetch all round tables with agent counts and round counts
2. Support optional filtering by status
3. Return paginated list
```

---

## Phase 5: Frontend Components

### 5.1 Home Page - Create Round Table Form

**File**: `components/RoundTableForm.tsx`
```typescript
// Component to implement:
- Topic input (textarea)
- Agent count selector (2-6)
- Agent persona customization (expandable)
  - Show selected number of default personas
  - Allow editing name and system prompt
- Form validation
- Submit handler (call POST /api/roundtable)
- Redirect to discussion view
```

**File**: `components/PersonaEditor.tsx`
```typescript
// Component to implement:
- List of personas with edit controls
- Name field
- Description field
- System prompt field (textarea)
- Add/remove persona (if custom)
```

### 5.2 Discussion View

**File**: `app/roundtable/[id]/page.tsx`
```typescript
// Page to implement:
- Fetch round table data (GET /api/roundtable/[id])
- Display topic and metadata
- Show DiscussionView component
- Handle "Continue" button click
```

**File**: `components/DiscussionView.tsx`
```typescript
// Component to implement:
- Header: topic, round number, status
- MessageList component
- Controls: Continue, Pause, Archive buttons
- SSE connection for real-time updates
- Loading states
```

**File**: `components/MessageList.tsx`
```typescript
// Component to implement:
- Scrollable message container
- Render MessageBubble for each message
- Auto-scroll to latest message
- Group messages by round (optional)
```

**File**: `components/MessageBubble.tsx`
```typescript
// Component to implement:
- Agent name and persona badge
- Message timestamp
- Message content (markdown rendering)
- Tool calls display (search queries, results)
- Styling for different agents
```

**File**: `components/AgentIndicator.tsx`
```typescript
// Component to implement:
- Show which agent is currently thinking
- Animated indicator
- "Agent X is thinking..." message
- Tool call progress (if agent is searching)
```

### 5.3 History Page

**File**: `app/history/page.tsx`
```typescript
// Page to implement:
- Fetch all round tables (GET /api/roundtable)
- Display list with RoundTableList component
- Search/filter by topic
```

**File**: `components/RoundTableList.tsx`
```typescript
// Component to implement:
- List/grid of round tables
- Show: topic, agent count, rounds, status
- Resume/View buttons
- Delete/Archive buttons
- Empty state
```

**File**: `components/RoundTableCard.tsx`
```typescript
// Component to implement:
- Single round table card
- Topic (truncated if long)
- Metadata badges (agent count, rounds)
- Status indicator
- Action buttons
```

---

## Phase 6: Real-time Streaming

### 6.1 SSE Hook

**File**: `lib/hooks/useRoundStream.ts`
```typescript
// Hook to implement:
- Connect to SSE endpoint
- Handle different event types
- Provide state updates to components
- Auto-reconnect on disconnect
- Cleanup on unmount
```

### 6.2 Stream Event Types

**File**: `lib/types.ts` (add)
```typescript
// Types to define:
type StreamEventType =
  | 'agent-start'
  | 'chunk'
  | 'tool-call'
  | 'agent-complete'
  | 'round-complete'
  | 'error';

interface StreamEvent {
  type: StreamEventType;
  data: any;
}
```

### 6.3 Stream UI Components

**File**: `components/StreamingMessage.tsx`
```typescript
// Component to implement:
- Display message as it streams in
- Show typing indicator
- Append chunks progressively
- Handle tool calls specially
- Mark as complete when done
```

---

## Phase 7: Styling & UX Polish

### 7.1 Styling Tasks

- [ ] Implement responsive design (mobile, tablet, desktop)
- [ ] Add dark mode support (if desired)
- [ ] Create color scheme for different agent personas
- [ ] Add animations for:
  - Message appearance
  - Agent thinking indicator
  - Tool call visualization
  - Round completion
- [ ] Implement loading skeletons
- [ ] Add error state UI
- [ ] Create success notifications (toast)

### 7.2 Accessibility

- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Focus management
- [ ] ARIA labels

---

## Phase 8: Error Handling & Edge Cases

### 8.1 Error Handling Implementation

**File**: `lib/errors.ts`
```typescript
// Custom error classes:
- RoundTableError
- AgentExecutionError
- StreamConnectionError
```

### 8.2 Error UI Components

**File**: `components/ErrorBoundary.tsx`
```typescript
// Component to implement:
- Catch errors in discussion view
- Show friendly error message
- Offer retry/skip options
```

**File**: `components/ErrorMessage.tsx`
```typescript
// Component to implement:
- Display error messages
- Retry button
- Skip agent button (for round execution)
- Report bug link
```

### 8.3 Edge Case Handling

- [ ] Handle browser close mid-round (round stays "in_progress")
- [ ] Prevent concurrent round starts (optimistic locking)
- [ ] Handle network reconnection gracefully
- [ ] Validate agent count (2-6 range)
- [ ] Validate topic not empty
- [ ] Rate limiting for API calls (optional)

---

## Phase 9: Testing

### 9.1 Unit Tests

**Files to test:**
- `lib/db/*.ts` - Database operations
- `lib/personas.ts` - Persona generation
- `lib/agents/*.ts` - Agent logic (with mocked SDK)

### 9.2 Integration Tests

- `app/api/roundtable/route.test.ts` - API routes
- Test database transactions
- Test Agent SDK integration (mocked)

### 9.3 E2E Tests (Optional)

- Create round table flow
- Run a round flow
- View history flow

---

## Phase 10: Deployment & Documentation

### 10.1 Deployment Prep

- [ ] Update README with deployment instructions
- [ ] Add production environment variables
- [ ] Create production build
- [ ] Test production build locally

### 10.2 Performance Optimization

- [ ] Database query optimization
- [ ] Add database indexes (already in schema)
- [ ] Implement caching for round table list
- [ ] Optimize bundle size
- [ ] Add image optimization (if any images)

### 10.3 Security

- [ ] Validate all user inputs
- [ ] Sanitize message content
- [ ] Rate limiting on API routes
- [ ] CORS configuration (if needed)
- [ ] API key security (never expose in frontend)

---

## Development Workflow

### Daily Workflow

1. Pick a task from the implementation plan
2. Create/update the necessary files
3. Test locally: `npm run dev`
4. Run linting: `npm run lint`
5. Commit changes with descriptive message
6. Test complete features end-to-end

### Commit Convention

```
feat: add round table creation form
fix: handle SSE reconnection
docs: update API documentation
refactor: extract agent logic to separate module
test: add integration tests for API routes
```

### Testing Commands

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint

# Run tests (when configured)
npm test

# Database operations
npx prisma studio          # Open Prisma Studio
npx prisma migrate dev     # Create and apply migration
npx prisma generate        # Generate Prisma Client
```

---

## Priority Order for Implementation

### High Priority (MVP)
1. ✅ Phase 1: Foundation
2. **Phase 2: Core Database Operations**
3. **Phase 3: Agent SDK Integration**
4. **Phase 4: API Routes** (Focus on create round table and start round)
5. **Phase 5: Frontend Components** (Focus on form and discussion view)
6. **Phase 6: Real-time Streaming**

### Medium Priority (Essential)
7. **Phase 8: Error Handling**
8. **Phase 7: Styling & UX Polish**

### Low Priority (Enhancement)
9. **Phase 9: Testing**
10. **Phase 10: Deployment & Documentation**

---

## Next Steps

Start with **Phase 2: Core Database Operations** by creating the database helper functions in `lib/db/`. This will provide the foundation for all data operations throughout the application.

Good luck with the implementation! 🚀
