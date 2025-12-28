# Round Table Web App - Design Document

**Date**: 2025-12-28
**Status**: Approved Design

## Overview

A web application that facilitates multi-agent AI discussions on user-defined topics. Users create "round tables" with a topic and specified number of Claude agents, each with distinct personas. Agents discuss the topic sequentially in rounds, building on previous context, with real-time streaming responses.

## Core Concept

- Users start a round table with a topic and choose number of agents (2-6)
- Each agent has a distinct persona (Devil's Advocate, Optimist, Pragmatist, etc.)
- Agents discuss sequentially: Agent 1 → Agent 2 → Agent 3 → back to Agent 1
- Each complete cycle = one round
- User clicks "Continue" to start next round
- Agents have access to web search tools to support their arguments with data
- Full discussion history is persisted and resumable

## Tech Stack

- **Frontend**: Next.js 14+ (App Router) with React Server Components and Client Components
- **Database**: SQLite with Prisma ORM
- **AI**: Claude Agent SDK (TypeScript) for multi-agent orchestration
- **Real-time**: Server-Sent Events (SSE) for streaming agent responses
- **Tools**: Web search tool integration for evidence-based discussions

## Architecture

```
User Browser (Next.js Client)
    ↓
Next.js API Routes (Backend)
    ↓
Agent Orchestrator (Agent SDK)
    ↓
Individual Claude Agents (with personas + web search tool)
    ↓↓
    ↓↓→ Web Search Tool (for fact-checking/research)
    ↓
Anthropic Claude API
```

### Three-Tier Architecture

1. **Presentation Layer**: Next.js pages and React components
2. **API Layer**: Next.js API routes handle HTTP requests, manage agents
3. **Data Layer**: Prisma + SQLite stores round tables, rounds, messages, agent configurations

### Agent SDK Integration

- Each Round Table creates an Agent SDK "team" with configured agents
- Each agent has:
  - System prompt defining their persona
  - Web search tool for gathering supporting evidence
  - Full discussion context (all previous rounds)
- Agent SDK handles context management automatically
- Agents can invoke web search mid-response when they need data

## Database Schema (Prisma Models)

### RoundTable
```prisma
model RoundTable {
  id          String   @id @default(cuid())
  topic       String
  agentCount  Int
  status      String   // "active" | "paused" | "archived"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  agents      Agent[]
  rounds      Round[]
}
```

### Agent
```prisma
model Agent {
  id            String      @id @default(cuid())
  roundTableId  String
  name          String
  persona       String      // System prompt
  order         Int         // Turn order (1, 2, 3...)

  roundTable    RoundTable  @relation(fields: [roundTableId], references: [id])
  messages      Message[]
}
```

### Round
```prisma
model Round {
  id            String      @id @default(cuid())
  roundTableId  String
  roundNumber   Int
  status        String      // "in_progress" | "completed"
  createdAt     DateTime    @default(now())
  completedAt   DateTime?

  roundTable    RoundTable  @relation(fields: [roundTableId], references: [id])
  messages      Message[]
}
```

### Message
```prisma
model Message {
  id          String   @id @default(cuid())
  roundId     String
  agentId     String
  content     String
  toolCalls   String?  // JSON array of web searches performed
  createdAt   DateTime @default(now())

  round       Round    @relation(fields: [roundId], references: [id])
  agent       Agent    @relation(fields: [agentId], references: [id])
}
```

**Schema Features:**
- Full persistence of all discussions
- Tracks agent personas and turn order
- Stores tool calls (web searches) for transparency
- Supports resumable discussions via status fields

## User Flow

### 1. Create Round Table

**Page**: `/` (home)

**Interface**:
- "New Round Table" button
- Form with:
  - Topic input (text area)
  - Agent count selector (2-6 agents, default 3)
  - Agent persona customization (expandable)
    - Default personas: Devil's Advocate, Optimist, Pragmatist, Researcher, Critic, Synthesizer
    - User can edit name and persona description for each agent
  - "Start Discussion" button

**Backend**:
- Creates RoundTable record
- Creates Agent records with personas
- Redirects to discussion view

### 2. Discussion View

**Page**: `/roundtable/[id]`

**Layout**:
- **Header**: Topic, round number, agent count
- **Chat Area**: Scrollable message list
  - Each message shows: Agent name, persona label, timestamp
  - Tool calls visible (e.g., "🔍 Searched: climate data 2024")
  - Messages stream in real-time with typing indicators
  - Shows which agent is currently thinking
- **Controls**:
  - "Continue to Round X" button (enabled after round completes)
  - "Pause" button (archives round table)
  - "Archive" button (permanently archives)

**Real-time Experience**:
- Each agent's response streams as it's generated
- "Agent X is thinking..." indicators
- Tool calls appear as they happen
- Smooth, engaging discussion flow

### 3. History

**Page**: `/history`

**Features**:
- List of all round tables
- Shows: Topic, agent count, rounds completed, status
- "Resume" button for active/paused round tables
- "View" button for archived discussions
- Search/filter by topic

## Round Execution Flow

### Process

1. **User clicks "Continue"** → `POST /api/roundtable/[id]/round`
2. **Create new Round** in database with status "in_progress"
3. **Initialize SSE connection** to frontend
4. **Sequential agent execution**:
   - For each agent (in order):
     a. Build context: topic + all previous messages + current round
     b. Call Agent SDK with persona and web search tool
     c. Stream response chunks to frontend
     d. If agent uses web search, send tool call event
     e. Save complete message to database
5. **Mark round complete** when all agents finish
6. **Enable "Continue" button** for next round

### Streaming Events

SSE events sent to frontend:
- `agent-start`: Agent begins speaking
- `chunk`: Token/text chunk from agent
- `tool-call`: Agent invoked web search (includes query and results)
- `agent-complete`: Agent finished speaking
- `round-complete`: All agents finished, round complete

### Context Management

For each agent call:
- **System Prompt**: Agent's persona
- **Messages**: Complete chronological history
  - All rounds (1, 2, 3...)
  - All agent messages in order
  - Tool call results included
- Agent SDK preserves this context automatically

## Key Components

### Frontend Components

- **RoundTableForm**: Create/customize round table and agents
- **DiscussionView**: Main real-time streaming interface
- **MessageBubble**: Individual agent message with tool calls
- **AgentIndicator**: Shows which agent is thinking/speaking
- **RoundTableList**: History page with resume/view options

### Backend API Routes

- `POST /api/roundtable`: Create new round table
- `GET /api/roundtable/[id]`: Get round table details
- `POST /api/roundtable/[id]/round`: Start next round (with SSE)
- `PATCH /api/roundtable/[id]`: Update status (pause/archive)
- `GET /api/roundtable`: List all round tables

## Error Handling & Edge Cases

### API Error Scenarios

**1. Agent SDK/Claude API Failures**
- Timeout (>60s): Show error, allow retry
- Rate limits: Queue requests, show wait time
- API errors: Log, show user-friendly message, allow retry
- Strategy: Graceful degradation - save partial round, resume later

**2. Web Search Tool Failures**
- Agent continues without that data
- Mentions limitation in response
- Don't block entire discussion

**3. Streaming Disconnections**
- Auto-reconnect SSE
- Resume from last completed agent in round
- Backend tracks progress per round

**4. Database Constraints**
- Max rounds per table: 20 (prevent infinite discussions)
- Message content size: Claude's response limits
- Optimistic locking for concurrent operations

### Edge Cases

- **User closes browser mid-round**: Round stays "in_progress", shows "Resume" on next visit
- **Concurrent "Continue" clicks**: Optimistic locking - only one succeeds
- **Empty/invalid topics**: Frontend validation before submission
- **Incomplete rounds**: Always resumable from last completed agent

### User Experience

- Clear error messages (no technical jargon)
- Always offer "Retry" or "Skip" options
- Auto-save progress constantly
- Graceful degradation over hard failures

## Agent Personas

### Default Personas

Users can customize these when creating a round table:

1. **Devil's Advocate**
   - Challenges assumptions
   - Points out potential flaws
   - Asks difficult questions

2. **Optimist**
   - Focuses on opportunities
   - Highlights positive aspects
   - Suggests possibilities

3. **Pragmatist**
   - Evaluates feasibility
   - Considers practical constraints
   - Balances idealism with reality

4. **Researcher**
   - Heavy use of web search tool
   - Provides data and evidence
   - Fact-checks claims

5. **Critic**
   - Analytical and evaluative
   - Identifies weaknesses
   - Suggests improvements

6. **Synthesizer**
   - Finds common ground
   - Integrates different perspectives
   - Summarizes key points

**Customization**:
- Users can edit persona names and descriptions
- Personas saved per round table
- Each agent maintains consistent persona across rounds

## Testing Strategy

### Unit Tests

- Prisma model operations (CRUD)
- Agent persona generation/validation
- Message formatting utilities
- Tool call parsing

### Integration Tests

- API routes functionality
- Database transactions (atomic round table creation)
- Agent SDK integration (mock Claude API)
- SSE streaming logic

### E2E Tests (Optional for MVP)

- Full user flow: create → run rounds → view history
- Use Playwright or Cypress
- Mock Agent SDK to avoid API costs

## Development Phases

### Phase 1: Foundation
- Next.js project setup with TypeScript
- Prisma schema + migrations
- SQLite database initialization
- Basic UI scaffolding

### Phase 2: Core Features
- Create round table form with agent customization
- Database operations (create/read)
- Basic discussion view (static, no streaming)

### Phase 3: Agent Integration
- Agent SDK setup and configuration
- Web search tool integration
- Round execution logic (sequential agents)
- Message persistence

### Phase 4: Real-time Streaming
- SSE implementation
- Frontend real-time updates
- Tool call visualization
- Polish UI/UX

### Phase 5: History & Polish
- History page
- Resume functionality
- Error handling refinements
- Performance optimization

## Technical Decisions & Rationale

### Why Agent SDK over Direct API?
- Built-in multi-agent orchestration
- Context management handled automatically
- Tool use abstractions
- Better suited for agent-to-agent interactions

### Why SQLite?
- Simple setup (no external database)
- Perfect for MVP and local development
- Easy migration to PostgreSQL later if needed
- Sufficient for expected usage patterns

### Why SSE over WebSockets?
- Simpler implementation (one-way communication sufficient)
- Better Next.js integration
- Automatic reconnection handling
- Lower overhead for this use case

### Why Sequential over Parallel?
- Clearer conversation flow
- Agents can build on each other's points
- Easier to follow for users
- Simpler orchestration logic

## Future Enhancements (Out of Scope for MVP)

- Export discussions as PDF/Markdown
- User authentication and multi-tenancy
- Agent voting/rating systems
- Topic templates and presets
- Discussion analytics (sentiment, topic coverage)
- Support for different Claude models per agent
- Custom tool integration beyond web search
- Agent "personality" persistence across different topics

---

**Next Steps**: Proceed to implementation planning and development setup.
